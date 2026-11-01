import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { RootLayout } from "../routes/root";
import { Link } from "./link";

test("leads to its screen through the router, underlined as a link of running text", async () => {
  const root = createRootRoute({ component: RootLayout });
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
