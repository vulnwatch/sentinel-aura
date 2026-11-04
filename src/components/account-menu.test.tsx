import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type { CurrentUserResponse } from "../api/generated/model";
import { getGetCurrentUserProfileQueryKey } from "../api/generated/users";
import { apiRequest } from "../api/request";
import { SIDEBAR_STORAGE_KEY } from "../preferences";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import {
  hasSessionRecord,
  RETURN_URL_KEY,
  SESSION_RECORD_KEY,
} from "../session";
import {
  errorResponse,
  FICTIONAL_USER,
  jsonResponse,
  requestsTo,
  stubApi,
  unauthorized,
  type ApiResponder,
} from "../test-api";
import {
  applyThemePreference,
  followThemePreference,
  THEME_STORAGE_KEY,
} from "../theme";

// The account button and the account menu (docs/screen-map.md, Sidebar;
// docs/design-system.md, Sidebar; Account Menu), and Sign out
// (docs/behaviors.md, Sign-out), at the browser's default text size, in the
// light theme.

const ME = "/api/v1/users/me";
const LOGOUT = "/api/v1/auth/logout";
const TICKETS = "/api/v1/tickets";
const REQUEST_ID = "01890a5d-ac96-774b-bcce-b302099a8057";
const EXPIRED = "Your session has expired. Sign in again.";

// A bot account without a full name differs from its username nowhere, so
// the tests use one with a full name.
const SCANNER: CurrentUserResponse = {
  data: {
    id: "00000000-0000-0000-0000-00000000000d",
    username: "security-scanner",
    email: "security-scanner@example.com",
    full_name: "Security Scanner",
    roles: ["restricted_analyst"],
    capabilities: ["create_ticket"],
    active: true,
    bot: true,
    assignment_eligibility: "none",
  },
};

let client: QueryClient;

// A read of other data of a screen, through the shared request function.
function readTickets() {
  return client
    .fetchQuery({
      queryKey: ["tickets"],
      queryFn: ({ signal }) => apiRequest(TICKETS, { method: "GET", signal }),
    })
    .catch(() => undefined);
}

// Resolves once the pending callbacks of the timers have run, for a test that
// checks that nothing more happens.
function settle() {
  return new Promise((resolve) => {
    setTimeout(resolve, 50);
  });
}

beforeEach(async () => {
  client = createQueryClient();
  client.setQueryDefaults(getGetCurrentUserProfileQueryKey(), {
    retryDelay: 0,
  });
  await page.viewport(1280, 800);
});

afterEach(async () => {
  client.clear();
  vi.restoreAllMocks();
  window.localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
  applyThemePreference("system");
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

// Signs in the user, whose session sign-out ends, answers sign-out with the
// responder, and every other request with an empty list, or a 401 once the
// session ended.
function stubSession(
  user: CurrentUserResponse = FICTIONAL_USER,
  signOut: ApiResponder = () => new Response(null, { status: 204 }),
) {
  const session = { active: true };
  const fetch = stubApi(async (request) => {
    if (request.path === LOGOUT) {
      const response = await signOut(request);
      if (response.status === 204 || response.status === 401) {
        session.active = false;
      }
      return response;
    }
    if (!session.active) {
      return unauthorized();
    }
    return request.path === ME
      ? jsonResponse(200, user)
      : jsonResponse(200, { data: [] });
  });
  return { fetch, session };
}

async function renderApp(path = "/") {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderApp>>["screen"];

function accountButton(screen: Screen, name = "John Doe") {
  return screen
    .getByRole("navigation", { name: "Main" })
    .getByRole("button", { name });
}

async function openMenu(screen: Screen, name = "John Doe") {
  await accountButton(screen, name).click();
  // Named by the account button.
  const menu = screen.getByRole("menu", { name });
  await expect.element(menu).toBeVisible();
  return menu;
}

describe("the account button", () => {
  // The avatar, its size, and chevrons-up-down show in the reference
  // screenshot home.png.
  test("shows the display name, with its pictures hidden from assistive technologies", async () => {
    stubSession();
    const { screen } = await renderApp();
    const button = accountButton(screen);

    await expect.element(button).toBeVisible();
    expect(button.element().textContent).toBe("John Doe");
    expect(button.getByRole("img").query()).toBeNull();
    expect(button.element().getBoundingClientRect().height).toBe(44);
    expect(getComputedStyle(button.element()).fontWeight).toBe("500");
    await expect.element(button).toHaveAttribute("aria-haspopup", "true");
  });

  test("cuts a long display name with an ellipsis and keeps the labels", async () => {
    stubSession({
      data: {
        ...SCANNER.data,
        full_name: "Security Scanner of the Fictional Pipelines",
      },
    });
    const { screen } = await renderApp();
    const name = screen.getByText(
      "Security Scanner of the Fictional Pipelines",
    );

    await expect.element(name).toBeVisible();
    expect(name.element().scrollWidth).toBeGreaterThan(
      name.element().clientWidth,
    );
    expect(getComputedStyle(name.element()).textOverflow).toBe("ellipsis");
    await expect
      .element(
        screen
          .getByRole("navigation", { name: "Main" })
          .getByText("Bot", { exact: true }),
      )
      .toBeVisible();
  });

  test("shows the avatar alone in the collapsed sidebar, named by the compact name, which its tooltip shows", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    stubSession({ data: { ...SCANNER.data } });
    const { screen } = await renderApp();
    const button = accountButton(screen, "Security Scanner (bot)");

    await expect.element(button).toBeVisible();
    expect(button.element().textContent).toBe("");
    const box = button.element().getBoundingClientRect();
    expect([box.width, box.height]).toEqual([40, 44]);

    button.element().focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}{Tab}");
    await expect
      .element(screen.getByRole("tooltip", { name: "Security Scanner (bot)" }))
      .toBeVisible();
  });
});

describe("the account menu", () => {
  test("opens upward, 256 px wide, with the signed-in user and the items of the account", async () => {
    stubSession({ data: { ...FICTIONAL_USER.data, username: "jdoe" } });
    const { screen } = await renderApp();
    const button = accountButton(screen);

    const menu = await openMenu(screen);

    // The popover of the menu, which React Aria names after the button.
    const popover = screen
      .getByRole("dialog", { name: "John Doe" })
      .element()
      .getBoundingClientRect();
    expect(popover.width).toBe(256);
    expect(popover.bottom).toBeLessThanOrEqual(
      button.element().getBoundingClientRect().top,
    );
    // The signed-in user, with the username on a line of its own.
    const popoverElement = screen.getByRole("dialog", { name: "John Doe" });
    const username = popoverElement.getByText("@jdoe", { exact: true });
    await expect.element(username).toBeVisible();
    expect(
      username.element().getBoundingClientRect().top,
    ).toBeGreaterThanOrEqual(
      popoverElement
        .getByText("John Doe", { exact: true })
        .element()
        .getBoundingClientRect().bottom,
    );
    const items = menu.getByRole("menuitem").all();
    expect(items.map((item) => item.element().textContent)).toEqual([
      "Profile",
      "API keys",
      "Identity audit log",
      "Sign out",
    ]);
    expect(
      items.slice(0, 3).map((item) => item.element().getAttribute("href")),
    ).toEqual(["/account", "/account/api-keys", "/account/identity-audit-log"]);
    const themes = menu.getByRole("menuitemradio").all();
    expect(themes.map((item) => item.element().textContent)).toEqual([
      "System",
      "Light",
      "Dark",
    ]);
    await expect
      .element(menu.getByRole("group", { name: "Theme" }))
      .toBeVisible();
  });

  test("shows the focus ring inside the item that the keyboard focuses", async () => {
    stubSession();
    const { screen } = await renderApp();
    accountButton(screen).element().focus();

    await userEvent.keyboard("{Enter}");

    const item = screen
      .getByRole("menu", { name: "John Doe" })
      .getByRole("menuitem", { name: "Profile" });
    await expect.element(item).toHaveFocus();
    const style = getComputedStyle(item.element());
    // focus and surface-hover of the light theme.
    expect([
      style.outlineStyle,
      style.outlineColor,
      style.outlineOffset,
      style.backgroundColor,
    ]).toEqual(["solid", "rgb(9, 105, 218)", "-2px", "rgb(243, 245, 248)"]);
  });

  test("wraps a long name and username instead of cutting them", async () => {
    stubSession({
      data: {
        ...SCANNER.data,
        full_name: "Security Scanner of the Fictional Pipelines",
      },
    });
    const { screen } = await renderApp();

    await openMenu(screen, "Security Scanner of the Fictional Pipelines Bot");

    const name = screen
      .getByRole("dialog")
      .getByText("Security Scanner of the Fictional Pipelines", {
        exact: true,
      })
      .element();
    expect(name.scrollWidth).toBeLessThanOrEqual(name.clientWidth);
    expect(name.getBoundingClientRect().height).toBeGreaterThan(24);
    await expect
      .element(
        screen
          .getByRole("dialog")
          .getByText("@security-scanner", { exact: true }),
      )
      .toBeVisible();
  });

  test("shows the username also when it is the display name", async () => {
    stubSession({ data: { ...FICTIONAL_USER.data, full_name: null } });
    const { screen } = await renderApp();

    await openMenu(screen, "jdoe");

    await expect
      .element(screen.getByRole("dialog").getByText("@jdoe", { exact: true }))
      .toBeVisible();
  });

  test("leads to a screen of the account, and closes", async () => {
    stubSession();
    const { router, screen } = await renderApp();
    const menu = await openMenu(screen);

    await menu.getByRole("menuitem", { name: "API keys" }).click();

    await expect.element(menu).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/account/api-keys");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
  });

  test("marks the theme System as selected by default, and with a stored value that it does not list", async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "blue");
    stubSession();
    const { screen } = await renderApp();

    const menu = await openMenu(screen);

    await expect
      .element(menu.getByRole("menuitemradio", { name: "System" }))
      .toBeChecked();
  });

  test.each([
    ["Dark", "dark"],
    ["Light", "light"],
  ] as const)(
    "applies the theme %s at once, keeps it, and marks it",
    async (name, value) => {
      stubSession();
      const { screen } = await renderApp();
      const menu = await openMenu(screen);
      // The application follows the preference as it starts (src/main.tsx).
      const stop = followThemePreference();
      try {
        await menu.getByRole("menuitemradio", { name }).click();

        expect(document.documentElement.dataset.theme).toBe(value);
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe(value);
        const reopened = await openMenu(screen);
        await expect
          .element(reopened.getByRole("menuitemradio", { name }))
          .toBeChecked();
        await expect
          .element(reopened.getByRole("menuitemradio", { name: "System" }))
          .not.toBeChecked();
      } finally {
        stop();
      }
    },
  );

  test("marks the theme that another tab chooses", async () => {
    stubSession();
    const { screen } = await renderApp();
    const menu = await openMenu(screen);

    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    window.dispatchEvent(
      new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }),
    );

    await expect
      .element(menu.getByRole("menuitemradio", { name: "Dark" }))
      .toBeChecked();
  });
});

describe("Sign out", () => {
  test.each([
    ["204", () => new Response(null, { status: 204 })],
    ["401, when no valid session remained", () => unauthorized()],
  ])(
    "on %s, forgets the session, discards the data, and opens Sign in in place of the screen, without a message",
    async (_, respond) => {
      const methods: string[] = [];
      stubSession(FICTIONAL_USER, (request) => {
        methods.push(request.method);
        return respond();
      });
      window.sessionStorage.setItem(RETURN_URL_KEY, "/cves");
      const { router, screen } = await renderApp("/fictional/path?page=2");
      expect(hasSessionRecord()).toBe(true);
      client.setQueryData(["records"], { data: ["fictional"] });
      const menu = await openMenu(screen);

      await menu.getByRole("menuitem", { name: "Sign out" }).click();

      await expect
        .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
        .toHaveFocus();
      expect(methods).toEqual(["POST"]);
      expect(router.state.location.pathname).toBe("/login");
      expect(router.history.length).toBe(1);
      expect(hasSessionRecord()).toBe(false);
      expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
      expect(client.getQueryData(["records"])).toBeUndefined();
      expect(
        client.getQueryData(getGetCurrentUserProfileQueryKey()),
      ).toBeUndefined();
      await expect.element(screen.getByText(EXPIRED)).not.toBeInTheDocument();
      await expect
        .element(screen.getByRole("navigation"))
        .not.toBeInTheDocument();
    },
  );

  test("asks for no confirmation, stays in the open menu, busy, while it is in progress, and is sent once", async () => {
    let answer!: (response: Response) => void;
    const { fetch } = stubSession(
      FICTIONAL_USER,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { screen } = await renderApp();
    accountButton(screen).element().focus();
    await userEvent.keyboard("{Enter}");
    const menu = screen.getByRole("menu", { name: "John Doe" });
    const item = menu.getByRole("menuitem", { name: "Sign out" });
    await userEvent.keyboard("{End}");
    await expect.element(item).toHaveFocus();
    expect(item.element().getAnimations({ subtree: true })).toEqual([]);
    await expect.element(item).not.toHaveAccessibleDescription("Signing out");

    await userEvent.keyboard("{Enter}");
    await expect.poll(() => requestsTo(fetch, LOGOUT)).toBe(1);
    await userEvent.keyboard("{Enter}");

    // Busy: the item keeps the focus, loader-circle turns in place of its
    // icon, and assistive technologies read that it is signing out.
    await expect.element(item).toHaveFocus();
    await expect.element(item).toHaveAccessibleDescription("Signing out");
    expect(
      item
        .element()
        .getAnimations({ subtree: true })
        .map((animation) =>
          animation instanceof CSSAnimation ? animation.animationName : "",
        ),
    ).toEqual(["spin"]);
    await expect.element(menu).toBeVisible();
    // The only dialog is the popover of the menu: no confirmation.
    const dialogs = screen.getByRole("dialog").all();
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]?.element().contains(menu.element())).toBe(true);
    expect(requestsTo(fetch, LOGOUT)).toBe(1);
    answer(new Response(null, { status: 204 }));
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
  });

  test("ends the session as Sign out at once when another request receives a 401 meanwhile, whatever its outcome", async () => {
    let answer!: (response: Response) => void;
    const { session } = stubSession(
      FICTIONAL_USER,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { router, screen } = await renderApp("/fictional/path");
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Sign out" }).click();

    // Sentinel ended the session, and another read receives its 401 before
    // the response of the sign-out arrives.
    session.active = false;
    await readTickets();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(router.history.length).toBe(1);
    await expect.element(screen.getByText(EXPIRED)).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBeNull();
    expect(hasSessionRecord()).toBe(false);

    answer(errorResponse(503, "DATABASE_UNAVAILABLE"));
    await settle();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    await expect
      .element(screen.getByText(/Sentinel isn't available/))
      .not.toBeInTheDocument();
  });

  test("ends the session as Sign out when the read of the signed-in user receives a 401 meanwhile", async () => {
    let answer!: (response: Response) => void;
    const { session } = stubSession(
      FICTIONAL_USER,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const { router, screen } = await renderApp("/fictional/path");
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Sign out" }).click();

    session.active = false;
    await client.invalidateQueries({
      queryKey: getGetCurrentUserProfileQueryKey(),
    });

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    await expect.element(screen.getByText(EXPIRED)).not.toBeInTheDocument();
    answer(new Response(null, { status: 204 }));
    await settle();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
  });

  test("leads to Sign in as for an expired session after a 401 that follows a sign-out that failed", async () => {
    const { session } = stubSession(FICTIONAL_USER, () =>
      errorResponse(503, "DATABASE_UNAVAILABLE"),
    );
    const { router, screen } = await renderApp("/fictional/path");
    const menu = await openMenu(screen);
    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect
      .element(
        screen
          .getByRole("main")
          .getByText("Sentinel isn't available right now. Try again later."),
      )
      .toBeVisible();

    session.active = false;
    await readTickets();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    await expect.element(screen.getByText(EXPIRED)).toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(window.sessionStorage.getItem(RETURN_URL_KEY)).toBe(
      "/fictional/path",
    );
  });

  test("shows the failure of a sign-out that ends after the account menu has left the page", async () => {
    let answer!: (response: Response) => void;
    stubSession(
      FICTIONAL_USER,
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    await page.viewport(800, 700);
    const { screen } = await renderApp("/fictional/path");
    await screen
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Expand navigation" })
      .click();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await dialog.getByRole("button", { name: "John Doe" }).click();
    const menu = screen.getByRole("menu", { name: "John Doe" });
    await menu.getByRole("menuitem", { name: "Sign out" }).click();

    // The window grows, which closes the sidebar over the content with its
    // account button and menu.
    await page.viewport(1280, 800);
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(menu).not.toBeInTheDocument();
    answer(errorResponse(503, "DATABASE_UNAVAILABLE"));

    await expect
      .element(
        screen
          .getByRole("main")
          .getByText("Sentinel isn't available right now. Try again later."),
      )
      .toBeVisible();
  });

  test.each([
    [
      "a 503",
      () => errorResponse(503, "DATABASE_UNAVAILABLE"),
      "Sentinel isn't available right now. Try again later.",
      true,
    ],
    [
      "a network failure",
      () => Promise.reject(new TypeError("Failed to fetch")),
      "Sentinel can't be reached. Check your connection and try again.",
      false,
    ],
    [
      "400 AUTH_LOGOUT_NOT_APPLICABLE",
      () => errorResponse(400, "AUTH_LOGOUT_NOT_APPLICABLE"),
      "Sentinel didn't accept this request.",
      false,
    ],
    [
      "403 AUTH_CROSS_ORIGIN_REJECTED",
      () => errorResponse(403, "AUTH_CROSS_ORIGIN_REJECTED"),
      "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below.",
      true,
    ],
    [
      "a status and a code that the pinned contract does not list",
      () => errorResponse(418, "FICTIONAL_UNLISTED_CODE"),
      "Sentinel didn't accept this request.",
      false,
    ],
  ])(
    "after %s, keeps the user signed in, closes the menu, and shows the message of its status",
    async (_, respond, message, withReference) => {
      stubSession(FICTIONAL_USER, respond);
      const { router, screen } = await renderApp("/fictional/path");
      const menu = await openMenu(screen);

      await menu.getByRole("menuitem", { name: "Sign out" }).click();

      const shown = screen.getByRole("main").getByText(message);
      await expect.element(shown).toBeVisible();
      await expect.element(menu).not.toBeInTheDocument();
      await expect.element(accountButton(screen)).toHaveFocus();
      await expect
        .element(
          screen.getByRole("main").getByRole("button", { name: "Dismiss" }),
        )
        .toBeVisible();
      if (withReference) {
        await expect
          .element(screen.getByText(`Reference: ${REQUEST_ID}`))
          .toBeVisible();
      } else {
        await expect
          .element(screen.getByText(/Reference/))
          .not.toBeInTheDocument();
      }
      expect(router.state.location.pathname).toBe("/fictional/path");
      expect(hasSessionRecord()).toBe(true);
      await expect
        .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
        .toBeVisible();
    },
  );

  test("closes the sidebar opened over the content when Sign out fails from it, so that the message shows, and returns the focus to the expand button", async () => {
    await page.viewport(800, 700);
    stubSession(FICTIONAL_USER, () =>
      errorResponse(503, "DATABASE_UNAVAILABLE"),
    );
    const { screen } = await renderApp("/fictional/path");
    const expand = screen
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Expand navigation" });
    await expand.click();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await dialog.getByRole("button", { name: "John Doe" }).click();

    await screen
      .getByRole("menu", { name: "John Doe" })
      .getByRole("menuitem", { name: "Sign out" })
      .click();

    await expect.element(dialog).not.toBeInTheDocument();
    const message = screen
      .getByRole("main")
      .getByText("Sentinel isn't available right now. Try again later.");
    await expect.element(message).toBeVisible();
    expect(message.element().closest("[inert], [aria-hidden]")).toBeNull();
    await expect.element(expand).toHaveFocus();

    // Only the expand button opens it again, not the dismissal of the
    // message that closed it.
    await screen.getByRole("button", { name: "Dismiss" }).click();
    await expect.element(message).not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
    expect(screen.getByRole("dialog").query()).toBeNull();
  });

  test("leaves a failure of the UI itself to the page of a failure of the UI, in the column of the Sign In Page", async () => {
    stubSession();
    const { screen } = await renderApp();
    const menu = await openMenu(screen);
    // A fault of the code that reads the response, not a failure of the
    // request.
    vi.spyOn(Headers.prototype, "get").mockImplementation(() => {
      throw new TypeError("Cannot read properties of undefined");
    });

    await menu.getByRole("menuitem", { name: "Sign out" }).click();

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("main").getByText("Sentinel", { exact: true }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("navigation"))
      .not.toBeInTheDocument();
  });
});
