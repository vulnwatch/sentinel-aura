import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useState } from "react";
import { Link } from "react-aria-components";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import { z } from "zod";
import { App } from "./app";
import { Button } from "./components/button";
import { createAppRouter, routerDefaults } from "./router";
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

test("follows the URL of the browser by default", () => {
  const url = window.location.href;
  window.history.replaceState(window.history.state, "", "/?from=browser#top");
  try {
    expect(createAppRouter().history.location.href).toBe("/?from=browser#top");
  } finally {
    window.history.replaceState(window.history.state, "", url);
  }
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

function renderApp(path: string) {
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<App router={router} queryClient={new QueryClient()} />);
}

describe("Not found", () => {
  afterEach(() => {
    document.title = "Sentinel";
  });

  test.each([
    ["a path that matches no screen", "/fictional/path"],
    ["/auth/callback, which is reserved", "/auth/callback?code=fictional"],
  ])("shows at %s", async (_, path) => {
    const screen = await renderApp(path);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(
        screen.getByText(
          "This page doesn't exist, or you don't have access to it.",
        ),
      )
      .toBeVisible();
    expect(document.title).toBe("Not found – Sentinel");
    await expect.element(screen.getByRole("main")).toBeVisible();
  });

  test("leads to the landing", async () => {
    const screen = await renderApp("/fictional/path");

    await screen.getByRole("link", { name: "Go to the start page" }).click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Sentinel Aura" }))
      .toBeVisible();
    expect(document.title).toBe("Sentinel");
  });
});

function FailingScreen(): never {
  throw new TypeError("Cannot read properties of undefined");
}

test("shows the page of a failure of the UI when a screen fails", async () => {
  const root = createRootRoute({ component: RootLayout });
  const failing = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: FailingScreen,
  });
  const router = createRouter({
    routeTree: root.addChildren([failing]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    ...routerDefaults,
  });
  const screen = await render(<RouterProvider router={router} />);

  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
    )
    .toBeVisible();
  await expect
    .element(
      screen.getByText(
        "This page couldn't be shown. Reload the page to try again.",
      ),
    )
    .toBeVisible();
  await expect
    .element(screen.getByRole("button", { name: "Reload page" }))
    .toBeVisible();
  expect(document.title).toBe("Something went wrong – Sentinel");
});

// A screen whose control makes it fail.
function BreakingScreen() {
  const [broken, setBroken] = useState(false);
  if (broken) {
    throw new TypeError("Cannot read properties of undefined");
  }
  return (
    <Button
      onPress={() => {
        setBroken(true);
      }}
    >
      Break
    </Button>
  );
}

test("moves the focus to the heading of the page of a failure of the UI when the failure removes the control that the user used", async () => {
  const root = createRootRoute({ component: RootLayout });
  const breaking = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: BreakingScreen,
  });
  const router = createRouter({
    routeTree: root.addChildren([breaking]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
    ...routerDefaults,
  });
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(screen.getByRole("button", { name: "Break" }))
    .toBeVisible();

  await userEvent.keyboard("{Tab}");
  await expect
    .element(screen.getByRole("button", { name: "Break" }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");

  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
    )
    .toHaveFocus();
});

test("starts a screen again when it opens with other path parameters, but not with other search parameters", async () => {
  const root = createRootRoute({ component: RootLayout });
  const record = createRoute({
    getParentRoute: () => root,
    path: "/records/$recordId",
    validateSearch: z.object({ page: z.number().optional() }),
    component: RecordScreen,
  });
  // How many times the screen has started.
  let starts = 0;
  // The record and the page that the screen shows, and when it started.
  function RecordScreen() {
    const { recordId } = record.useParams();
    const { page } = record.useSearch();
    const [start] = useState(() => {
      starts += 1;
      return starts;
    });
    return (
      <p>
        Record {recordId}, page {page ?? 1}, start {start}
      </p>
    );
  }
  const router = createRouter({
    routeTree: root.addChildren([record]),
    history: createMemoryHistory({ initialEntries: ["/records/1"] }),
    ...routerDefaults,
  });
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(screen.getByText("Record 1, page 1, start 1", { exact: true }))
    .toBeVisible();

  router.history.push("/records/1?page=2");
  await expect
    .element(screen.getByText("Record 1, page 2, start 1", { exact: true }))
    .toBeVisible();

  router.history.push("/records/2");
  await expect
    .element(screen.getByText("Record 2, page 1, start 2", { exact: true }))
    .toBeVisible();
});
