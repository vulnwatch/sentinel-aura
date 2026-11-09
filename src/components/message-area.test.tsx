import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type AnyRouter,
} from "@tanstack/react-router";
import { useRef } from "react";
import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render, renderHook } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import {
  MessageArea,
  MessageAreaProvider,
  useShowMessage,
} from "./message-area";
import { ScreenHeading } from "./screen-heading";

// The message area at the top of the main content (docs/behaviors.md,
// Outcome of a Change; docs/design-system.md, Main Content; Messages).

afterEach(async () => {
  await page.viewport(414, 896);
  document.title = "Sentinel";
  endChange = undefined;
  window.scrollTo(0, 0);
});

// The message of a change that the test ends when it chooses, such as after
// the user opened another screen.
let endChange: (() => void) | undefined;

// A screen with a heading, an action that shows a message in the area, one
// that starts a change whose message shows when the test ends it, and a
// control further down.
function MessageScreen({ title }: { title: string }) {
  const show = useShowMessage();
  const count = useRef(0);
  return (
    <>
      <ScreenHeading>{title}</ScreenHeading>
      <Button
        onPress={() => {
          count.current += 1;
          show({
            tone: "danger",
            text: `${title}: message ${count.current}.`,
            reference: "01890a5d-ac96-774b-bcce-b302099a8057",
          });
        }}
      >
        Show a message
      </Button>
      <Button
        onPress={() => {
          endChange = () => {
            show({ tone: "success", text: `${title}: change ended.` });
          };
        }}
      >
        Start a change
      </Button>
      <div className="h-[200dvh]" />
      <Button>Next control</Button>
      <div className="h-dvh" />
    </>
  );
}

function createTestRouter(): AnyRouter {
  const root = createRootRoute({
    component: () => (
      <MessageAreaProvider>
        <main>
          <MessageArea />
          <Outlet />
        </main>
      </MessageAreaProvider>
    ),
  });
  const first = createRoute({
    getParentRoute: () => root,
    path: "/first",
    component: () => <MessageScreen title="First" />,
  });
  const second = createRoute({
    getParentRoute: () => root,
    path: "/second",
    component: () => <MessageScreen title="Second" />,
  });
  return createRouter({
    routeTree: root.addChildren([first, second]),
    history: createMemoryHistory({ initialEntries: ["/first"] }),
  });
}

async function renderArea() {
  const router = createTestRouter();
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "First" }))
    .toBeVisible();
  return { router, screen };
}

test("shows the messages newest first, each with its reference and Dismiss, in a live region", async () => {
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });

  await button.click();
  await button.click();

  const first = screen.getByText("First: message 1.");
  const second = screen.getByText("First: message 2.");
  await expect.element(second).toBeVisible();
  expect(second.element().getBoundingClientRect().bottom).toBeLessThan(
    first.element().getBoundingClientRect().top,
  );
  expect(
    first.element().getBoundingClientRect().top -
      second.element().getBoundingClientRect().bottom,
  ).toBeGreaterThanOrEqual(8);
  expect(screen.getByRole("button", { name: "Dismiss" }).all()).toHaveLength(2);
  expect(
    screen.getByText("Reference: 01890a5d-ac96-774b-bcce-b302099a8057").all(),
  ).toHaveLength(2);
  const region = first.element().closest("[aria-live]");
  expect(region?.getAttribute("aria-live")).toBe("polite");
  // Above the heading of the screen.
  expect(
    screen.getByRole("heading", { level: 1 }).element().getBoundingClientRect()
      .top,
  ).toBeGreaterThan(first.element().getBoundingClientRect().bottom);
});

test("is in the page before its first message, so that the message is announced", async () => {
  const { screen } = await renderArea();
  const region = document.querySelector("[aria-live]");
  expect(region).not.toBeNull();

  await screen.getByRole("button", { name: "Show a message" }).click();

  await expect.element(screen.getByText("First: message 1.")).toBeVisible();
  expect(
    screen.getByText("First: message 1.").element().closest("[aria-live]"),
  ).toBe(region);
});

test("removes a message that the user dismisses, and moves the focus to the screen's heading", async () => {
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  const dismiss = screen.getByRole("button", { name: "Dismiss" });
  await expect.element(dismiss).toBeVisible();

  dismiss.element().focus();
  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByText("First: message 1."))
    .not.toBeInTheDocument();
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "First" }))
    .toHaveFocus();
});

test("removes the messages when another screen opens, also when the user returns", async () => {
  const { router, screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  await expect.element(screen.getByText("First: message 1.")).toBeVisible();

  router.history.push("/second");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Second" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("First: message 1."))
    .not.toBeInTheDocument();

  router.history.back();
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "First" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("First: message 1."))
    .not.toBeInTheDocument();
});

test("shows a message on the screen that the user is on when it appears, until another screen opens", async () => {
  const { router, screen } = await renderArea();
  router.history.push("/second");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Second" }))
    .toBeVisible();

  await screen.getByRole("button", { name: "Show a message" }).click();

  await expect.element(screen.getByText("Second: message 1.")).toBeVisible();
  router.history.push("/first");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "First" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("Second: message 1."))
    .not.toBeInTheDocument();
});

test("shows the message of a change that ends after the user left its screen on the screen that the user is on", async () => {
  const { router, screen } = await renderArea();
  await screen.getByRole("button", { name: "Start a change" }).click();
  router.history.push("/second");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Second" }))
    .toBeVisible();

  endChange?.();

  await expect.element(screen.getByText("First: change ended.")).toBeVisible();
  router.history.push("/first");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "First" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("First: change ended."))
    .not.toBeInTheDocument();
});

test("keeps its messages when the search of the same screen changes", async () => {
  const { router, screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();

  router.history.push("/first?page=2");

  await expect.element(screen.getByText("First: message 1.")).toBeVisible();
});

test("stays at the top of the window when the content scrolls", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  const message = screen.getByText("First: message 1.");
  await expect.element(message).toBeVisible();

  window.scrollTo(0, 600);

  await expect.poll(() => window.scrollY).toBe(600);
  const area = message.element().closest("[aria-live]");
  expect(area?.getBoundingClientRect().top).toBe(0);
});

test("keeps the element that takes the focus out from under it while it stays at the top of the window", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  const message = screen.getByText("First: message 1.");
  await expect.element(message).toBeVisible();
  const area = () =>
    message.element().closest("[aria-live]")?.getBoundingClientRect().bottom ??
    0;
  const next = screen.getByRole("button", { name: "Next control" });
  // The window scrolls so that the control lies under the area.
  window.scrollTo(
    0,
    window.scrollY + next.element().getBoundingClientRect().top - 10,
  );
  await expect
    .poll(() => next.element().getBoundingClientRect().top)
    .toBeLessThan(area());
  screen
    .getByRole("button", { name: "Start a change" })
    .element()
    .focus({ preventScroll: true });

  await userEvent.keyboard("{Tab}");

  await expect.element(next).toHaveFocus();
  await expect
    .poll(() => next.element().getBoundingClientRect().top)
    .toBeGreaterThanOrEqual(area());
});

test("takes at most a third of the window's height, beyond which its messages scroll within it", async () => {
  await page.viewport(1280, 600);
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });
  for (let shown = 0; shown < 6; shown += 1) {
    await button.click();
  }
  const message = screen.getByText("First: message 6.");
  await expect.element(message).toBeVisible();

  const area = message.element().closest("[aria-live]");
  expect(area?.getBoundingClientRect().height).toBeLessThanOrEqual(200);
  expect(area?.scrollHeight).toBeGreaterThan(area?.clientHeight ?? 0);
});

test("takes no room and leaves no scroll padding without messages", async () => {
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  await screen.getByRole("button", { name: "Dismiss" }).click();
  await expect
    .element(screen.getByText("First: message 1."))
    .not.toBeInTheDocument();

  const area = document.querySelector("[aria-live]");
  expect(area?.getBoundingClientRect().height).toBe(0);
  expect(getComputedStyle(document.documentElement).scrollPaddingTop).toBe(
    "0px",
  );
});

test("is used only inside its provider", async () => {
  await expect(renderHook(() => useShowMessage())).rejects.toThrow(
    "The message area is used outside its provider",
  );
});
