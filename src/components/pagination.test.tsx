import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Pagination } from "./pagination";
import { RouterLinks } from "./router-links";
import { ScreenHeading } from "./screen-heading";

// The pagination of a list (docs/design-system.md, Lists), in the light
// theme.

function renderPagination(pageNumber: number, total: number) {
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => (
      <Pagination
        page={pageNumber}
        perPage={20}
        total={total}
        href={(target) =>
          target === 1
            ? "/"
            : linkOptions({ to: "/tickets", search: { page: target } })
        }
      />
    ),
  });
  const tickets = createRoute({
    getParentRoute: () => root,
    path: "/tickets",
    component: () => <p>Another page</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([list, tickets]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

test("shows the range in text-14 and fg-muted, then Previous and Next, 32 px high, at the end of the line", async () => {
  const screen = await renderPagination(2, 45);
  const range = screen.getByText("21–40 of 45");
  const previous = screen.getByRole("link", { name: "Previous" });
  const next = screen.getByRole("link", { name: "Next" });

  await expect.element(range).toBeVisible();
  expect(getComputedStyle(range.element()).fontSize).toBe("14px");
  expect(getComputedStyle(range.element()).color).toBe("rgb(89, 99, 110)");
  await expect.element(previous).toHaveAttribute("href", "/");
  await expect.element(next).toHaveAttribute("href", "/tickets?page=3");
  expect(previous.element().getBoundingClientRect().height).toBe(32);
  expect(next.element().getBoundingClientRect().left).toBeGreaterThan(
    previous.element().getBoundingClientRect().right,
  );
  const navigation = screen.getByRole("navigation", { name: "Pagination" });
  expect(
    navigation.element().getBoundingClientRect().right -
      next.element().getBoundingClientRect().right,
  ).toBeCloseTo(0);
});

test.each([
  ["Previous on the first page", 1, 45, "Previous", "1–20 of 45"],
  ["Next on the last page", 3, 45, "Next", "41–45 of 45"],
])("disables %s", async (_, pageNumber, total, name, range) => {
  const screen = await renderPagination(pageNumber, total);
  const link = screen.getByRole("link", { name });

  await expect.element(screen.getByText(range)).toBeVisible();
  await expect.element(link).toHaveAttribute("aria-disabled", "true");
  await expect.element(link).not.toHaveAttribute("href");
  expect(getComputedStyle(link.element()).opacity).toBe("0.6");
});

test("groups the thousands of the range", async () => {
  const screen = await renderPagination(63, 1250);

  await expect.element(screen.getByText("1,241–1,250 of 1,250")).toBeVisible();
});

test.each([
  ["a list of one page", 1, 20],
  ["a page beyond the last", 3, 40],
  ["an empty list", 1, 0],
])("shows nothing for %s", async (_, pageNumber, total) => {
  const screen = await renderPagination(pageNumber, total);

  expect(screen.getByRole("navigation").query()).toBeNull();
  expect(screen.container.textContent).toBe("");
});

test("moves the focus to the screen's heading when it leaves the page while it holds the focus", async () => {
  // Sets the number of records of the list, as a new read of it gives them.
  let setTotal!: (total: number) => void;
  function List() {
    const [total, set] = useState(45);
    useEffect(() => {
      setTotal = set;
    }, [set]);
    return (
      <>
        <ScreenHeading>Records</ScreenHeading>
        <Pagination
          page={1}
          perPage={20}
          total={total}
          href={(target) => (target === 1 ? "/" : "/users")}
        />
      </>
    );
  }
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const list = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: List,
  });
  const router = createRouter({
    routeTree: root.addChildren([list]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  const next = screen.getByRole("link", { name: "Next" });
  await expect.element(next).toBeVisible();
  next.element().focus();

  setTotal(10);

  await expect
    .element(screen.getByRole("navigation", { name: "Pagination" }))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Records" }))
    .toHaveFocus();
});
