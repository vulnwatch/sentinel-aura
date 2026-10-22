import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Link } from "react-aria-components";
import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { App } from "./app";
import { createAppRouter } from "./router";
import { RootLayout } from "./routes/root";

test("shows the home page at /", async () => {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <App router={router} queryClient={new QueryClient()} />,
  );

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
    .toBeVisible();
});

test("navigates through the router when a React Aria link is pressed", async () => {
  const root = createRootRoute({ component: RootLayout });
  const start = createRoute({
    getParentRoute: () => root,
    path: "/start",
    component: () => <Link href="/">Home</Link>,
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

  await screen.getByRole("link", { name: "Home" }).click();

  await expect
    .element(screen.getByRole("heading", { name: "Home page" }))
    .toBeVisible();
  expect(router.state.location.pathname).toBe("/");
});
