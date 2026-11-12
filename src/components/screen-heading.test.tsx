import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Tab, TabList, Tabs } from "react-aria-components";
import { afterEach, expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import {
  focusScreenHeading,
  ScreenHeading,
  FocusAfterNavigation,
} from "./screen-heading";

afterEach(() => {
  document.title = "Sentinel";
});

test("names the screen with a level-one heading and titles the page after it", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Fetcher run" }))
    .toBeVisible();
  expect(document.title).toBe("Fetcher run – Sentinel");
});

test("is in text-20, or in text-16 in the compact heading of a detail screen", async () => {
  const screen = await render(<ScreenHeading>SNTL-42</ScreenHeading>);
  const heading = screen.getByRole("heading", { level: 1, name: "SNTL-42" });
  await expect.element(heading).toBeVisible();
  expect(getComputedStyle(heading.element()).fontSize).toBe("20px");

  await screen.rerender(<ScreenHeading compact>SNTL-42</ScreenHeading>);

  expect(getComputedStyle(heading.element()).fontSize).toBe("16px");
  expect(getComputedStyle(heading.element()).fontWeight).toBe("600");
});

test("titles the page after a heading that changes", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  await screen.rerender(<ScreenHeading>Not found</ScreenHeading>);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
    .toBeVisible();
  expect(document.title).toBe("Not found – Sentinel");
});

test("gives the page the product name as its title when the screen goes", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  await screen.unmount();

  expect(document.title).toBe("Sentinel");
});

test("takes the focus when asked to", async () => {
  const screen = await render(<ScreenHeading>Fetcher run</ScreenHeading>);

  focusScreenHeading();

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Fetcher run" }))
    .toHaveFocus();
});

test("passes the focus to the heading that replaces it", async () => {
  const screen = await render(
    <ScreenHeading key="record">Fictional record</ScreenHeading>,
  );
  focusScreenHeading();

  await screen.rerender(<ScreenHeading key="error">Not found</ScreenHeading>);

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
    .toHaveFocus();
});

test("asks for nothing when no heading is shown", () => {
  expect(() => {
    focusScreenHeading();
  }).not.toThrow();
  expect(document.activeElement).toBe(document.body);
});

// A screen whose heading appears a moment after the screen, as after a wait
// that shows nothing.
function LateScreen() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setShown(true);
    }, 50);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return shown ? <ScreenHeading>Late screen</ScreenHeading> : null;
}

function FocusRoot() {
  return (
    <FocusAfterNavigation>
      <Outlet />
    </FocusAfterNavigation>
  );
}

test("moves the focus after a navigation to a heading that appears after the screen", async () => {
  const root = createRootRoute({ component: FocusRoot });
  const start = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: () => <ScreenHeading>Start</ScreenHeading>,
  });
  const late = createRoute({
    getParentRoute: () => root,
    path: "/late",
    component: LateScreen,
  });
  const router = createRouter({
    routeTree: root.addChildren([start, late]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Start" }))
    .toBeVisible();
  expect(document.activeElement).toBe(document.body);

  router.history.push("/late");

  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Late screen" }))
    .toHaveFocus();
});

// A detail screen with its tabs, each at a path under the path of the
// screen, the tab of the path selected; a button that opens another of its
// paths; and a button that opens another screen. The paths of these routes
// are not those of the UI's route tree, so the screen opens them through the
// history, as a test does for a tab, which holds the focus as it opens its
// path (the tabs of the Ticket screen, src/routes/ticket-audit-log.test.tsx,
// open their paths as links).
function RecordScreen() {
  const { history } = useRouter();
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <>
      <ScreenHeading>Fictional record</ScreenHeading>
      <Tabs
        selectedKey={path === "/record/history" ? "history" : "details"}
        keyboardActivation="manual"
      >
        <TabList aria-label="Fictional record">
          <Tab id="details">Details</Tab>
          <Tab id="history">History</Tab>
        </TabList>
      </Tabs>
      <Outlet />
      <Button
        onPress={() => {
          history.push("/record/history");
        }}
      >
        Open the history
      </Button>
      <Button
        onPress={() => {
          history.push("/other");
        }}
      >
        Open another screen
      </Button>
    </>
  );
}

// Renders the record screen at the path, with another screen beside it.
async function renderRecord(path: string) {
  const root = createRootRoute({ component: FocusRoot });
  const record = createRoute({
    getParentRoute: () => root,
    path: "/record",
    component: RecordScreen,
  });
  const details = createRoute({
    getParentRoute: () => record,
    path: "/",
    component: () => <p>The details of the record</p>,
  });
  const history = createRoute({
    getParentRoute: () => record,
    path: "history",
    component: () => <p>The history of the record</p>,
  });
  const other = createRoute({
    getParentRoute: () => root,
    path: "/other",
    component: () => <ScreenHeading>Other screen</ScreenHeading>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      record.addChildren([details, history]),
      other,
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Fictional record" }),
    )
    .toBeVisible();
  return { router, screen };
}

test("leaves the focus on a tab that opens another path of its screen", async () => {
  const { router, screen } = await renderRecord("/record");
  const details = screen.getByRole("tab", { name: "Details" });
  const history = screen.getByRole("tab", { name: "History" });
  history.element().focus();

  router.history.push("/record/history");

  await expect
    .element(screen.getByText("The history of the record"))
    .toBeVisible();
  await expect.element(history).toHaveAttribute("aria-selected", "true");
  await expect.element(history).toHaveFocus();

  // The arrow keys move the focus to the other tab, which opens its path.
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(details).toHaveFocus();
  router.history.push("/record");

  await expect
    .element(screen.getByText("The details of the record"))
    .toBeVisible();
  await expect.element(details).toHaveAttribute("aria-selected", "true");
  await expect.element(details).toHaveFocus();
});

test("moves the focus to the heading after another element of the screen opens another of its paths", async () => {
  const { router, screen } = await renderRecord("/record");

  await screen.getByRole("button", { name: "Open the history" }).click();

  await expect
    .element(screen.getByText("The history of the record"))
    .toBeVisible();
  expect(router.state.location.pathname).toBe("/record/history");
  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Fictional record" }),
    )
    .toHaveFocus();
});

test("moves the focus to the heading of another screen, also from a tab", async () => {
  const { router, screen } = await renderRecord("/record");
  await screen.getByRole("button", { name: "Open another screen" }).click();
  const other = screen.getByRole("heading", { level: 1, name: "Other screen" });
  await expect.element(other).toHaveFocus();

  router.history.back();
  const history = screen.getByRole("tab", { name: "History" });
  await expect.element(history).toBeVisible();
  history.element().focus();
  router.history.push("/other");

  await expect.element(other).toHaveFocus();
});
