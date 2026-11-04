import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
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

// The landing at / (docs/screen-map.md, Landing): the Ticket list in its New
// view for a user who holds triage_ticket, the Home for every other user.

const ME = "/api/v1/users/me";

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
  focusManager.setFocused(undefined);
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

test("shows the Home to a user without triage_ticket", async () => {
  // A user with every other capability, and with roles, which decide
  // nothing.
  const user: CurrentUserResponse = {
    data: {
      ...FICTIONAL_USER.data,
      roles: ["admin", "vulnerability_analyst"],
      capabilities: Object.values(Capability).filter(
        (capability) => capability !== "triage_ticket",
      ),
    },
  };
  const { router, screen } = await renderApp(user, "/");

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Home" }))
    .toBeVisible();
  expect(document.title).toBe("Home – Sentinel");
  expect(router.state.location.href).toBe("/");
});

test("leads a user who holds triage_ticket to the New view of the Ticket list, in place of / in the browser history", async () => {
  const { router, screen } = await renderApp(OTHER_USER, "/");

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
  expect(router.state.location.href).toBe("/tickets?view=new");
  expect(router.history.length).toBe(1);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Home" }))
    .not.toBeInTheDocument();
});

test("is where Go to the start page leads an analyst", async () => {
  const { router, screen } = await renderApp(OTHER_USER, "/fictional/path");

  await screen.getByRole("link", { name: "Go to the start page" }).click();

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toHaveFocus();
  expect(router.state.location.href).toBe("/tickets?view=new");
  // The Ticket list takes the place of /, after Not found.
  expect(router.history.length).toBe(2);
});

test("is where Sign in leads an analyst without a saved URL", async () => {
  const { router, screen } = await renderApp(OTHER_USER, "/login");

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
  expect(router.state.location.href).toBe("/tickets?view=new");
  expect(router.history.length).toBe(1);
});

test("leads to the New view of the Ticket list when a read of the signed-in user tells that triage_ticket was added while the Home shows", async () => {
  const session = { user: FICTIONAL_USER };
  stubApi((request) =>
    request.path === ME ? jsonResponse(200, session.user) : ticketPage([]),
  );
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Home" }))
    .toBeVisible();

  session.user = {
    data: { ...FICTIONAL_USER.data, capabilities: ["triage_ticket"] },
  };
  // The tab returns to the foreground, and reads the signed-in user again.
  focusManager.setFocused(false);
  focusManager.setFocused(true);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
    .toBeVisible();
  expect(router.state.location.href).toBe("/tickets?view=new");
  expect(router.history.length).toBe(1);
});
