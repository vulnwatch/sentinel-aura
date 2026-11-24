import { focusManager, type QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import type { PlatformVersionResponse } from "../api/generated/model";
import { getGetPlatformVersionQueryKey } from "../api/generated/platform";
import { createQueryClient } from "../query-client";
import { createAppRouter } from "../router";
import { SESSION_RECORD_KEY } from "../session";
import {
  errorResponse,
  FICTIONAL_USER,
  jsonResponse,
  requestsTo,
  stubApi,
  type ApiResponder,
} from "../test-api";
import { releaseAddress } from "./about-dialog";

// About Sentinel, which the account menu opens (docs/screen-map.md, Sidebar;
// docs/design-system.md, Account Menu), at the browser's default text size,
// in the light theme.

// The version of the UI, which the build sets (vite.config.ts).
declare const SENTINEL_AURA_VERSION: string;

const ME = "/api/v1/users/me";
const VERSION = "/api/v1/version";
const SENTINEL_VERSION = "0.42.7";

let client: QueryClient;

function versionResponse(version = SENTINEL_VERSION): Response {
  const body: PlatformVersionResponse = { data: { version } };
  return jsonResponse(200, body);
}

// Signs in the user, answers Get Platform Version with the responder, and
// every other request with an empty list.
function stubSession(version: ApiResponder = () => versionResponse()) {
  return stubApi((request) => {
    if (request.path === ME) {
      return jsonResponse(200, FICTIONAL_USER);
    }
    if (request.path === VERSION) {
      return version(request);
    }
    return jsonResponse(200, { data: [] });
  });
}

beforeEach(async () => {
  client = createQueryClient();
  client.setQueryDefaults(getGetPlatformVersionQueryKey(), { retryDelay: 0 });
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await cleanup();
  client.clear();
  vi.restoreAllMocks();
  focusManager.setFocused(undefined);
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

// Shows a path that matches no screen, which shows Not found without
// reading anything else.
async function renderApp() {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: ["/fictional/path"] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
  return screen;
}

type Screen = Awaited<ReturnType<typeof renderApp>>;

// The account button of the sidebar beside the content, or of the sidebar
// opened over it.
function accountButton(screen: Screen, over = false) {
  const sidebar = over
    ? screen
        .getByRole("dialog", { name: "Navigation" })
        .getByRole("navigation", { name: "Main" })
    : screen.getByRole("navigation", { name: "Main" });
  return sidebar.getByRole("button", { name: "John Doe" });
}

// Opens About Sentinel from the account menu, and returns its dialog.
async function openAbout(screen: Screen, over = false) {
  await accountButton(screen, over).click();
  await screen
    .getByRole("menu", { name: "John Doe" })
    .getByRole("menuitem", { name: "About Sentinel" })
    .click();
  const dialog = screen.getByRole("dialog", { name: "About Sentinel" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

describe("releaseAddress", () => {
  test("leads to the GitHub Release of the version of the repository", () => {
    expect(releaseAddress("sentinel-aura", "0.11.0")).toBe(
      "https://github.com/vulnwatch/sentinel-aura/releases/tag/v0.11.0",
    );
    expect(releaseAddress("sentinel", "0.28.0")).toBe(
      "https://github.com/vulnwatch/sentinel/releases/tag/v0.28.0",
    );
  });

  test("holds the version only encoded, in its last path segment", () => {
    expect(releaseAddress("sentinel", "1.0.0/../../x?y#z")).toBe(
      "https://github.com/vulnwatch/sentinel/releases/tag/v1.0.0%2F..%2F..%2Fx%3Fy%23z",
    );
  });
});

describe("About Sentinel", () => {
  test("opens from the account menu once it has closed, as a dialog at most 400 px wide that takes the focus itself", async () => {
    stubSession();
    const screen = await renderApp();

    const dialog = await openAbout(screen);

    await expect.element(dialog).toHaveFocus();
    await expect
      .element(screen.getByRole("menu", { name: "John Doe" }))
      .not.toBeInTheDocument();
    expect(dialog.element().getBoundingClientRect().width).toBe(400);
    await expect
      .element(
        dialog.getByText("Include these versions when you report a problem."),
      )
      .toBeVisible();
    // Close is its only button.
    expect(
      dialog
        .getByRole("button")
        .all()
        .map((button) => button.element().textContent),
    ).toEqual(["Close"]);
  });

  test("shows the version of Sentinel Aura and the version of Sentinel, each a link to its release on another site", async () => {
    stubSession();
    const screen = await renderApp();

    const dialog = await openAbout(screen);

    const ui = dialog.getByRole("link", {
      name: `${SENTINEL_AURA_VERSION} (another site)`,
    });
    const sentinel = dialog.getByRole("link", {
      name: `${SENTINEL_VERSION} (another site)`,
    });
    await expect.element(sentinel).toBeVisible();
    await expect.element(ui).toBeVisible();
    expect(SENTINEL_AURA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    await expect
      .element(ui)
      .toHaveAttribute(
        "href",
        `https://github.com/vulnwatch/sentinel-aura/releases/tag/v${SENTINEL_AURA_VERSION}`,
      );
    await expect
      .element(sentinel)
      .toHaveAttribute(
        "href",
        `https://github.com/vulnwatch/sentinel/releases/tag/v${SENTINEL_VERSION}`,
      );
    // Each version after its term, Sentinel Aura first.
    const terms = dialog.getByRole("term").all();
    expect(terms.map((term) => term.element().textContent)).toEqual([
      "Sentinel Aura",
      "Sentinel",
    ]);
    const values = dialog.getByRole("definition").all();
    expect(values).toHaveLength(2);
    expect(values[0]?.element().contains(ui.element())).toBe(true);
    expect(values[1]?.element().contains(sentinel.element())).toBe(true);
  });

  test("encodes the version of Sentinel in the address of its release", async () => {
    stubSession(() => versionResponse("1.0.0/../x?y#z"));
    const screen = await renderApp();

    const dialog = await openAbout(screen);

    await expect
      .element(
        dialog.getByRole("link", { name: "1.0.0/../x?y#z (another site)" }),
      )
      .toHaveAttribute(
        "href",
        "https://github.com/vulnwatch/sentinel/releases/tag/v1.0.0%2F..%2Fx%3Fy%23z",
      );
  });

  test("reads the version of Sentinel each time it opens, and not again while it is open, also when the tab returns to the foreground", async () => {
    let version = SENTINEL_VERSION;
    const fetch = stubSession(() => versionResponse(version));
    const screen = await renderApp();
    let dialog = await openAbout(screen);
    await expect
      .element(
        dialog.getByRole("link", {
          name: `${SENTINEL_VERSION} (another site)`,
        }),
      )
      .toBeVisible();
    const userReads = requestsTo(fetch, ME);

    // Once no read is in progress, which the return would join rather than
    // read again.
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    focusManager.setFocused(false);
    focusManager.setFocused(true);

    // The signed-in user is read again, which shows that the return took
    // effect.
    await expect.poll(() => requestsTo(fetch, ME)).toBe(userReads + 1);
    await expect.poll(() => client.isFetching(), { interval: 0 }).toBe(0);
    expect(requestsTo(fetch, VERSION)).toBe(1);

    await userEvent.keyboard("{Escape}");
    await expect.element(dialog).not.toBeInTheDocument();
    version = "0.42.8";
    dialog = await openAbout(screen);

    await expect
      .element(dialog.getByRole("link", { name: "0.42.8 (another site)" }))
      .toBeVisible();
    expect(requestsTo(fetch, VERSION)).toBe(2);
  });

  test("shows the loading indicator in place of the version of Sentinel while it loads, beside the version of Sentinel Aura", async () => {
    let answer!: (response: Response) => void;
    stubSession(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    const screen = await renderApp();

    const dialog = await openAbout(screen);

    await expect
      .element(dialog.getByRole("progressbar", { name: "Loading" }))
      .toBeVisible();
    await expect
      .element(
        dialog.getByRole("link", {
          name: `${SENTINEL_AURA_VERSION} (another site)`,
        }),
      )
      .toBeVisible();
    answer(versionResponse());
    await expect
      .element(
        dialog.getByRole("link", {
          name: `${SENTINEL_VERSION} (another site)`,
        }),
      )
      .toBeVisible();
    await expect
      .element(dialog.getByRole("progressbar"))
      .not.toBeInTheDocument();
  });

  test("shows the failure of the read in place of the version of Sentinel, with Try again, which reads it again, and keeps the version of Sentinel Aura", async () => {
    let fail = true;
    const fetch = stubSession(() =>
      fail ? errorResponse(503, "SERVICE_UNAVAILABLE") : versionResponse(),
    );
    const screen = await renderApp();

    const dialog = await openAbout(screen);

    // In the status region that announces it.
    const status = dialog.getByRole("status");
    await expect
      .element(
        status.getByText(
          "Sentinel isn't available right now. Try again later.",
        ),
      )
      .toBeVisible();
    await expect
      .element(status.getByText("01890a5d-ac96-774b-bcce-b302099a8057"))
      .toBeVisible();
    await expect
      .element(
        dialog.getByRole("link", {
          name: `${SENTINEL_AURA_VERSION} (another site)`,
        }),
      )
      .toBeVisible();
    // The read and its two retries.
    expect(requestsTo(fetch, VERSION)).toBe(3);

    fail = false;
    await dialog.getByRole("button", { name: "Try again" }).click();

    await expect
      .element(
        dialog.getByRole("link", {
          name: `${SENTINEL_VERSION} (another site)`,
        }),
      )
      .toBeVisible();
    expect(requestsTo(fetch, VERSION)).toBe(4);
    // Try again left with the error, so the dialog takes the focus.
    await expect.element(dialog).toHaveFocus();
  });

  test("shows a failure that offers no Try again without it", async () => {
    stubSession(() => errorResponse(403, "AUTH_FORBIDDEN"));
    const screen = await renderApp();

    const dialog = await openAbout(screen);

    await expect
      .element(dialog.getByRole("status"))
      .toHaveTextContent("You don't have permission to do this.");
    await expect
      .element(dialog.getByRole("button", { name: "Try again" }))
      .not.toBeInTheDocument();
  });

  test.each([
    ["Close", () => page.getByRole("button", { name: "Close" }).click()],
    ["Escape", () => userEvent.keyboard("{Escape}")],
  ])(
    "closes with %s, and returns the focus to the account button",
    async (_, close) => {
      stubSession();
      const screen = await renderApp();
      const dialog = await openAbout(screen);
      await expect.element(dialog).toHaveFocus();

      await close();

      await expect.element(dialog).not.toBeInTheDocument();
      await expect.element(accountButton(screen)).toHaveFocus();
    },
  );

  test("returns the focus to the account button of the sidebar over the content, which stays open", async () => {
    await page.viewport(1023, 700);
    stubSession();
    const screen = await renderApp();
    await screen
      .getByRole("navigation", { name: "Main" })
      .getByRole("button", { name: "Expand navigation" })
      .click();
    const sidebar = screen.getByRole("dialog", { name: "Navigation" });
    await expect.element(sidebar).toBeVisible();
    const dialog = await openAbout(screen, true);
    await expect.element(dialog).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(accountButton(screen, true)).toHaveFocus();
    await expect.element(sidebar).toBeVisible();
  });
});
