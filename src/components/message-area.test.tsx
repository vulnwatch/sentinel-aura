import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  linkOptions,
  Outlet,
  RouterProvider,
  type AnyRouter,
} from "@tanstack/react-router";
import { useRef } from "react";
import { DialogTrigger } from "react-aria-components";
import { afterEach, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render, renderHook } from "vitest-browser-react";
import "../styles.css";
import { announcementNode, announcements } from "../test-announcements";
import { Announcer } from "./announcer";
import { Button } from "./button";
import { InfoPopover, PopoverTitle } from "./info-popover";
import {
  MessageArea,
  MessageAreaProvider,
  useShowMessage,
} from "./message-area";
import { RouterLinks } from "./router-links";
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

// A screen with a heading, a button that opens a modal popover, an action
// that shows a message in the area, one that starts a change whose message
// shows when the test ends it, and a control further down.
function MessageScreen({ title }: { title: string }) {
  const show = useShowMessage();
  const count = useRef(0);
  return (
    <>
      <ScreenHeading>{title}</ScreenHeading>
      <DialogTrigger>
        <Button>Details</Button>
        <InfoPopover width="narrow">
          <PopoverTitle>Details of the record</PopoverTitle>
        </InfoPopover>
      </DialogTrigger>
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
      <Button
        onPress={() => {
          endChange = () => {
            show({
              tone: "success",
              text: "Priority changed to P2.",
              record: {
                name: "SNTL-42",
                href: linkOptions({
                  to: "/tickets/$ticketId",
                  params: { ticketId: "SNTL-42" },
                }),
              },
            });
          };
        }}
      >
        Start a change of SNTL-42
      </Button>
      <div className="h-[200dvh]" />
      <Button>Next control</Button>
      <div className="h-dvh" />
    </>
  );
}

function createTestRouter(path: string): AnyRouter {
  const root = createRootRoute({
    component: () => (
      <Announcer>
        <RouterLinks>
          <MessageAreaProvider>
            <main>
              <MessageArea />
              <Outlet />
            </main>
          </MessageAreaProvider>
        </RouterLinks>
      </Announcer>
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
  // The screen of a record, and a tab of it at a path under its path.
  const record = createRoute({
    getParentRoute: () => root,
    path: "/tickets/SNTL-42",
    component: () => <MessageScreen title="SNTL-42" />,
  });
  const recordTab = createRoute({
    getParentRoute: () => root,
    path: "/tickets/SNTL-42/audit-log",
    component: () => <MessageScreen title="Audit log of SNTL-42" />,
  });
  // A record whose path starts with that of the record, which is another
  // screen.
  const otherRecord = createRoute({
    getParentRoute: () => root,
    path: "/tickets/SNTL-420",
    component: () => <MessageScreen title="SNTL-420" />,
  });
  return createRouter({
    routeTree: root.addChildren([
      first,
      second,
      record,
      recordTab,
      otherRecord,
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
}

// Waits until the browser has rendered two more frames, after which the
// effects of the commits before have run.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// The main content, which starts with the message area: the announcer of the
// page, outside it, holds the words of each message too.
function mainContent() {
  return page.getByRole("main");
}

// The message area that holds a message: the element that stays at the top
// of the window, as it does while it holds one.
function areaOf(message: Element): Element | null {
  for (
    let current = message.parentElement;
    current;
    current = current.parentElement
  ) {
    if (getComputedStyle(current).position === "sticky") {
      return current;
    }
  }
  return null;
}

async function renderArea(path = "/first", title = "First") {
  const router = createTestRouter(path);
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: title }))
    .toBeVisible();
  return { router, screen };
}

test("shows the messages newest first, each with its reference and Dismiss", async () => {
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });

  await button.click();
  await button.click();

  const first = mainContent().getByText("First: message 1.");
  const second = mainContent().getByText("First: message 2.");
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
    mainContent()
      .getByText("Reference: 01890a5d-ac96-774b-bcce-b302099a8057")
      .all(),
  ).toHaveLength(2);
  // Above the heading of the screen.
  expect(
    screen.getByRole("heading", { level: 1 }).element().getBoundingClientRect()
      .top,
  ).toBeGreaterThan(first.element().getBoundingClientRect().bottom);
});

test("announces each message as it appears, with its reference, and not again when another one appears or when it goes", async () => {
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });

  await button.click();
  await expect
    .poll(announcements)
    .toEqual([
      "First: message 1. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
    ]);
  await button.click();

  // Each message an announcement of its own, which the announcer of the page
  // announces as it arrives, and none in a live region of the area itself.
  await expect
    .poll(announcements)
    .toEqual([
      "First: message 1. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
      "First: message 2. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
    ]);
  const area = areaOf(mainContent().getByText("First: message 1.").element());
  expect(area?.closest("[aria-live]")).toBeNull();
  expect(area?.querySelector("[aria-live], output")).toBeNull();
  const first = announcementNode(
    "First: message 1. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
  );
  expect(first).not.toBeNull();

  await screen.getByRole("button", { name: "Dismiss" }).first().click();
  await expect
    .poll(announcements)
    .toEqual([
      "First: message 1. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
    ]);
  // The message that stays keeps its node, which assistive technologies do
  // not announce again.
  expect(
    announcementNode(
      "First: message 1. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
    ),
  ).toBe(first);
});

test("announces the record that the message of a change names", async () => {
  const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
  await screen
    .getByRole("button", { name: "Start a change of SNTL-42" })
    .click();
  router.history.push("/second");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Second" }))
    .toBeVisible();

  endChange?.();

  await expect
    .poll(announcements)
    .toEqual(["SNTL-42: Priority changed to P2."]);
});

test("announces a message that appears while a modal popover is open, once, and leaves the focus in the popover", async () => {
  const { screen } = await renderArea();
  await screen
    .getByRole("button", { name: "Start a change", exact: true })
    .click();
  await screen.getByRole("button", { name: "Details" }).click();
  const popover = screen.getByRole("dialog", { name: "Details of the record" });
  await expect.element(popover).toHaveFocus();

  endChange?.();

  await expect
    .element(mainContent().getByText("First: change ended."))
    .toBeVisible();
  await expect.poll(announcements).toEqual(["First: change ended."]);
  await expect.element(popover).toHaveFocus();
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
  await expect
    .element(mainContent().getByText("First: message 1."))
    .toBeVisible();

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

  await expect
    .element(mainContent().getByText("Second: message 1."))
    .toBeVisible();
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
  await screen
    .getByRole("button", { name: "Start a change", exact: true })
    .click();
  router.history.push("/second");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Second" }))
    .toBeVisible();

  endChange?.();

  await expect
    .element(mainContent().getByText("First: change ended."))
    .toBeVisible();
  router.history.push("/first");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "First" }))
    .toBeVisible();
  await expect
    .element(screen.getByText("First: change ended."))
    .not.toBeInTheDocument();
});

test.each([
  ["another screen", "/second", "Second"],
  [
    "the screen of a record whose path starts with that of the record",
    "/tickets/SNTL-420",
    "SNTL-420",
  ],
])(
  "names the record of a change that ends on %s, with a link to its screen in the color of the text, underlined, at weight 500",
  async (_, path, title) => {
    const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
    await screen
      .getByRole("button", { name: "Start a change of SNTL-42" })
      .click();
    router.history.push(path);
    await expect
      .element(screen.getByRole("heading", { level: 1, name: title }))
      .toBeVisible();

    endChange?.();

    const message = mainContent().getByText("SNTL-42: Priority changed to P2.");
    await expect.element(message).toBeVisible();
    const link = message.getByRole("link", { name: "SNTL-42" });
    await expect.element(link).toHaveAttribute("href", "/tickets/SNTL-42");
    const style = getComputedStyle(link.element());
    expect(style.color).toBe(getComputedStyle(message.element()).color);
    expect([style.textDecorationLine, style.fontWeight]).toEqual([
      "underline",
      "500",
    ]);

    await link.click();

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "SNTL-42" }))
      .toBeVisible();
  },
);

test.each([
  ["on its own screen", undefined, "SNTL-42"],
  [
    "on a tab of its screen",
    "/tickets/SNTL-42/audit-log",
    "Audit log of SNTL-42",
  ],
])(
  "does not name the record of a change that ends %s",
  async (_, path, title) => {
    const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
    await screen
      .getByRole("button", { name: "Start a change of SNTL-42" })
      .click();
    if (path !== undefined) {
      router.history.push(path);
    }
    await expect
      .element(screen.getByRole("heading", { level: 1, name: title }))
      .toBeVisible();

    endChange?.();

    await expect
      .element(
        mainContent().getByText("Priority changed to P2.", { exact: true }),
      )
      .toBeVisible();
    expect(screen.getByRole("link").query()).toBeNull();
  },
);

test("keeps its messages when the search of the same screen changes", async () => {
  const { router, screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();

  router.history.push("/first?page=2");

  // Once the router has shown the search, and the screen has rendered it.
  await expect
    .poll(() => router.state.resolvedLocation?.searchStr)
    .toBe("?page=2");
  await nextFrames();
  await expect
    .element(mainContent().getByText("First: message 1."))
    .toBeVisible();
});

test("stays at the top of the window when the content scrolls", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  const message = mainContent().getByText("First: message 1.");
  await expect.element(message).toBeVisible();

  window.scrollTo(0, 600);

  await expect.poll(() => window.scrollY).toBe(600);
  const area = areaOf(message.element());
  expect(area?.getBoundingClientRect().top).toBe(0);
});

test("keeps the element that takes the focus out from under it while it stays at the top of the window", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  const message = mainContent().getByText("First: message 1.");
  await expect.element(message).toBeVisible();
  const area = () =>
    areaOf(message.element())?.getBoundingClientRect().bottom ?? 0;
  const next = screen.getByRole("button", { name: "Next control" });
  // The window scrolls so that the control lies under the area.
  window.scrollTo(
    0,
    window.scrollY + next.element().getBoundingClientRect().top - 10,
  );
  await expect
    .poll(() => next.element().getBoundingClientRect().top)
    .toBeLessThan(area());
  // The control before Next control.
  screen
    .getByRole("button", { name: "Start a change of SNTL-42" })
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
  const message = mainContent().getByText("First: message 6.");
  await expect.element(message).toBeVisible();

  const area = areaOf(message.element());
  expect(area?.getBoundingClientRect().height).toBeLessThanOrEqual(200);
  expect(area?.scrollHeight).toBeGreaterThan(area?.clientHeight ?? 0);
});

test("takes no room and leaves no scroll padding without messages", async () => {
  const { screen } = await renderArea();
  await screen.getByRole("button", { name: "Show a message" }).click();
  const area = areaOf(mainContent().getByText("First: message 1.").element());
  await screen.getByRole("button", { name: "Dismiss" }).click();
  await expect
    .element(screen.getByText("First: message 1."))
    .not.toBeInTheDocument();

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
