import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import { createQueryClient } from "../query-client";
import { SIDEBAR_STORAGE_KEY } from "../preferences";
import { createAppRouter } from "../router";
import { SESSION_RECORD_KEY } from "../session";
import { FICTIONAL_USER, jsonResponse, stubApi } from "../test-api";

// The sidebar (docs/screen-map.md, Sidebar; docs/design-system.md, Sidebar),
// at the browser's default text size, in the light theme.

const ME = "/api/v1/users/me";

// The entries that every user sees, in their order, with their paths.
const ENTRIES = [
  ["Tickets", "/tickets"],
  ["CVEs", "/cves"],
  ["Packages", "/packages"],
  ["Products", "/products"],
  ["My packages", "/my-packages"],
  ["Data sources", "/data-sources"],
] as const;

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  await page.viewport(1280, 800);
});

afterEach(async () => {
  client.clear();
  vi.restoreAllMocks();
  window.localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

// Signs in the fictional user with the capabilities, as Get Current User
// returns them, an unlisted one included, and shows the screen at the path.
async function renderApp(path: string, capabilities: string[] = []) {
  stubApi((request) =>
    request.path === ME
      ? jsonResponse(200, {
          data: { ...FICTIONAL_USER.data, capabilities },
        })
      : jsonResponse(200, { data: [] }),
  );
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<App router={router} queryClient={client} />);
  await expect.element(screen.getByRole("heading", { level: 1 })).toBeVisible();
  return { router, screen };
}

function sidebarOf(screen: Awaited<ReturnType<typeof renderApp>>["screen"]) {
  return screen.getByRole("navigation", { name: "Main" });
}

function widthOf(element: Element): number {
  return element.getBoundingClientRect().width;
}

describe("expanded", () => {
  test("shows the product name, the entries in their order, and the account button, beside the content", async () => {
    const { screen } = await renderApp("/");
    const sidebar = sidebarOf(screen);

    await expect.element(sidebar).toBeVisible();
    expect(widthOf(sidebar.element())).toBe(216);
    expect(
      screen.getByRole("main").element().getBoundingClientRect().left,
    ).toBe(216);
    await expect
      .element(sidebar.getByRole("link", { name: "Sentinel", exact: true }))
      .toHaveAttribute("href", "/");
    const links = sidebar.getByRole("list").getByRole("link").all();
    expect(links.map((link) => link.element().textContent)).toEqual(
      ENTRIES.map(([name]) => name),
    );
    expect(links.map((link) => link.element().getAttribute("href"))).toEqual(
      ENTRIES.map(([, path]) => path),
    );
    await expect
      .element(sidebar.getByRole("button", { name: "John Doe" }))
      .toBeVisible();
  });

  test("stays in place while the content scrolls, the full height of the window", async () => {
    const { screen } = await renderApp("/");
    const sidebar = sidebarOf(screen).element();
    document.body.style.height = "3000px";
    try {
      window.scrollTo(0, 500);
      await expect.poll(() => window.scrollY).toBe(500);

      const box = sidebar.getBoundingClientRect();
      expect([box.top, box.height]).toEqual([0, 800]);
    } finally {
      document.body.style.removeProperty("height");
      window.scrollTo(0, 0);
    }
  });

  test("scrolls within itself when the window is shorter than the sidebar", async () => {
    await page.viewport(1280, 300);
    const { screen } = await renderApp("/");
    const sidebar = sidebarOf(screen).element();

    expect(sidebar.scrollHeight).toBeGreaterThan(sidebar.clientHeight);
    expect(getComputedStyle(sidebar).overflowY).toBe("auto");
  });

  test.each([
    ["manage_users", ["manage_users"], "/admin/users"],
    ["manage_settings", ["manage_settings"], "/admin/settings"],
    [
      "both, with a capability that the pinned contract does not list",
      ["fictional_capability", "manage_settings", "manage_users"],
      "/admin/users",
    ],
  ])(
    "ends with Administration for a user who holds %s",
    async (_, capabilities, path) => {
      const { screen } = await renderApp("/", capabilities);
      const links = sidebarOf(screen).getByRole("list").getByRole("link");

      await expect.element(links.last()).toHaveAccessibleName("Administration");
      await expect.element(links.last()).toHaveAttribute("href", path);
    },
  );

  test.each([
    ["no capability", []],
    ["another capability", ["create_ticket", "manage_fetchers"]],
    [
      "only a capability that the pinned contract does not list",
      ["fictional_capability"],
    ],
  ])("has no Administration for a user with %s", async (_, capabilities) => {
    const { screen } = await renderApp("/", capabilities);

    await expect
      .element(sidebarOf(screen).getByRole("link", { name: "Administration" }))
      .not.toBeInTheDocument();
  });

  test.each([
    ["the screen of an area", "/tickets", "Tickets"],
    [
      "a path under an area, in another case",
      "/Data-Sources/fetchers/kev",
      "Data sources",
    ],
    ["a screen of Administration", "/admin/settings", "Administration"],
  ])("marks the entry of %s as current", async (_, path, name) => {
    const { screen } = await renderApp(path, ["manage_settings"]);
    const current = sidebarOf(screen).getByRole("link", { name });

    await expect.element(current).toHaveAttribute("aria-current", "page");
    // sidebar-active of the light theme.
    expect(getComputedStyle(current.element()).backgroundColor).toBe(
      "rgb(234, 238, 242)",
    );
    expect(getComputedStyle(current.element()).fontWeight).toBe("600");
    expect(
      sidebarOf(screen).element().querySelectorAll('[aria-current="page"]'),
    ).toHaveLength(1);
  });

  test.each([
    ["the Home", "/"],
    ["a screen of the user's own account", "/account"],
    ["a path that starts like an area", "/ticketsandmore"],
  ])("marks no entry as current on %s", async (_, path) => {
    const { screen } = await renderApp(path);

    await expect.element(sidebarOf(screen)).toBeVisible();
    expect(
      sidebarOf(screen).element().querySelectorAll('[aria-current="page"]'),
    ).toHaveLength(0);
  });

  test("leads to the screen of an entry and moves the focus to its heading", async () => {
    const { router, screen } = await renderApp("/");

    await sidebarOf(screen).getByRole("link", { name: "CVEs" }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
    expect(router.state.location.pathname).toBe("/cves");
    await expect
      .element(sidebarOf(screen).getByRole("link", { name: "CVEs" }))
      .toHaveAttribute("aria-current", "page");
  });

  test("leads to the landing from the product name", async () => {
    const { router, screen } = await renderApp("/tickets");

    await sidebarOf(screen)
      .getByRole("link", { name: "Sentinel", exact: true })
      .click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Home" }))
      .toHaveFocus();
    expect(router.state.location.pathname).toBe("/");
  });
});

describe("collapsed", () => {
  test("collapses to icons named by their entries, and keeps the preference", async () => {
    const { screen } = await renderApp("/tickets");

    await sidebarOf(screen)
      .getByRole("button", { name: "Collapse navigation" })
      .click();

    const sidebar = sidebarOf(screen);
    await expect
      .element(sidebar.getByRole("button", { name: "Expand navigation" }))
      .toBeVisible();
    expect(widthOf(sidebar.element())).toBe(56);
    expect(
      screen.getByRole("main").element().getBoundingClientRect().left,
    ).toBe(56);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    for (const [name, path] of ENTRIES) {
      const link = sidebar.getByRole("link", { name });
      await expect.element(link).toHaveAttribute("href", path);
      expect(link.element().textContent).toBe("");
      expect(widthOf(link.element())).toBe(40);
    }
    await expect
      .element(sidebar.getByRole("link", { name: "Tickets" }))
      .toHaveAttribute("aria-current", "page");
    await expect
      .element(sidebar.getByRole("link", { name: "Sentinel" }))
      .toHaveAttribute("href", "/");
    await expect
      .element(sidebar.getByRole("button", { name: "John Doe" }))
      .toBeVisible();
  });

  test("expands again, and keeps the preference", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    const { screen } = await renderApp("/");

    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();

    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Collapse navigation" }),
      )
      .toBeVisible();
    expect(widthOf(sidebarOf(screen).element())).toBe(216);
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("expanded");
  });

  test("shows the name of a control in a tooltip to its right on keyboard focus", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    const { screen } = await renderApp("/");
    const sidebar = sidebarOf(screen);
    const entry = sidebar.getByRole("link", { name: "CVEs" });

    entry.element().focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}{Tab}");

    await expect.element(entry).toHaveFocus();
    const tooltip = screen.getByRole("tooltip", { name: "CVEs" });
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().getBoundingClientRect().left).toBeGreaterThan(
      entry.element().getBoundingClientRect().right,
    );
  });

  test("follows a change of the preference in another tab", async () => {
    const { screen } = await renderApp("/");
    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Collapse navigation" }),
      )
      .toBeVisible();

    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SIDEBAR_STORAGE_KEY,
        newValue: "collapsed",
      }),
    );

    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
      )
      .toBeVisible();
  });

  test.each(["hidden", "Collapsed", ""])(
    "is expanded when the stored preference is %j",
    async (value) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value);
      const { screen } = await renderApp("/");

      await expect
        .element(
          sidebarOf(screen).getByRole("button", {
            name: "Collapse navigation",
          }),
        )
        .toBeVisible();
    },
  );
});

describe("in a window narrower than 1024 px", () => {
  beforeEach(async () => {
    await page.viewport(1023, 700);
  });

  test("is always collapsed, whatever the preference", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "expanded");
    const { screen } = await renderApp("/");

    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
      )
      .toBeVisible();
    expect(widthOf(sidebarOf(screen).element())).toBe(56);
  });

  test("opens the expanded sidebar over the content, as a dialog that takes the focus, without changing the preference", async () => {
    const { screen } = await renderApp("/");

    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();

    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await expect.element(dialog).toBeVisible();
    expect(dialog.element().contains(document.activeElement)).toBe(true);
    const sidebar = dialog.getByRole("navigation", { name: "Main" });
    expect(widthOf(sidebar.element())).toBe(216);
    await expect
      .element(sidebar.getByRole("link", { name: "Tickets" }))
      .toHaveTextContent("Tickets");
    await expect
      .element(sidebar.getByRole("button", { name: "Close navigation" }))
      .toBeVisible();
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBeNull();
    // The content keeps its place beside the collapsed sidebar.
    expect(
      screen
        .getByRole("main", { includeHidden: true })
        .element()
        .getBoundingClientRect().left,
    ).toBe(56);
  });

  test.each([
    ["Escape", () => userEvent.keyboard("{Escape}")],
    [
      "its close button",
      () =>
        page
          .getByRole("dialog", { name: "Navigation" })
          .getByRole("button", { name: "Close navigation" })
          .click(),
    ],
    [
      "a click outside it",
      () => userEvent.click(document.body, { position: { x: 600, y: 300 } }),
    ],
  ])(
    "closes with %s, and returns the focus to the expand button",
    async (_, close) => {
      const { screen } = await renderApp("/");
      const expand = sidebarOf(screen).getByRole("button", {
        name: "Expand navigation",
      });
      expand.element().focus();
      await userEvent.keyboard("{Enter}");
      await expect
        .element(screen.getByRole("dialog", { name: "Navigation" }))
        .toBeVisible();

      await close();

      await expect
        .element(screen.getByRole("dialog", { name: "Navigation" }))
        .not.toBeInTheDocument();
      await expect.element(expand).toHaveFocus();
    },
  );

  test("closes after a navigation from it, and the focus follows the navigation", async () => {
    const { router, screen } = await renderApp("/");
    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });

    await dialog.getByRole("link", { name: "Packages" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/packages");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
  });

  test("closes when the window grows past 1024 px, and does not open again when it narrows", async () => {
    const { screen } = await renderApp("/");
    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();
    await expect
      .element(screen.getByRole("dialog", { name: "Navigation" }))
      .toBeVisible();

    await page.viewport(1280, 700);
    await expect
      .element(screen.getByRole("dialog", { name: "Navigation" }))
      .not.toBeInTheDocument();
    expect(widthOf(sidebarOf(screen).element())).toBe(216);

    await page.viewport(1023, 700);
    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
      )
      .toBeVisible();
    expect(screen.getByRole("dialog").query()).toBeNull();
  });
});
