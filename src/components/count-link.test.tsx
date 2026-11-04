import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { parseSearch, stringifySearch } from "../search-params";
import { CountLink } from "./count-link";
import { RouterLinks } from "./router-links";

// A count of the attention summary (docs/design-system.md, Lists; Other
// Values), in the light theme.

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE = "rgb(255, 255, 255)";
const SURFACE_HOVER = "rgb(243, 245, 248)";
const BORDER = "rgb(216, 222, 228)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";

// The address of the Tickets that the count counts, with a filter of several
// values.
const ACTIVE_P1_SEARCH: { status: ("new" | "analysis")[]; priority: "p1"[] } = {
  status: ["new", "analysis"],
  priority: ["p1"],
};
const ACTIVE_P1 = linkOptions({ to: "/tickets", search: ACTIVE_P1_SEARCH });

// The count at /, which links to /tickets, through a router that writes the
// search parameters as the UI's router does: Active P1, or a count of the
// group named overdue.
function renderCount(
  value: number | undefined,
  failed = false,
  {
    label = "Active P1",
    groupName,
  }: { label?: string; groupName?: string } = {},
) {
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const start = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <CountLink
        label={label}
        groupName={groupName}
        value={value}
        failed={failed}
        href={ACTIVE_P1}
      />
    ),
  });
  const tickets = createRoute({
    getParentRoute: () => root,
    path: "/tickets",
    component: () => <h1>Tickets page</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([start, tickets]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    parseSearch,
    stringifySearch,
  });
  return { router, rendered: render(<RouterProvider router={router} />) };
}

test("links through the router to the list of what it counts, named by its number and its label", async () => {
  const { router, rendered } = renderCount(3);
  const screen = await rendered;
  const link = screen.getByRole("link", { name: "3 Active P1", exact: true });

  await expect
    .element(link)
    .toHaveAttribute("href", "/tickets?status=new&status=analysis&priority=p1");
  await link.click();

  await expect
    .element(screen.getByRole("heading", { name: "Tickets page" }))
    .toBeVisible();
  expect(router.state.location.href).toBe(
    "/tickets?status=new&status=analysis&priority=p1",
  );
});

test("shows a number above zero at weight 600 in danger-on-soft, with tabular figures, its thousands grouped, then its label in fg-muted", async () => {
  const { rendered } = renderCount(1250);
  const screen = await rendered;
  const number = screen.getByText("1,250", { exact: true });

  await expect
    .element(screen.getByRole("link", { name: "1,250 Active P1", exact: true }))
    .toBeVisible();
  const style = getComputedStyle(number.element());
  expect([style.fontWeight, style.color, style.fontVariantNumeric]).toEqual([
    "600",
    DANGER_ON_SOFT,
    "tabular-nums",
  ]);
  expect(
    getComputedStyle(screen.getByText("Active P1", { exact: true }).element())
      .color,
  ).toBe(FG_MUTED);
});

test("shows zero at weight 600 in fg", async () => {
  const { rendered } = renderCount(0);
  const screen = await rendered;
  const number = screen.getByText("0", { exact: true });

  await expect
    .element(screen.getByRole("link", { name: "0 Active P1", exact: true }))
    .toBeVisible();
  const style = getComputedStyle(number.element());
  expect([style.fontWeight, style.color]).toEqual(["600", FG]);
});

test("shows its label alone while its number loads", async () => {
  const { rendered } = renderCount(undefined);
  const screen = await rendered;
  const link = screen.getByRole("link", { name: "Active P1", exact: true });

  await expect.element(link).toBeVisible();
  expect(link.element().textContent).toBe("Active P1");
});

test.each([
  ["before it showed a number", undefined],
  ["after it showed a number", 3],
])(
  "shows an en dash in fg-muted in place of its number when its read failed %s, read as not available",
  async (_, value) => {
    const { rendered } = renderCount(value, true);
    const screen = await rendered;
    const link = screen.getByRole("link", {
      name: "Active P1 not available",
      exact: true,
    });
    const dash = link.getByText("–", { exact: true });

    await expect.element(dash).toBeVisible();
    await expect.element(dash).toHaveAttribute("aria-hidden", "true");
    expect(getComputedStyle(dash.element()).color).toBe(FG_MUTED);
    expect(link.getByText("3").query()).toBeNull();
    // The words take no room on the screen.
    expect(
      link.getByText("not available").element().getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1);
  },
);

test("is 32 px high, in text-14, on surface with a border line and a 6 px radius, and on surface-hover under the pointer", async () => {
  const { rendered } = renderCount(3);
  const screen = await rendered;
  const link = screen.getByRole("link", { name: "3 Active P1" });
  await expect.element(link).toBeVisible();
  // Away from the pointer, which an earlier test can leave over it.
  await userEvent.unhover(link);

  const style = getComputedStyle(link.element());
  expect([
    link.element().getBoundingClientRect().height,
    style.fontSize,
    style.backgroundColor,
    style.borderTopWidth,
    style.borderTopColor,
    style.borderTopLeftRadius,
  ]).toEqual([32, "14px", SURFACE, "1px", BORDER, "6px"]);

  await userEvent.hover(link);

  await expect
    .poll(() => getComputedStyle(link.element()).backgroundColor)
    .toBe(SURFACE_HOVER);
});

test.each([
  ["with its number", 1, false, "1 Triage overdue"],
  ["while its number loads", undefined, false, "Triage overdue"],
  ["when its read failed", undefined, true, "Triage overdue not available"],
])(
  "shows in a group only its label, and is read with the name of the group %s",
  async (_, value, failed, name) => {
    const { rendered } = renderCount(value, failed, {
      label: "Triage",
      groupName: "overdue",
    });
    const screen = await rendered;
    const link = screen.getByRole("link", { name, exact: true });

    await expect.element(link).toBeVisible();
    await expect
      .element(link.getByText("Triage", { exact: true }))
      .toBeVisible();
    // The name of the group takes no room on the screen, so the link shows
    // only its number and its label.
    expect(
      link.getByText("overdue").element().getBoundingClientRect().width,
    ).toBeLessThanOrEqual(1);
  },
);
