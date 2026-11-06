import type { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { cleanup, render } from "vitest-browser-react";
import "../styles.css";
import { App } from "../app";
import { Capability } from "../api/generated/model";
import { createQueryClient } from "../query-client";
import { SIDEBAR_STORAGE_KEY } from "../preferences";
import { createAppRouter } from "../router";
import { SESSION_RECORD_KEY } from "../session";
import { FICTIONAL_USER, jsonResponse, stubApi, ticketPage } from "../test-api";

// The sidebar (docs/screen-map.md, Sidebar; docs/design-system.md, Sidebar),
// at the browser's default text size, in the light theme.

const ME = "/api/v1/users/me";

// The entries that every user sees, in their order, with their paths for a
// user without a capability.
const ENTRIES = [
  ["Tickets", "/tickets"],
  ["My packages", "/my-packages"],
  ["Users", "/users"],
  ["Fetchers", "/fetchers"],
] as const;
// A path that requires a session and matches no screen, so that it shows Not
// found and belongs to no entry.
const SCREEN = "/fictional/path";

let client: QueryClient;

beforeEach(async () => {
  client = createQueryClient();
  await page.viewport(1280, 800);
});

afterEach(async () => {
  // Before the responses go, so that the screen of the test reads nothing
  // more.
  await cleanup();
  client.clear();
  vi.restoreAllMocks();
  window.localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_RECORD_KEY);
  document.title = "Sentinel";
  await page.viewport(414, 896);
});

// Signs in the fictional user with the capabilities and the roles, as Get
// Current User returns them, an unlisted one included, and shows the screen
// at the path.
async function renderApp(
  path: string,
  capabilities: string[] = [],
  roles: string[] = [],
) {
  stubApi((request) =>
    request.path === ME
      ? jsonResponse(200, {
          data: { ...FICTIONAL_USER.data, capabilities, roles },
        })
      : ticketPage([]),
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
    const { screen } = await renderApp(SCREEN);
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
    const { screen } = await renderApp(SCREEN);
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
    const { screen } = await renderApp(SCREEN);
    const sidebar = sidebarOf(screen).element();

    expect(sidebar.scrollHeight).toBeGreaterThan(sidebar.clientHeight);
    expect(getComputedStyle(sidebar).overflowY).toBe("auto");
  });

  test.each([
    ["manage_users", ["manage_users"]],
    [
      "manage_users, with a capability that the pinned contract does not list",
      ["fictional_capability", "manage_users"],
    ],
  ])(
    "ends with Administration, which opens API keys, for a user who holds %s",
    async (_, capabilities) => {
      const { screen } = await renderApp(SCREEN, capabilities);
      const links = sidebarOf(screen).getByRole("list").getByRole("link");

      expect(links.all().map((link) => link.element().textContent)).toEqual([
        ...ENTRIES.map(([name]) => name),
        "Administration",
      ]);
      await expect
        .element(links.last())
        .toHaveAttribute("href", "/admin/api-keys");
    },
  );

  test.each([
    ["no capability", []],
    ["manage_settings alone", ["manage_settings"]],
    [
      "every other capability",
      Object.values(Capability).filter(
        (capability) => capability !== "manage_users",
      ),
    ],
    [
      "only a capability that the pinned contract does not list",
      ["fictional_capability"],
    ],
  ])("has no Administration for a user with %s", async (_, capabilities) => {
    const { screen } = await renderApp(SCREEN, capabilities);

    await expect
      .element(sidebarOf(screen).getByRole("link", { name: "Administration" }))
      .not.toBeInTheDocument();
    expect(
      sidebarOf(screen)
        .getByRole("list")
        .getByRole("link")
        .all()
        .map((link) => link.element().textContent),
    ).toEqual(ENTRIES.map(([name]) => name));
  });

  test.each([
    ["the screen of an area", "/tickets", "Tickets"],
    [
      "a path under an area",
      "/users/00000000-0000-0000-0000-000000000002",
      "Users",
    ],
    [
      "a path under an area, in another case",
      "/Fetchers/fictional-fetcher/runs/00000000-0000-0000-0000-000000000003",
      "Fetchers",
    ],
    ["the screen of My packages", "/my-packages", "My packages"],
    [
      "a screen of Administration",
      "/admin/identity-audit-log",
      "Administration",
    ],
  ])("marks the entry of %s as current", async (_, path, name) => {
    const { screen } = await renderApp(path, ["manage_users"]);
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
    [
      "the New view of the Ticket list for a user who holds triage_ticket",
      ["triage_ticket", "fictional_capability"],
      [],
      "/tickets?view=new",
    ],
    [
      "the All view for a user with every other capability, whatever the roles",
      [
        ...Object.values(Capability).filter(
          (capability) => capability !== "triage_ticket",
        ),
        "fictional_capability",
      ],
      ["admin", "vulnerability_analyst", "fictional_role"],
      "/tickets",
    ],
  ])("leads with Tickets to %s", async (_, capabilities, roles, href) => {
    const { router, screen } = await renderApp(SCREEN, capabilities, roles);
    const tickets = sidebarOf(screen).getByRole("link", { name: "Tickets" });

    await expect.element(tickets).toHaveAttribute("href", href);
    await tickets.click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
    expect(router.state.location.href).toBe(href);
    await expect.element(tickets).toHaveAttribute("aria-current", "page");
  });

  test.each([
    ["a screen of the user's own account", "/account/api-keys"],
    ["the address of a CVE", "/cves/CVE-2099-0001"],
    ["a path that starts like an area", "/ticketsandmore"],
  ])("marks no entry as current on %s", async (_, path) => {
    const { screen } = await renderApp(path, ["manage_users"]);

    await expect.element(sidebarOf(screen)).toBeVisible();
    expect(
      sidebarOf(screen).element().querySelectorAll('[aria-current="page"]'),
    ).toHaveLength(0);
  });

  test("shows no tooltip on an entry, whose name shows", async () => {
    const { screen } = await renderApp(SCREEN);
    const entry = sidebarOf(screen).getByRole("link", {
      name: "Users",
      exact: true,
    });
    sidebarOf(screen)
      .getByRole("link", { name: "My packages" })
      .element()
      .focus();

    await userEvent.keyboard("{Tab}");

    await expect.element(entry).toHaveFocus();
    await new Promise((resolve) => {
      setTimeout(resolve, 400);
    });
    expect(screen.getByRole("tooltip").query()).toBeNull();
  });

  test("leads to the screen of an entry and moves the focus to its heading", async () => {
    const { router, screen } = await renderApp(SCREEN);

    await sidebarOf(screen).getByRole("link", { name: "Users" }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
    expect(router.state.location.pathname).toBe("/users");
    await expect
      .element(sidebarOf(screen).getByRole("link", { name: "Users" }))
      .toHaveAttribute("aria-current", "page");
  });

  test("leads to the landing from the product name, and moves the focus to its heading", async () => {
    const { router, screen } = await renderApp(SCREEN);

    await sidebarOf(screen)
      .getByRole("link", { name: "Sentinel", exact: true })
      .click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toHaveFocus();
    expect(router.state.location.href).toBe("/tickets");
    expect(router.history.length).toBe(2);
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
      const link = sidebar.getByRole("link", { name, exact: true });
      await expect.element(link).toHaveAttribute("href", path);
      // The name names the entry, but takes no room.
      expect(
        widthOf(link.getByText(name, { exact: true }).element()),
      ).toBeLessThanOrEqual(1);
      const box = link.element().getBoundingClientRect();
      expect([box.width, box.height]).toEqual([40, 36]);
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
    const { screen } = await renderApp(SCREEN);

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
    const { screen } = await renderApp(SCREEN);
    const sidebar = sidebarOf(screen);
    const entry = sidebar.getByRole("link", { name: "Users" });

    entry.element().focus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}{Tab}");

    await expect.element(entry).toHaveFocus();
    const tooltip = screen.getByRole("tooltip", { name: "Users" });
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().getBoundingClientRect().left).toBeGreaterThan(
      entry.element().getBoundingClientRect().right,
    );
  });

  test("keeps the focus on the button that collapses and expands it", async () => {
    const { screen } = await renderApp(SCREEN);
    const collapse = sidebarOf(screen).getByRole("button", {
      name: "Collapse navigation",
    });
    collapse.element().focus();

    await userEvent.keyboard("{Enter}");

    const expand = sidebarOf(screen).getByRole("button", {
      name: "Expand navigation",
    });
    await expect.element(expand).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Collapse navigation" }),
      )
      .toHaveFocus();
  });

  test("leaves the focus where it was when another tab collapses it", async () => {
    const { screen } = await renderApp(SCREEN);
    const entry = sidebarOf(screen).getByRole("link", { name: "Users" });
    await expect.element(entry).toBeVisible();
    // An earlier switch in this tab, which took the focus.
    await sidebarOf(screen)
      .getByRole("button", { name: "Collapse navigation" })
      .click();
    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();
    sidebarOf(screen).getByRole("link", { name: "Users" }).element().focus();

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
    // The entry stays the same element, with the focus.
    await expect
      .element(sidebarOf(screen).getByRole("link", { name: "Users" }))
      .toHaveFocus();
  });

  test("follows a change of the preference in another tab", async () => {
    const { screen } = await renderApp(SCREEN);
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

  // The parsing of the stored value is tested with the preference
  // (src/preferences.test.ts).
  test.each(["Collapsed"])(
    "is expanded when the stored preference is %j",
    async (value) => {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, value);
      const { screen } = await renderApp(SCREEN);

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

// The center of the picture of a control of the sidebar: its icon, the
// Sentinel mark, or the avatar, which are hidden from assistive technologies
// and so are found as the first picture of their control.
function pictureCenter(control: Element): { x: number; y: number } {
  const picture = control.querySelector("svg");
  if (picture === null) {
    throw new Error("The control shows no picture");
  }
  const box = picture.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

test("moves none of its pictures when it collapses and expands", async () => {
  // A user with Administration, the last entry, and every other control.
  const { screen } = await renderApp("/tickets", ["manage_users"]);
  const controls = () => [
    sidebarOf(screen).getByRole("link", { name: "Sentinel" }),
    ...[...ENTRIES.map(([name]) => name), "Administration"].map((name) =>
      sidebarOf(screen).getByRole("link", { name, exact: true }),
    ),
    sidebarOf(screen).getByRole("button", { name: /navigation$/ }),
    sidebarOf(screen).getByRole("button", { name: "John Doe" }),
  ];
  const centers = () =>
    controls().map((control) => pictureCenter(control.element()));
  const expanded = centers();

  await sidebarOf(screen)
    .getByRole("button", { name: "Collapse navigation" })
    .click();
  await expect
    .element(
      sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
    )
    .toBeVisible();

  expect(centers()).toEqual(expanded);
  // On the axis of the collapsed sidebar, 28 px from its left edge.
  for (const { x } of expanded) {
    expect(x).toBe(28);
  }
});

describe("in a window narrower than 1024 px", () => {
  beforeEach(async () => {
    await page.viewport(1023, 700);
  });

  test("is always collapsed, whatever the preference", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "expanded");
    const { screen } = await renderApp(SCREEN);

    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
      )
      .toBeVisible();
    expect(widthOf(sidebarOf(screen).element())).toBe(56);
  });

  test("shows the focus inside the sidebar over the content when the keyboard opens it", async () => {
    const { screen } = await renderApp(SCREEN);
    // The keyboard reaches the expand button from the entry before it.
    sidebarOf(screen).getByRole("link", { name: "Fetchers" }).element().focus();
    await userEvent.keyboard("{Tab}");
    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
      )
      .toHaveFocus();

    await userEvent.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await expect.element(dialog).toHaveFocus();
    const style = getComputedStyle(dialog.element());
    // The focus ring inside it, in focus of the light theme.
    expect([
      style.outlineStyle,
      style.outlineColor,
      style.outlineOffset,
    ]).toEqual(["solid", "rgb(9, 105, 218)", "-2px"]);
  });

  test("opens the expanded sidebar over the content, as a dialog that takes the focus, without changing the preference", async () => {
    const { screen } = await renderApp(SCREEN);

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
      const { screen } = await renderApp(SCREEN);
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
    const { router, screen } = await renderApp(SCREEN);
    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });

    await dialog.getByRole("link", { name: "Users" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/users");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();
  });

  test("does not open again when the user returns to the URL at which it opened", async () => {
    const { router, screen } = await renderApp(SCREEN);
    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    await expect.element(dialog).toBeVisible();
    // A navigation that is not from it, such as the browser's Forward.
    router.history.push("/tickets");
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Tickets" }))
      .toBeVisible();
    await expect.element(dialog).not.toBeInTheDocument();

    router.history.back();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    expect(router.state.location.pathname).toBe(SCREEN);
    expect(screen.getByRole("dialog").query()).toBeNull();
  });

  test("closes after a navigation from it to the URL that shows", async () => {
    const { router, screen } = await renderApp("/users");
    await sidebarOf(screen)
      .getByRole("button", { name: "Expand navigation" })
      .click();
    const dialog = screen.getByRole("dialog", { name: "Navigation" });

    await dialog.getByRole("link", { name: "Users", exact: true }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/users");
  });

  test("closes when the window grows past 1024 px, with the focus on the screen's heading, and does not open again when it narrows", async () => {
    const { screen } = await renderApp(SCREEN);
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
    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toHaveFocus();

    await page.viewport(1023, 700);
    await expect
      .element(
        sidebarOf(screen).getByRole("button", { name: "Expand navigation" }),
      )
      .toBeVisible();
    expect(screen.getByRole("dialog").query()).toBeNull();
  });
});
