import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { z } from "zod";
import "../styles.css";
import { Button } from "./button";
import { RouterLinks } from "./router-links";
import { ScreenHeading } from "./screen-heading";
import { Count, ViewTabs } from "./view-tabs";

// The views of a list as tabs (docs/design-system.md, Lists), in the light
// theme.

describe("Count", () => {
  test("shows the number in fg-muted with tabular figures, its thousands grouped", async () => {
    const screen = await render(<Count value={1250} failed={false} />);
    const count = screen.getByText("1,250");

    await expect.element(count).toBeVisible();
    expect(getComputedStyle(count.element()).color).toBe("rgb(89, 99, 110)");
    expect(getComputedStyle(count.element()).fontVariantNumeric).toBe(
      "tabular-nums",
    );
  });

  test("shows nothing while it loads", async () => {
    const screen = await render(
      <p>
        New <Count value={undefined} failed={false} />
      </p>,
    );

    expect(screen.container.textContent).toBe("New ");
  });

  test("shows an en dash read as Not available when its read failed, also after it showed a number", async () => {
    const screen = await render(
      <p>
        New <Count value={12} failed />
      </p>,
    );

    expect(screen.container.textContent).toBe("New –Not available");
    await expect
      .element(screen.getByText("–"))
      .toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("12").query()).toBeNull();
  });
});

// The views of the tests.
const VIEWS = [
  {
    id: "new",
    label: "New",
    href: linkOptions({ to: "/tickets", search: { view: "new" } }),
    count: <Count value={12} failed={false} />,
  },
  {
    id: "all",
    label: "All",
    href: "/tickets",
    count: <Count value={1250} failed={false} />,
  },
] as const;

interface ListProps {
  // The controls of the toolbar of the list, if it has any.
  toolbar?: ReactNode;
}

// The list, with the views of the tests, and without New when its URL has
// the fictional parameter without-new, as a view that a role decides.
function List({ toolbar }: ListProps) {
  const search = new URLSearchParams(
    useRouterState({ select: (state) => state.location.searchStr }),
  );
  const selected = search.get("view") ?? "all";
  const views = search.has("without-new")
    ? VIEWS.filter((view) => view.id !== "new")
    : VIEWS;
  return (
    <>
      <ScreenHeading>Records</ScreenHeading>
      <ViewTabs
        label="Views"
        selected={selected}
        views={views}
        toolbar={toolbar}
      >
        <p>{`The records of ${selected}`}</p>
      </ViewTabs>
    </>
  );
}

// A list at /tickets whose view is in the search parameter of its URL.
function renderList(path: string, toolbar?: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/tickets",
    validateSearch: z.object({ view: z.string().optional() }),
    component: () => <List toolbar={toolbar} />,
  });
  const router = createRouter({
    routeTree: root.addChildren([list]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return { router, rendered: render(<RouterProvider router={router} />) };
}

describe("ViewTabs", () => {
  test("shows each view as a tab that links to its address, its label followed by its count, and the panel of the selected one", async () => {
    const { rendered } = renderList("/tickets?view=new");
    const screen = await rendered;
    const tabs = screen.getByRole("tablist", { name: "Views" });

    await expect
      .element(screen.getByRole("tab", { name: "New 12" }))
      .toHaveAttribute("href", "/tickets?view=new");
    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toHaveAttribute("href", "/tickets");
    await expect
      .element(screen.getByRole("tab", { name: "New 12" }))
      .toHaveAttribute("aria-selected", "true");
    const panel = screen.getByRole("tabpanel", { name: "New 12" });
    await expect.element(panel).toHaveTextContent("The records of new");
    expect(
      panel.element().getBoundingClientRect().top -
        tabs.element().getBoundingClientRect().bottom,
    ).toBe(16);
  });

  test("draws the tabs 32 px high with a border line and a 6 px radius, the selected one with a border-strong boundary, on neutral-soft, at weight 600", async () => {
    const { rendered } = renderList("/tickets?view=new");
    const screen = await rendered;
    const selected = screen.getByRole("tab", { name: "New 12" }).element();
    const other = screen.getByRole("tab", { name: "All 1,250" }).element();

    await expect.element(screen.getByRole("tablist")).toBeVisible();
    const style = getComputedStyle(other);
    expect([
      other.getBoundingClientRect().height,
      style.borderTopColor,
      style.borderTopLeftRadius,
      style.fontSize,
      style.fontWeight,
    ]).toEqual([32, "rgb(216, 222, 228)", "6px", "14px", "400"]);
    const chosen = getComputedStyle(selected);
    expect([
      chosen.borderTopColor,
      chosen.backgroundColor,
      chosen.fontWeight,
    ]).toEqual(["rgb(129, 139, 152)", "rgb(239, 242, 245)", "600"]);
  });

  test("shows the panel of the view that another view opens, which its tab names", async () => {
    const { rendered } = renderList("/tickets?view=new");
    const screen = await rendered;
    const all = screen.getByRole("tab", { name: "All 1,250" });

    await all.click();

    const panel = screen.getByRole("tabpanel", { name: "All 1,250" });
    await expect.element(panel).toHaveTextContent("The records of all");
    expect(all.element().getAttribute("aria-controls")).toBe(
      panel.element().id,
    );
  });

  test("opens a view on a click, Enter, or Space, and not when the arrow keys move the focus to it", async () => {
    const { router, rendered } = renderList("/tickets?view=new");
    const screen = await rendered;
    const all = screen.getByRole("tab", { name: "All 1,250" });
    const fresh = screen.getByRole("tab", { name: "New 12" });

    await all.click();
    await expect.element(all).toHaveAttribute("aria-selected", "true");
    expect(router.state.location.href).toBe("/tickets");

    await userEvent.keyboard("{ArrowLeft}");
    await expect.element(fresh).toHaveFocus();
    expect(router.state.location.href).toBe("/tickets");

    await userEvent.keyboard("{Enter}");
    await expect.element(fresh).toHaveAttribute("aria-selected", "true");
    expect(router.state.location.href).toBe("/tickets?view=new");

    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");
    await expect.element(all).toHaveAttribute("aria-selected", "true");
    expect(router.state.location.href).toBe("/tickets");
    await expect.element(all).toHaveFocus();
  });
});

describe("the toolbar", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  afterEach(async () => {
    await page.viewport(414, 896);
  });

  // The controls of the toolbar of the tests.
  const TOOLBAR = (
    <>
      <Button size="small">Filters</Button>
      <Button size="small" variant="quiet">
        Clear filters
      </Button>
    </>
  );

  test("shows its controls after the tabs, on their row, at its end, with the panel 16 px below", async () => {
    const { rendered } = renderList("/tickets?view=new", TOOLBAR);
    const screen = await rendered;
    const tabs = screen.getByRole("tablist", { name: "Views" }).element();
    const all = screen.getByRole("tab", { name: "All 1,250" }).element();
    const filters = screen.getByRole("button", { name: "Filters" }).element();
    const clear = screen
      .getByRole("button", { name: "Clear filters" })
      .element();
    const panel = screen.getByRole("tabpanel", { name: "New 12" }).element();

    await expect.element(clear).toBeVisible();
    expect(filters.getBoundingClientRect().left).toBeGreaterThan(
      all.getBoundingClientRect().right,
    );
    expect(clear.getBoundingClientRect().left).toBeGreaterThan(
      filters.getBoundingClientRect().right,
    );
    expect(filters.getBoundingClientRect().top).toBe(
      tabs.getBoundingClientRect().top,
    );
    expect(clear.getBoundingClientRect().right).toBeCloseTo(
      panel.getBoundingClientRect().right,
    );
    expect(
      panel.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom,
    ).toBe(16);
  });

  test("wraps its controls below the tabs, 8 px apart, at the end of the line, when the width runs short", async () => {
    await page.viewport(320, 640);
    const { rendered } = renderList("/tickets?view=new", TOOLBAR);
    const screen = await rendered;
    const tabs = screen.getByRole("tablist", { name: "Views" }).element();
    const filters = screen.getByRole("button", { name: "Filters" }).element();
    const clear = screen
      .getByRole("button", { name: "Clear filters" })
      .element();
    const panel = screen.getByRole("tabpanel", { name: "New 12" }).element();

    await expect.element(clear).toBeVisible();
    expect(
      filters.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom,
    ).toBe(8);
    expect(clear.getBoundingClientRect().right).toBeCloseTo(
      panel.getBoundingClientRect().right,
    );
    expect(
      panel.getBoundingClientRect().top - clear.getBoundingClientRect().bottom,
    ).toBe(16);
  });

  test("adds nothing after the tabs without controls", async () => {
    const { rendered } = renderList("/tickets?view=new");
    const screen = await rendered;

    await expect
      .element(screen.getByRole("tabpanel", { name: "New 12" }))
      .toBeVisible();
    expect(screen.getByRole("button").query()).toBeNull();
    expect(screen.container.textContent).toBe(
      "RecordsNew 12All 1,250The records of new",
    );
  });
});

test("moves the focus to the screen's heading when a tab leaves the page while it holds the focus", async () => {
  const { router, rendered } = renderList("/tickets");
  const screen = await rendered;
  const fresh = screen.getByRole("tab", { name: "New 12" });
  await expect.element(fresh).toBeVisible();
  fresh.element().focus();

  router.history.push("/tickets?without-new");

  await expect.element(fresh).not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Records" }))
    .toHaveFocus();
});

test("keeps the focus on a tab that stays when another tab leaves the page", async () => {
  const { router, rendered } = renderList("/tickets");
  const screen = await rendered;
  const all = screen.getByRole("tab", { name: "All 1,250" });
  await expect.element(all).toBeVisible();
  all.element().focus();

  router.history.push("/tickets?without-new");

  await expect
    .element(screen.getByRole("tab", { name: /^New/ }))
    .not.toBeInTheDocument();
  await expect.element(all).toHaveFocus();
});
