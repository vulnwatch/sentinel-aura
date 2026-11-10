import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouterState,
} from "@tanstack/react-router";
import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import {
  DetailTabList,
  DetailTabPanel,
  DetailTabs,
  type DetailTab,
} from "./detail-tabs";
import { RouterLinks } from "./router-links";

// The tabs of a detail screen, each at a path under the path of the screen
// (docs/design-system.md, Detail Screens), in the light theme.

afterEach(async () => {
  await page.viewport(414, 896);
});

// fg, fg-muted, link, and border of the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const LINK = "rgb(9, 105, 218)";
const BORDER = "rgb(216, 222, 228)";

const TABS: readonly DetailTab[] = [
  { id: "overview", label: "Overview", href: "/" },
  { id: "audit-log", label: "Audit log", href: "/tickets" },
];

// A screen of a router with two tabs, one at its path and one at another,
// compact or not, in a place wide enough for them or narrower.
async function renderTabs(compact = false, narrow = false) {
  function Screen() {
    const path = useRouterState({ select: (state) => state.location.pathname });
    const selected = path === "/" ? "overview" : "audit-log";
    return (
      <div className={narrow ? "w-24" : ""}>
        <DetailTabs selected={selected}>
          <DetailTabList
            label="Fictional record"
            tabs={TABS}
            compact={compact}
          />
          <DetailTabPanel selected={selected}>
            <p>The content of {selected}</p>
          </DetailTabPanel>
        </DetailTabs>
      </div>
    );
  }
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const routes = ["/", "/tickets"].map((path) =>
    createRoute({ getParentRoute: () => root, path, component: Screen }),
  );
  const router = createRouter({
    routeTree: root.addChildren(routes),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  return { router, screen };
}

test("shows each tab as a link to its address, in text-14 and fg-muted, 40 px high with 8 px of side padding, 16 px apart, above a border line", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderTabs();
  const overview = screen.getByRole("tab", { name: "Overview" });
  const auditLog = screen.getByRole("tab", { name: "Audit log" });

  await expect.element(auditLog).toHaveAttribute("href", "/tickets");
  const style = getComputedStyle(auditLog.element());
  expect([
    style.fontSize,
    style.color,
    style.height,
    style.paddingLeft,
    style.fontWeight,
  ]).toEqual(["14px", FG_MUTED, "40px", "8px", "400"]);
  expect(
    auditLog.element().getBoundingClientRect().left -
      overview.element().getBoundingClientRect().right,
  ).toBe(16);
  const list = screen.getByRole("tablist", { name: "Fictional record" });
  expect(getComputedStyle(list.element()).borderBottomColor).toBe(BORDER);
  // The panel follows 24 px below the line.
  expect(
    screen.getByRole("tabpanel").element().getBoundingClientRect().top -
      list.element().getBoundingClientRect().bottom,
  ).toBe(24);
});

test("shows the selected tab in fg at weight 600, over a bar of 2 px in link on the line", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderTabs();
  const overview = screen.getByRole("tab", { name: "Overview" });

  await expect.element(overview).toHaveAttribute("aria-selected", "true");
  const style = getComputedStyle(overview.element());
  expect([
    style.color,
    style.fontWeight,
    style.borderBottomWidth,
    style.borderBottomColor,
  ]).toEqual([FG, "600", "2px", LINK]);
  // On the line of the row, which the bar covers.
  const list = screen.getByRole("tablist").element().getBoundingClientRect();
  expect(overview.element().getBoundingClientRect().bottom).toBe(list.bottom);
});

test("is 36 px high in the compact heading, whose line is its own", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderTabs(true);

  const tab = screen.getByRole("tab", { name: "Audit log" }).element();
  expect(getComputedStyle(tab).height).toBe("36px");
  expect(
    getComputedStyle(screen.getByRole("tablist").element()).borderBottomWidth,
  ).toBe("0px");
});

test("opens a tab on a click, Enter, or Space, not when the arrow keys move the focus to it, and leaves the focus on it", async () => {
  await page.viewport(1280, 800);
  const { router, screen } = await renderTabs();
  const overview = screen.getByRole("tab", { name: "Overview" });
  const auditLog = screen.getByRole("tab", { name: "Audit log" });

  await userEvent.keyboard("{Tab}");
  await expect.element(overview).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");

  await expect.element(auditLog).toHaveFocus();
  expect(router.state.location.pathname).toBe("/");

  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByText("The content of audit-log"))
    .toBeVisible();
  expect(router.state.location.pathname).toBe("/tickets");
  await expect.element(auditLog).toHaveFocus();

  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(overview).toHaveFocus();
  expect(router.state.location.pathname).toBe("/tickets");
  await userEvent.keyboard(" ");

  await expect
    .element(screen.getByText("The content of overview"))
    .toBeVisible();
  expect(router.state.location.pathname).toBe("/");

  await auditLog.click();

  await expect
    .element(screen.getByText("The content of audit-log"))
    .toBeVisible();
  expect(
    screen.getByRole("tabpanel", { name: "Audit log" }).elements(),
  ).toHaveLength(1);
});

test("wraps its tabs where their place is too narrow, the line under their last row", async () => {
  const { screen } = await renderTabs(false, true);
  const list = screen.getByRole("tablist").element();

  const overview = screen.getByRole("tab", { name: "Overview" }).element();
  const auditLog = screen.getByRole("tab", { name: "Audit log" }).element();
  await expect
    .poll(() => auditLog.getBoundingClientRect().top)
    .toBeGreaterThanOrEqual(overview.getBoundingClientRect().bottom - 1);
  expect(auditLog.getBoundingClientRect().bottom).toBe(
    list.getBoundingClientRect().bottom,
  );
});
