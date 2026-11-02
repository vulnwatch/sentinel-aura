import {
  focusManager,
  MutationObserver,
  QueryClientProvider,
  type QueryClient,
} from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import "./styles.css";
import { App } from "./app";
import { Button } from "./components/button";
import { RootLayout } from "./routes/root";
import { getLogoutMutationOptions } from "./api/generated/authentication";
import { getGetCurrentUserProfileQueryKey } from "./api/generated/users";
import { apiRequest } from "./api/request";
import { createQueryClient } from "./query-client";
import { createAppRouter } from "./router";
import {
  hasSessionRecord,
  RETURN_URL_KEY,
  SESSION_RECORD_KEY,
} from "./session";
import {
  FICTIONAL_USER,
  jsonResponse,
  OTHER_USER,
  requestsTo,
  stubApi,
  unauthorized,
  type ApiResponder,
} from "./test-api";

const ME = "/api/v1/users/me";
const TICKETS = "/api/v1/tickets";
// A path that requires a session and matches no screen, so that it shows Not
// found to a signed-in user without reading anything else.
const SCREEN = "/fictional/path";

let client: QueryClient;

beforeEach(() => {
  client = createQueryClient();
  // The delay between attempts is TanStack Query's; the tests remove it.
  client.setQueryDefaults(getGetCurrentUserProfileQueryKey(), {
    retryDelay: 0,
  });
});

afterEach(() => {
  client.clear();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
  document.title = "Sentinel";
});

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  return { router, screen };
}

// Answers the read of the signed-in user with the session that the test
// sets, and every other request with the responder.
function stubSession(
  initial: "signed-in" | "none",
  other: ApiResponder = () => jsonResponse(200, { data: [] }),
) {
  const session = {
    user: initial === "signed-in" ? FICTIONAL_USER : undefined,
  };
  const spy = stubApi((request) => {
    if (request.path !== ME) {
      return other(request);
    }
    return session.user === undefined
      ? unauthorized()
      : jsonResponse(200, session.user);
  });
  return { session, spy };
}

// A read of other data of a screen, through the shared request function.
function readTickets() {
  return client
    .fetchQuery({
      queryKey: ["tickets"],
      queryFn: ({ signal }) => apiRequest(TICKETS, { method: "GET", signal }),
    })
    .catch(() => undefined);
}

// The tab returns to the foreground after being hidden.
function returnToForeground() {
  focusManager.setFocused(false);
  focusManager.setFocused(true);
}

function savedUrl() {
  return window.sessionStorage.getItem(RETURN_URL_KEY);
}

describe("as the UI loads", () => {
  test("shows only the loading indicator until the signed-in user arrives, then the screen", async () => {
    let answer!: (response: Response) => void;
    stubApi(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { screen } = await renderApp("/");

    await expect
      .element(screen.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    await expect.element(screen.getByRole("heading")).not.toBeInTheDocument();
    answer(jsonResponse(200, FICTIONAL_USER));

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("progressbar"))
      .not.toBeInTheDocument();
  });

  test("records that the browser has a session", async () => {
    stubSession("signed-in");
    const { screen } = await renderApp("/");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    expect(hasSessionRecord()).toBe(true);
  });

  test("leads to Sign in in place of a screen without a session, and saves its URL", async () => {
    stubSession("none");
    const { router, screen } = await renderApp(`${SCREEN}?view=all#part`);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.history.length).toBe(1);
    expect(savedUrl()).toBe(`${SCREEN}?view=all#part`);
    // A first visit: the browser had no session before.
    await expect
      .element(screen.getByText("Your session has expired. Sign in again."))
      .not.toBeInTheDocument();
    expect(hasSessionRecord()).toBe(false);
  });

  test("tells on Sign in that the session has expired when the browser had one", async () => {
    window.localStorage.setItem(SESSION_RECORD_KEY, "signed-in");
    stubSession("none");
    const { screen } = await renderApp("/");

    await expect
      .element(screen.getByText("Your session has expired. Sign in again."))
      .toBeVisible();
    expect(savedUrl()).toBe("/");
  });

  test("shows Sign in opened directly without saving a URL or telling that the session expired", async () => {
    window.localStorage.setItem(SESSION_RECORD_KEY, "signed-in");
    stubSession("none");
    const { router, screen } = await renderApp("/login");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(savedUrl()).toBeNull();
    await expect
      .element(screen.getByText("Your session has expired. Sign in again."))
      .not.toBeInTheDocument();
  });

  test.each([
    ["without a session", "none"],
    ["with a session", "signed-in"],
  ] as const)("shows Not found at /auth/callback %s", async (_, session) => {
    stubSession(session);
    const { router, screen } = await renderApp(
      "/auth/callback?code=fictional&state=fictional",
    );

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/auth/callback");
    expect(savedUrl()).toBeNull();
  });

  test.each([
    ["a screen", SCREEN],
    ["Sign in", "/login"],
  ])(
    "shows another failure on %s in place of the screen, with Try again, without leading to Sign in",
    async (_, path) => {
      const fetch = stubApi(() =>
        jsonResponse(503, { code: "DATABASE_UNAVAILABLE" }),
      );
      const { router, screen } = await renderApp(path);

      await expect
        .element(
          screen.getByRole("heading", {
            level: 1,
            name: "This page couldn't be loaded",
          }),
        )
        .toBeVisible();
      // After the automatic attempts of a read.
      expect(requestsTo(fetch, ME)).toBe(3);
      await expect
        .element(
          screen.getByText(
            "Sentinel isn't available right now. Try again later.",
          ),
        )
        .toBeVisible();
      await expect
        .element(screen.getByText("01890a5d-ac96-774b-bcce-b302099a8057"))
        .toBeVisible();
      // In the column of the Sign In Page, under the product name.
      await expect
        .element(
          screen.getByRole("main").getByText("Sentinel", { exact: true }),
        )
        .toBeVisible();
      expect(router.state.location.pathname).toBe(path);
      expect(savedUrl()).toBeNull();
      expect(document.title).toBe("This page couldn't be loaded – Sentinel");

      fetch.mockImplementation(() =>
        Promise.resolve(jsonResponse(200, FICTIONAL_USER)),
      );
      await screen.getByRole("button", { name: "Try again" }).click();

      await expect
        .element(
          screen.getByRole("heading", {
            level: 1,
            name: path === "/login" ? "Sentinel Aura" : "Not found",
          }),
        )
        .toBeVisible();
    },
  );

  test("links to the landing after a failure that Try again does not follow", async () => {
    stubApi(() => jsonResponse(403, { code: "AUTH_INSUFFICIENT_PERMISSION" }));
    const { screen } = await renderApp(SCREEN);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "No access" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Go to the start page" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .not.toBeInTheDocument();
  });

  test("does not read the signed-in user again when the tab returns to the foreground while its failure shows", async () => {
    const fetch = stubApi(() => jsonResponse(404, { code: "ROUTE_NOT_FOUND" }));
    const { screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("link", { name: "Go to the start page" }))
      .toBeVisible();

    returnToForeground();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(requestsTo(fetch, ME)).toBe(1);
  });
});

describe("a 401 of another request", () => {
  test("of a read discards the data read from the API and leads to Sign in", async () => {
    const { session } = stubSession("signed-in", () => unauthorized());
    const { router, screen } = await renderApp(`${SCREEN}?view=all`);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    client.setQueryData(["records"], { data: ["fictional"] });

    session.user = undefined;
    await readTickets();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.history.length).toBe(1);
    expect(savedUrl()).toBe(`${SCREEN}?view=all`);
    expect(client.getQueryData(["records"])).toBeUndefined();
    expect(client.getQueryData(getGetCurrentUserProfileQueryKey())).toBe(
      undefined,
    );
    await expect
      .element(screen.getByText("Your session has expired. Sign in again."))
      .toBeVisible();
  });

  test("of a change leads to Sign in", async () => {
    const { session } = stubSession("signed-in", () => unauthorized());
    const { router, screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();

    session.user = undefined;
    await new MutationObserver(client, {
      mutationFn: () => apiRequest(TICKETS, { method: "POST" }),
    })
      .mutate()
      .catch(() => undefined);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
  });

  test("leads to Sign in once, however many requests receive one", async () => {
    // The responses to a read and a change, which arrive together.
    let answer!: () => void;
    const answered = new Promise<void>((resolve) => {
      answer = resolve;
    });
    const { session, spy } = stubSession("signed-in", async () => {
      await answered;
      return unauthorized();
    });
    const { router, screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    const save = vi.spyOn(Storage.prototype, "setItem");
    const navigations: string[] = [];
    router.subscribe("onBeforeNavigate", ({ toLocation }) => {
      navigations.push(toLocation.pathname);
    });

    session.user = undefined;
    const read = readTickets();
    const change = new MutationObserver(client, {
      mutationFn: () => apiRequest(TICKETS, { method: "POST" }),
    })
      .mutate()
      .catch(() => undefined);
    await expect.poll(() => requestsTo(spy, TICKETS)).toBe(2);
    answer();
    await Promise.all([read, change]);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(navigations).toEqual(["/login"]);
    expect(
      save.mock.calls.filter(([key]) => key === RETURN_URL_KEY),
    ).toHaveLength(1);
  });

  test("changes nothing on Sign in", async () => {
    stubSession("none", () => unauthorized());
    const { router, screen } = await renderApp("/login");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();

    await readTickets();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(savedUrl()).toBeNull();
  });

  test("of sign-out does not lead to Sign in on its own", async () => {
    stubSession("signed-in", () => unauthorized());
    const { router, screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();

    await new MutationObserver(client, getLogoutMutationOptions())
      .mutate()
      .catch(() => undefined);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe(SCREEN);
    expect(savedUrl()).toBeNull();
  });
});

describe("the signed-in user", () => {
  test.each([
    ["a 403", "AUTH_INSUFFICIENT_PERMISSION", 2],
    ["403 AUTH_CROSS_ORIGIN_REJECTED", "AUTH_CROSS_ORIGIN_REJECTED", 1],
  ])("is read %s", async (_, code, reads) => {
    const { spy } = stubSession("signed-in", () => jsonResponse(403, { code }));
    const { screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();

    await readTickets();
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    expect(requestsTo(spy, ME)).toBe(reads);
  });

  test("is read again when the tab returns to the foreground, and a later failure changes nothing", async () => {
    const fetch = stubApi(() => jsonResponse(200, FICTIONAL_USER));
    const { screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();

    fetch.mockImplementation(() =>
      Promise.resolve(jsonResponse(500, { code: "INTERNAL_ERROR" })),
    );
    returnToForeground();

    await expect.poll(() => requestsTo(fetch, ME)).toBe(4);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(screen.getByText(/Something went wrong in Sentinel/))
      .not.toBeInTheDocument();
  });

  test("ends the session when a read on the return to the foreground receives a 401", async () => {
    const { session } = stubSession("signed-in");
    const { router, screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();

    session.user = undefined;
    returnToForeground();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(savedUrl()).toBe(SCREEN);
    await expect
      .element(screen.getByText("Your session has expired. Sign in again."))
      .toBeVisible();
  });

  test("discards the data and opens the landing when it is another user", async () => {
    const { session } = stubSession("signed-in");
    const { router, screen } = await renderApp(SCREEN);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    client.setQueryData(["records"], { data: ["fictional"] });

    session.user = OTHER_USER;
    returnToForeground();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/");
    expect(router.history.length).toBe(1);
    expect(client.getQueryData(["records"])).toBeUndefined();
    expect(client.getQueryData(getGetCurrentUserProfileQueryKey())).toEqual(
      OTHER_USER,
    );
  });
});

// A screen at / whose state the user changes, such as input not yet
// submitted.
function CountingScreen() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <h1>Counter</h1>
      <Button
        onPress={() => {
          setCount(count + 1);
        }}
      >
        {`Pressed ${count} times`}
      </Button>
    </main>
  );
}

test("starts the screen again for another user, so that it keeps nothing of the previous one", async () => {
  const { session } = stubSession("signed-in");
  const root = createRootRoute({ component: RootLayout });
  const counter = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: CountingScreen,
  });
  const router = createRouter({
    routeTree: root.addChildren([counter]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.getByRole("button", { name: "Pressed 0 times" }).click();
  await expect
    .element(screen.getByRole("button", { name: "Pressed 1 times" }))
    .toBeVisible();

  session.user = OTHER_USER;
  returnToForeground();

  await expect
    .element(screen.getByRole("button", { name: "Pressed 0 times" }))
    .toBeVisible();
});

describe("Sign in, once a session exists", () => {
  test("opens the saved URL in its place when it learns of a sign-in in another tab", async () => {
    const { session } = stubSession("none");
    const { router, screen } = await renderApp(`${SCREEN}?view=all#part`);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();

    session.user = FICTIONAL_USER;
    returnToForeground();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    expect(router.state.location.href).toBe(`${SCREEN}?view=all#part`);
    expect(router.history.length).toBe(1);
    expect(savedUrl()).toBeNull();
  });

  test.each([
    ["no URL is saved", undefined],
    ["the saved URL leads to another origin", "https://attacker.example.com/"],
    ["the saved URL is Sign in", "/login"],
  ])("opens the landing as it loads when %s", async (_, saved) => {
    if (saved !== undefined) {
      window.sessionStorage.setItem(RETURN_URL_KEY, saved);
    }
    stubSession("signed-in");
    const { router, screen } = await renderApp("/login");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/");
    expect(router.history.length).toBe(1);
    expect(savedUrl()).toBeNull();
  });
});
