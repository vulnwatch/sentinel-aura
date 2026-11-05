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
import { screenshot } from "../test-screenshot";
import { Button } from "./button";
import { RouterLinks } from "./router-links";
import { ScreenHeading } from "./screen-heading";
import { Count, ViewTabs, type View } from "./view-tabs";

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

// The views of the tests with a group: All, after New and Unassigned.
const GROUPED: readonly View[] = [
  VIEWS[0],
  {
    id: "unassigned",
    label: "Unassigned",
    href: linkOptions({ to: "/tickets", search: { view: "unassigned" } }),
    count: <Count value={1} failed={false} />,
  },
  { ...VIEWS[1], startsGroup: true },
];

interface ListProps {
  // The controls of the toolbar of the list, if it has any.
  toolbar?: ReactNode;
  // The views of the list, those of the tests unless given.
  views?: readonly View[];
}

// The list, with the views of the tests, and without New when its URL has
// the fictional parameter without-new, as a view that not every user is
// shown.
function List({ toolbar, views: all = VIEWS }: ListProps) {
  const search = new URLSearchParams(
    useRouterState({ select: (state) => state.location.searchStr }),
  );
  const selected = search.get("view") ?? "all";
  const views = search.has("without-new")
    ? all.filter((view) => view.id !== "new")
    : all;
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
function renderList(
  path: string,
  toolbar?: ReactNode,
  views?: readonly View[],
) {
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
    component: () => <List toolbar={toolbar} views={views} />,
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

// The width of an element.
function widthOf(element: Element): number {
  return element.getBoundingClientRect().width;
}

// The widths of the tabs and of the controls at 1280 px, where they share
// one row, and the left edge of the toolbar, to set a window in which the
// row holds only some of them.
async function widthsOf(screen: Awaited<ReturnType<typeof render>>) {
  const clear = screen.getByRole("button", { name: "Clear filters" });
  await expect.element(clear).toBeVisible();
  const tabs = screen.getByRole("tablist", { name: "Views" }).element();
  return {
    left: tabs.getBoundingClientRect().left,
    tabs: widthOf(tabs),
    filters: widthOf(screen.getByRole("button", { name: "Filters" }).element()),
    clear: widthOf(clear.element()),
  };
}

// The window whose toolbar is the given width.
async function toolbarOf(left: number, width: number) {
  await page.viewport(Math.floor(2 * left + width), 640);
}

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

  test("wraps the last control alone when only it runs out of room, at the end of the next row, 8 px below, and moves no other", async () => {
    const { rendered } = renderList("/tickets?view=new", TOOLBAR);
    const screen = await rendered;
    const widths = await widthsOf(screen);

    await toolbarOf(
      widths.left,
      widths.tabs + 8 + widths.filters + 8 + widths.clear - 4,
    );

    const tabs = screen.getByRole("tablist", { name: "Views" }).element();
    const filters = screen.getByRole("button", { name: "Filters" }).element();
    const clear = screen
      .getByRole("button", { name: "Clear filters" })
      .element();
    const panel = screen.getByRole("tabpanel", { name: "New 12" }).element();
    await expect
      .poll(() => clear.getBoundingClientRect().top)
      .toBeGreaterThan(tabs.getBoundingClientRect().top);
    expect(filters.getBoundingClientRect().top).toBe(
      tabs.getBoundingClientRect().top,
    );
    expect(filters.getBoundingClientRect().right).toBeCloseTo(
      panel.getBoundingClientRect().right,
    );
    expect(
      clear.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom,
    ).toBe(8);
    expect(clear.getBoundingClientRect().right).toBeCloseTo(
      panel.getBoundingClientRect().right,
    );
    expect(
      panel.getBoundingClientRect().top - clear.getBoundingClientRect().bottom,
    ).toBe(16);
  });

  test("wraps its controls together below the tabs, 8 px apart, at the end of the row, when none fits after the tabs", async () => {
    const { rendered } = renderList("/tickets?view=new", TOOLBAR);
    const screen = await rendered;
    const widths = await widthsOf(screen);

    await toolbarOf(widths.left, widths.tabs + 8 + widths.filters - 4);

    const tabs = screen.getByRole("tablist", { name: "Views" }).element();
    const filters = screen.getByRole("button", { name: "Filters" }).element();
    const clear = screen
      .getByRole("button", { name: "Clear filters" })
      .element();
    const panel = screen.getByRole("tabpanel", { name: "New 12" }).element();
    await expect
      .poll(() => filters.getBoundingClientRect().top)
      .toBeGreaterThan(tabs.getBoundingClientRect().top);
    expect(tabs.getBoundingClientRect().left).toBe(widths.left);
    expect(
      filters.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom,
    ).toBe(8);
    expect(clear.getBoundingClientRect().top).toBe(
      filters.getBoundingClientRect().top,
    );
    expect(
      clear.getBoundingClientRect().left -
        filters.getBoundingClientRect().right,
    ).toBeCloseTo(8);
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

    // Not even room below the tabs where they take their whole line, as in a
    // window too narrow for them: the panel stays 16 px below them.
    await page.viewport(140, 640);
    const tabs = screen.getByRole("tablist", { name: "Views" }).element();
    const panel = screen.getByRole("tabpanel", { name: "New 12" }).element();
    await expect
      .poll(() => tabs.getBoundingClientRect().height)
      .toBeGreaterThan(32);
    expect(
      panel.getBoundingClientRect().top - tabs.getBoundingClientRect().bottom,
    ).toBe(16);
  });
});

// border, the color of the line of a group, and canvas, the page, in the
// light theme.
const BORDER = "#d8dee4";
const CANVAS = "#f6f8fa";

// The box of a tab.
function boxOf(screen: Awaited<ReturnType<typeof render>>, name: string) {
  return screen.getByRole("tab", { name }).element().getBoundingClientRect();
}

// The colors of the pixels from one point of the tabs to another along a row
// or a column, one each CSS pixel, from the middle of each.
async function pixelsOf(
  screen: Awaited<ReturnType<typeof render>>,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<string[]> {
  const tabs = screen.getByRole("tablist", { name: "Views" });
  const picture = await screenshot(tabs);
  const box = tabs.element().getBoundingClientRect();
  const length = Math.round(Math.max(to.x - from.x, to.y - from.y));
  const across = to.x - from.x > to.y - from.y;
  return Array.from({ length }, (_, index) =>
    picture.at(
      from.x - box.left + (across ? index + 0.5 : 0),
      from.y - box.top + (across ? 0 : index + 0.5),
    ),
  );
}

describe("a group of views", () => {
  beforeEach(async () => {
    await page.viewport(1280, 800);
  });

  afterEach(async () => {
    await page.viewport(414, 896);
  });

  test("sets its first tab apart with a line of 1 px in border, 20 px high, 12 px from the tabs before and after it, which assistive technologies do not perceive", async () => {
    const { rendered } = renderList("/tickets?view=new", undefined, GROUPED);
    const screen = await rendered;
    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toBeVisible();
    // Measured once the font has loaded, which changes the width of the
    // labels.
    await document.fonts.ready;
    const fresh = boxOf(screen, "New 12");
    const unassigned = boxOf(screen, "Unassigned 1");
    const all = boxOf(screen, "All 1,250");
    const middle = all.top + all.height / 2;

    // The tabs of a group are 8 px apart, and the line stands in a gap of
    // 25 px.
    expect(unassigned.left - fresh.right).toBeCloseTo(8);
    expect(all.left - unassigned.right).toBeCloseTo(25);
    // Within the gap, away from the borders of the tabs: one column of the
    // line, 12 px after Unassigned, and the page on either side.
    const gap = await pixelsOf(
      screen,
      { x: unassigned.right + 2, y: middle },
      { x: all.left - 2, y: middle },
    );
    expect(gap.filter((color) => color === BORDER)).toHaveLength(1);
    expect(gap.filter((color) => color === CANVAS)).toHaveLength(
      gap.length - 1,
    );
    // The middle of the column of the line, where the row read it.
    const line = unassigned.right + 2 + gap.indexOf(BORDER) + 0.5;
    expect(Math.abs(line - unassigned.right - 12.5)).toBeLessThanOrEqual(1);
    // 20 px of the height of the tabs, centered.
    const column = await pixelsOf(
      screen,
      { x: line, y: all.top },
      { x: line, y: all.bottom },
    );
    expect(column.filter((color) => color === BORDER)).toHaveLength(20);
    expect(column.slice(0, 6).concat(column.slice(26))).toEqual(
      Array.from({ length: 12 }, () => CANVAS),
    );
    // No line between the tabs of a group.
    const before = await pixelsOf(
      screen,
      { x: fresh.right + 2, y: middle },
      { x: unassigned.left - 2, y: middle },
    );
    expect(before.every((color) => color === CANVAS)).toBe(true);
    // The line adds no text to the tabs or their names.
    expect(
      screen.getByRole("tablist", { name: "Views" }).element().textContent,
    ).toBe("New 12Unassigned 1All 1,250");
    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toHaveAccessibleName("All 1,250");
  });

  test("keeps the line before the first tab of its group when the tab starts a row", async () => {
    const { rendered } = renderList("/tickets?view=new", undefined, GROUPED);
    const screen = await rendered;
    await expect
      .element(screen.getByRole("tab", { name: "All 1,250" }))
      .toBeVisible();
    // Measured once the font has loaded, which changes the width of the
    // labels.
    await document.fonts.ready;
    const tabs = screen.getByRole("tablist", { name: "Views" }).element();
    const left = tabs.getBoundingClientRect().left;
    const fresh = boxOf(screen, "New 12");
    const unassigned = boxOf(screen, "Unassigned 1");

    // Room for New and Unassigned alone.
    await page.viewport(
      Math.floor(2 * left + unassigned.right - left + 40),
      640,
    );

    await expect
      .poll(() => boxOf(screen, "All 1,250").top)
      .toBeGreaterThan(fresh.bottom);
    const all = boxOf(screen, "All 1,250");
    // The tab keeps its place after the line, 13 px after it.
    expect(all.left - left).toBeCloseTo(17);
    const start = await pixelsOf(
      screen,
      { x: left, y: all.top + all.height / 2 },
      { x: all.left - 2, y: all.top + all.height / 2 },
    );
    expect(start.filter((color) => color === BORDER)).toHaveLength(1);
    expect(Math.abs(start.indexOf(BORDER) - 4)).toBeLessThanOrEqual(1);
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
