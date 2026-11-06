import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import { Capability, type CurrentUserResponse } from "../api/generated/model";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import {
  FICTIONAL_USER,
  jsonResponse,
  OTHER_USER,
  stubApi,
  ticketPage,
} from "../test-api";

// The landing, to which / leads (docs/screen-map.md, Landing): the Ticket
// list in its New view for a user who holds triage_ticket, and in its All
// view for every other user, in place of / in the browser history.

const ME = "/api/v1/users/me";

// A user with every other capability, and with roles, which decide nothing.
const NOT_TRIAGING: CurrentUserResponse = {
  data: {
    ...FICTIONAL_USER.data,
    roles: ["admin", "vulnerability_analyst"],
    capabilities: Object.values(Capability).filter(
      (capability) => capability !== "triage_ticket",
    ),
  },
};

let client: QueryClient;

beforeEach(() => {
  client = createQueryClient();
});

afterEach(async () => {
  // Before the responses go, so that the screen of the test reads nothing
  // more.
  await cleanup();
  client.clear();
  vi.restoreAllMocks();
  document.title = "Sentinel";
});

// Signs in the user and shows the screen at the path.
async function renderApp(user: CurrentUserResponse, path: string) {
  stubApi((request) =>
    request.path === ME ? jsonResponse(200, user) : ticketPage([]),
  );
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

describe.each([
  ["who holds triage_ticket, the New view", OTHER_USER, "/tickets?view=new"],
  ["with every other capability, the All view", NOT_TRIAGING, "/tickets"],
])("for a user %s", (_, user, landing) => {
  test("leads from / to the landing, in place of / in the browser history", async () => {
    const { router, screen } = await renderApp(user, "/");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    expect(router.state.location.href).toBe(landing);
    expect(router.history.length).toBe(1);
    expect(document.title).toBe("Tickets – Sentinel");
  });

  test("is where Go to the start page leads, with the focus on its heading", async () => {
    const { router, screen } = await renderApp(user, "/fictional/path");

    await screen.getByRole("link", { name: "Go to the start page" }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
    expect(router.state.location.href).toBe(landing);
    // The Ticket list takes the place of /, after Not found.
    expect(router.history.length).toBe(2);
  });

  test("is where Sign in leads without a saved URL", async () => {
    const { router, screen } = await renderApp(user, "/login");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    expect(router.state.location.href).toBe(landing);
    expect(router.history.length).toBe(1);
  });
});
