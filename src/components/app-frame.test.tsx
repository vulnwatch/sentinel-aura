import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import { apiRequest } from "../api/request";
import { getGetCurrentUserProfileQueryKey } from "../api/generated/users";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { RETURN_URL_KEY, SESSION_RECORD_KEY } from "../session";
import {
  FICTIONAL_USER,
  jsonResponse,
  signedIn,
  stubApi,
  unauthorized,
} from "../test-api";

// The frame of every screen (docs/screen-map.md, Sidebar;
// docs/design-system.md, Page Layout; docs/behaviors.md, Accessibility).

const ME = "/api/v1/users/me";
const LOGIN = "/api/v1/auth/login";

let client: QueryClient;

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
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  window.sessionStorage.removeItem(RETURN_URL_KEY);
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

// Answers the read of the signed-in user with the session that the test
// sets, sign-in with a success that starts it, and every other request with
// an empty list, or a 401 without a session.
function stubSession(initial: "signed-in" | "none") {
  const session = { active: initial === "signed-in" };
  stubApi((request) => {
    if (request.path === LOGIN) {
      session.active = true;
      return signedIn();
    }
    if (!session.active) {
      return unauthorized();
    }
    return request.path === ME
      ? jsonResponse(200, FICTIONAL_USER)
      : jsonResponse(200, { data: [] });
  });
  return session;
}

async function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
  return { router, screen };
}

describe("with a signed-in user", () => {
  test("shows the sidebar as the navigation landmark and the screen as the main landmark", async () => {
    stubSession("signed-in");
    const { screen } = await renderApp("/");

    await expect
      .element(screen.getByRole("navigation", { name: "Main" }))
      .toBeVisible();
    await expect
      .element(
        screen
          .getByRole("main")
          .getByRole("heading", { level: 1, name: "Home" }),
      )
      .toBeVisible();
    expect(screen.getByRole("main").all()).toHaveLength(1);
    expect(document.title).toBe("Home – Sentinel");
    // 24 px of space at the top and the sides of the main content.
    const main = screen.getByRole("main").element().getBoundingClientRect();
    const heading = screen
      .getByRole("heading", { level: 1 })
      .element()
      .getBoundingClientRect();
    expect([heading.top - main.top, heading.left - main.left]).toEqual([
      24, 24,
    ]);
  });

  test("starts with the link that skips to the main content, shown only while it has the focus", async () => {
    stubSession("signed-in");
    const { screen } = await renderApp("/");
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip.element().getBoundingClientRect().width).toBeLessThanOrEqual(1);

    await userEvent.keyboard("{Tab}");

    await expect.element(skip).toHaveFocus();
    const box = skip.element().getBoundingClientRect();
    expect([box.left, box.top]).toEqual([8, 8]);
    expect(box.height).toBe(36);
    // A primary button, over the sidebar: accent of the light theme.
    expect(getComputedStyle(skip.element()).backgroundColor).toBe(
      "rgb(9, 105, 218)",
    );
    expect(document.elementFromPoint(box.left + 4, box.top + 4)).toBe(
      skip.element(),
    );
  });

  test("moves the focus to the main content from the skip link", async () => {
    stubSession("signed-in");
    const { screen } = await renderApp("/");
    await userEvent.keyboard("{Tab}");
    await expect
      .element(screen.getByRole("link", { name: "Skip to main content" }))
      .toHaveFocus();

    await userEvent.keyboard("{Enter}");

    const main = screen.getByRole("main");
    await expect.element(main).toHaveFocus();
    // The focus ring inside it, in focus of the light theme.
    const style = getComputedStyle(main.element());
    expect([
      style.outlineStyle,
      style.outlineColor,
      style.outlineOffset,
    ]).toEqual(["solid", "rgb(9, 105, 218)", "-2px"]);
  });

  test("shows Not found at /auth/callback beside the sidebar", async () => {
    stubSession("signed-in");
    const { screen } = await renderApp("/auth/callback");

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("navigation", { name: "Main" }))
      .toBeVisible();
  });
});

describe("without a signed-in user", () => {
  test.each([
    ["Sign in", "/login", "Sign in"],
    ["Not found at /auth/callback", "/auth/callback", "Not found"],
  ])(
    "shows %s in the column of the Sign In Page, without the sidebar",
    async (_, path, heading) => {
      stubSession("none");
      const { screen } = await renderApp(path);
      const main = screen.getByRole("main");

      await expect
        .element(main.getByRole("heading", { level: 1, name: heading }))
        .toBeVisible();
      await expect
        .element(main.getByText("Sentinel", { exact: true }))
        .toBeVisible();
      await expect
        .element(screen.getByRole("navigation"))
        .not.toBeInTheDocument();
      await expect
        .element(screen.getByRole("link", { name: "Skip to main content" }))
        .not.toBeInTheDocument();
      // The column, 400 px wide, centered in the window.
      const column = main
        .getByText("Sentinel", { exact: true })
        .element()
        .getBoundingClientRect();
      expect([column.width, column.left + column.width / 2]).toEqual([
        400, 640,
      ]);
    },
  );
});

describe("the focus after a navigation", () => {
  test("stays at the top of the page on the first screen that the UI shows", async () => {
    stubSession("signed-in");
    await renderApp("/");

    expect(document.activeElement).toBe(document.body);
  });

  // In strict mode, as the entry point renders the application
  // (src/main.tsx), where React shows a screen with the timing of its
  // development build.
  test("stays at the top of the page when the UI leads at once from the URL that the page loaded to Sign in", async () => {
    stubSession("none");
    const router = createAppRouter({
      history: createMemoryHistory({ initialEntries: ["/tickets"] }),
    });
    const screen = await render(
      <StrictMode>
        <App router={router} queryClient={client} />
      </StrictMode>,
    );

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe("/login");
    expect(document.activeElement).toBe(document.body);
  });

  test("moves to the heading of Sign in when the UI leads there, and to the screen after the sign-in", async () => {
    const session = stubSession("signed-in");
    const { screen } = await renderApp("/tickets");
    session.active = false;
    await client
      .fetchQuery({
        queryKey: ["tickets"],
        queryFn: ({ signal }) =>
          apiRequest("/api/v1/tickets", { method: "GET", signal }),
      })
      .catch(() => undefined);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sign in" }))
      .toHaveFocus();

    await screen.getByRole("textbox", { name: "Username" }).fill("jdoe");
    await screen.getByLabelText("Password").fill("fictional password");
    await screen.getByRole("button", { name: "Sign in" }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
  });

  test("stays where it was when only the search of the screen changes", async () => {
    stubSession("signed-in");
    const { router, screen } = await renderApp("/tickets");
    const entry = screen
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "CVEs" });
    entry.element().focus();

    router.history.push("/tickets?page=2");

    await expect.poll(() => router.state.location.searchStr).toBe("?page=2");
    await expect.element(entry).toHaveFocus();
  });
});
