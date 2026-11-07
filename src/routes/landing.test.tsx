import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
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
  requestsTo,
  stubApi,
  ticketPage,
} from "../test-api";
import { LandingRedirect } from "./landing";

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

// While the session ends, the read of the signed-in user is discarded before
// the screen leaves the page (src/session-gate.tsx, useSignedInUser): / then
// knows no landing, shows nothing, and leads nowhere, and it never reads the
// signed-in user itself.
test("shows nothing and leads nowhere while no signed-in user is known", async () => {
  const fetch = stubApi(() => jsonResponse(200, FICTIONAL_USER));
  const root = createRootRoute({ component: Outlet });
  const landing = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: LandingRedirect,
  });
  const tickets = createRoute({
    getParentRoute: () => root,
    path: "/tickets",
    component: () => <h1>Tickets</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([landing, tickets]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await expect.poll(() => router.state.resolvedLocation?.href).toBe("/");
  // Long enough for a navigation that the screen would start.
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
  expect(router.state.location.href).toBe("/");
  expect(screen.container.textContent).toBe("");
  expect(requestsTo(fetch, ME)).toBe(0);
});
