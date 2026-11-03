import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { RouterLinks } from "./router-links";
import { Link } from "./link";

test("leads to its screen through the router, underlined as a link of running text", async () => {
  const root = createRootRoute({
    component: () => (
      <RouterLinks>
        <Outlet />
      </RouterLinks>
    ),
  });
  const start = createRoute({
    getParentRoute: () => root,
    path: "/start",
    component: () => <Link href="/">Go to the start page</Link>,
  });
  const home = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <h1>Home page</h1>,
  });
  const router = createRouter({
    routeTree: root.addChildren([start, home]),
    history: createMemoryHistory({ initialEntries: ["/start"] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  const link = screen.getByRole("link", { name: "Go to the start page" });

  await expect.element(link).toHaveAttribute("href", "/");
  expect(getComputedStyle(link.element()).textDecorationLine).toBe("underline");
  await link.click();

  await expect
    .element(screen.getByRole("heading", { name: "Home page" }))
    .toBeVisible();
});

test("is underlined only under the pointer and on keyboard focus in a table or a list", async () => {
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
      <Link placement="list" href="/cves">
        CVE-2099-0001
      </Link>
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([list]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  const link = screen.getByRole("link", { name: "CVE-2099-0001" });
  const decoration = () => getComputedStyle(link.element()).textDecorationLine;

  await expect.element(link).toHaveAttribute("href", "/cves");
  // Away from the pointer, which an earlier test can leave over it.
  await userEvent.unhover(link);
  // link of the light theme.
  expect(getComputedStyle(link.element()).color).toBe("rgb(9, 105, 218)");
  await expect.poll(decoration).toBe("none");

  await link.hover();
  await expect.poll(decoration).toBe("underline");

  await userEvent.unhover(link);
  await expect.poll(decoration).toBe("none");
  await userEvent.keyboard("{Tab}");
  await expect.element(link).toHaveFocus();
  await expect.poll(decoration).toBe("underline");
});
