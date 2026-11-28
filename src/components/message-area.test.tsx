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
import { ListRestart } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { DialogTrigger } from "react-aria-components";
import { afterEach, expect, test, vi } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import { render, renderHook } from "vitest-browser-react";
import "../styles.css";
import {
  announcementNode,
  announcements,
  inReach,
} from "../test-announcements";
import { pointerAwayFrom } from "../test-pointer";
import { screenshot } from "../test-screenshot";
import { applyThemePreference } from "../theme";
import { ScreenActionsMenu } from "./actions-menu";
import { Announcer } from "./announcer";
import { Button } from "./button";
import { DetailHeading } from "./detail-screen";
import { InfoPopover, PopoverTitle } from "./info-popover";
import { MenuAction } from "./menu";
import {
  MESSAGE_TIMEOUT_MS,
  MessageArea,
  MessageAreaProvider,
  useShowMessage,
  type AreaMessage,
} from "./message-area";
import { ModalDialog } from "./modal-dialog";
import { NotFound } from "./not-found";
import { RouterLinks } from "./router-links";
import { ScreenHeading } from "./screen-heading";
import { TextField } from "./text-field";

declare module "vitest/browser" {
  interface BrowserCommands {
    emulateReducedMotion: (reduce: boolean) => Promise<void>;
  }
}

// The message area, which floats over the content at the bottom of the
// window (docs/behaviors.md, Outcome of a Change; Accessibility;
// docs/design-system.md, Main Content; Messages; Focus and Motion).

afterEach(async () => {
  // First, so that what follows runs on the clock of the page.
  vi.useRealTimers();
  vi.restoreAllMocks();
  await commands.emulateReducedMotion(false);
  applyThemePreference("system");
  document.documentElement.style.removeProperty("font-size");
  await page.viewport(414, 896);
  document.title = "Sentinel";
  endChange = undefined;
  showMessage = undefined;
  removeControl = undefined;
  window.scrollTo(0, 0);
});

// The message of a change that the test ends when it chooses, such as after
// the user opened another screen.
let endChange: (() => void) | undefined;

// The function of the area that shows a message, which the test calls as a
// screen does after a change, without a press of the pointer or a move of
// the focus, which the tests of where they are need.
let showMessage: ((message: AreaMessage) => void) | undefined;

// Removes Edit priority from the screen, as a change can remove the element
// that had the focus before it entered the area.
let removeControl: (() => void) | undefined;

function show(message: AreaMessage) {
  if (showMessage === undefined) {
    throw new Error("No message area shows");
  }
  showMessage(message);
}

const REFERENCE = "01890a5d-ac96-774b-bcce-b302099a8057";

// A screen with a heading, a button that opens a modal popover, a control
// that a change can remove, an action that shows a message in the area, one
// that starts a change whose message shows when the test ends it, and, far
// below, two more controls, the last at the end of the content.
function MessageScreen({ title }: { title: string }) {
  const showInArea = useShowMessage();
  const count = useRef(0);
  const [editable, setEditable] = useState(true);
  useLayoutEffect(() => {
    removeControl = () => {
      setEditable(false);
    };
  }, []);
  return (
    <>
      <ScreenHeading>{title}</ScreenHeading>
      <DialogTrigger>
        <Button>Details</Button>
        <InfoPopover width="narrow">
          <PopoverTitle>Details of the record</PopoverTitle>
        </InfoPopover>
      </DialogTrigger>
      {editable && <Button>Edit priority</Button>}
      <Button
        onPress={() => {
          count.current += 1;
          showInArea({
            tone: "danger",
            text: `${title}: message ${count.current}.`,
            reference: REFERENCE,
          });
        }}
      >
        Show a message
      </Button>
      <Button
        onPress={() => {
          endChange = () => {
            showInArea({ tone: "success", text: `${title}: change ended.` });
          };
        }}
      >
        Start a change
      </Button>
      <Button
        onPress={() => {
          endChange = () => {
            showInArea({
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
      <Button>Last control</Button>
    </>
  );
}

// A screen whose content fits in a window 800 px high, so that the page
// scrolls only with the room that the area keeps at the end of the content.
function FittingScreen() {
  return (
    <>
      <ScreenHeading>Short</ScreenHeading>
      <Button>Edit</Button>
      <div className="h-[80dvh]" />
    </>
  );
}

// A screen with a heading and a button that opens a dialog, and, far below,
// a row of controls that the window can scroll under the area or above it: a
// button, the button of a popover, with room below its title, and the
// Actions of a record, which open below them; then more content.
function OverlayScreen() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <ScreenHeading>Overlays</ScreenHeading>
      <Button
        onPress={() => {
          setDialogOpen(true);
        }}
      >
        Open the details
      </Button>
      <ModalDialog
        isOpen={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
        }}
        width="confirmation"
        title="Details of SNTL-42"
        buttons={
          <Button
            onPress={() => {
              setDialogOpen(false);
            }}
          >
            Close
          </Button>
        }
      >
        The details of the record.
      </ModalDialog>
      <div className="h-[200dvh]" />
      <Button>Edit</Button>
      <DialogTrigger>
        <Button>More details</Button>
        <InfoPopover width="narrow">
          <PopoverTitle>More details of the record</PopoverTitle>
          <div className="h-24" />
        </InfoPopover>
      </DialogTrigger>
      <ScreenActionsMenu
        label="Actions of SNTL-42"
        isOpen={menuOpen}
        onOpenChange={setMenuOpen}
        busy={false}
        compact={false}
      >
        <MenuAction icon={ListRestart}>Rerun convergence</MenuAction>
      </ScreenActionsMenu>
      <div className="h-dvh" />
    </>
  );
}

// A screen with a heading and, far below, a field as wide as the main
// content, wider than the area, whose focus the browser shows also after a
// press of the pointer; then more content.
function FieldScreen() {
  return (
    <>
      <ScreenHeading>Field</ScreenHeading>
      <div className="h-[200dvh]" />
      <TextField label="Summary" />
      <div className="h-dvh" />
    </>
  );
}

// The screen of a record, whose heading row stays at the top of the window
// once it has scrolled there, as the compact heading of a detail screen,
// here as high as the window, so that the area shows over it.
function RecordScreen() {
  return (
    <>
      <DetailHeading sticky>
        {() => (
          <section aria-label="Heading row" className="h-dvh">
            <ScreenHeading>Record</ScreenHeading>
          </section>
        )}
      </DetailHeading>
      <div className="h-[200dvh]" />
    </>
  );
}

// Gives the tests the function of the area that shows a message.
function ShowFromTest() {
  const showInArea = useShowMessage();
  useLayoutEffect(() => {
    showMessage = showInArea;
  }, [showInArea]);
  return null;
}

function createTestRouter(path: string, expanded: boolean): AnyRouter {
  // The frame of the screens, as src/components/app-frame.tsx gives it: the
  // main content beside the place of the sidebar, collapsed, 56 px wide, or
  // expanded, 216 px wide, with 24 px of space at its top and sides, which
  // holds the screen and then the message area.
  const root = createRootRoute({
    component: () => (
      <Announcer>
        <RouterLinks>
          <MessageAreaProvider>
            <ShowFromTest />
            <main className={`min-h-dvh p-6 ${expanded ? "ml-54" : "ml-14"}`}>
              <Outlet />
              <MessageArea expanded={expanded} />
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
  const short = createRoute({
    getParentRoute: () => root,
    path: "/short",
    component: FittingScreen,
  });
  const overlays = createRoute({
    getParentRoute: () => root,
    path: "/overlays",
    component: OverlayScreen,
  });
  const field = createRoute({
    getParentRoute: () => root,
    path: "/field",
    component: FieldScreen,
  });
  const detail = createRoute({
    getParentRoute: () => root,
    path: "/record",
    component: RecordScreen,
  });
  // The screen of a record, with the routes of its tabs under its route, at
  // paths under its path, as the routes of the tabs of a detail screen are
  // (src/router.ts): its first tab at the path of the record, and Audit log.
  const record = createRoute({
    getParentRoute: () => root,
    path: "/tickets/SNTL-42",
    component: () => <Outlet />,
  });
  const recordOverview = createRoute({
    getParentRoute: () => record,
    path: "/",
    component: () => <MessageScreen title="SNTL-42" />,
  });
  const recordAuditLog = createRoute({
    getParentRoute: () => record,
    path: "audit-log",
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
      short,
      overlays,
      field,
      detail,
      record.addChildren([recordOverview, recordAuditLog]),
      otherRecord,
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
    // Not found in place of every screen, also at a path under the path of a
    // screen, such as an unknown tab of a record, as src/router.ts shows it.
    defaultNotFoundComponent: NotFound,
    notFoundMode: "root",
  });
}

// Waits until the browser has rendered two more frames, after which the
// effects of the commits before have run.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// Sets the size of the window, then waits until the page has it and for the
// frames in which the browser tells the page of the resize, which it can
// otherwise do later, while the test checks how the area follows its own
// height as its messages change, which the resize would measure again.
async function windowSize(width: number, height: number) {
  await page.viewport(width, height);
  await expect
    .poll(() => [window.innerWidth, window.innerHeight])
    .toEqual([width, height]);
  await nextFrames();
}

// The main content, which ends with the message area: the announcer of the
// page, outside it, holds the words of each message too.
function mainContent() {
  return page.getByRole("main");
}

// The message area, while it holds a message.
function messagesRegion() {
  return page.getByRole("region", { name: "Messages" });
}

// A message of the area, which is named by its words, followed by the
// reference of an error.
function messageNamed(words: string) {
  return page.getByRole("group", { name: words, exact: false });
}

function dismissOf(message: Locator) {
  return message.getByRole("button", { name: "Dismiss" });
}

function box(element: Locator): DOMRect {
  return element.element().getBoundingClientRect();
}

// Where an element shows in the window.
function placeOf(element: Locator) {
  const { top, left, width, height } = box(element);
  return { top, left, width, height };
}

// Scrolls the window so that the bottom of the element lies at the height y
// in the window, to the rounding of a pixel.
async function scrollBottomTo(element: Locator, y: number) {
  window.scrollTo(0, window.scrollY + box(element).bottom - y);
  await expect.poll(() => Math.abs(box(element).bottom - y)).toBeLessThan(1);
}

// The height in the window near its bottom, where the area shows, at which a
// control lies under the area, 30 px above the bottom of the window.
function underArea() {
  return window.innerHeight - 30;
}

// Whether two boxes share a part of the window.
function overlaps(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

// The center of the part of the window that two boxes share, which is not
// empty.
function sharedCenter(a: DOMRect, b: DOMRect) {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.right, b.right);
  const top = Math.max(a.top, b.top);
  const bottom = Math.min(a.bottom, b.bottom);
  expect(right - left).toBeGreaterThan(0);
  expect(bottom - top).toBeGreaterThan(0);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

async function renderArea(path = "/first", title = "First", expanded = false) {
  const router = createTestRouter(path, expanded);
  const screen = await render(<RouterProvider router={router} />);
  await expect
    .element(screen.getByRole("heading", { level: 1, name: title }))
    .toBeVisible();
  return { router, screen };
}

type Screen = Awaited<ReturnType<typeof renderArea>>["screen"];

function screenHeading(screen: Screen) {
  return screen.getByRole("heading", { level: 1 });
}

// Shows the messages one after another through the screen's action, which
// keeps the focus on it.
async function showMessages(screen: Screen, count: number) {
  const button = screen.getByRole("button", { name: "Show a message" });
  for (let shown = 0; shown < count; shown += 1) {
    await button.click();
  }
  await expect.element(messageNamed(`First: message ${count}.`)).toBeVisible();
}

test("does not show without a message, and shows its messages newest at the top, 8 px apart, each with its reference and Dismiss, so that a new message moves none of those that show", async () => {
  const { screen } = await renderArea();
  expect(messagesRegion().query()).toBeNull();
  await showMessages(screen, 1);
  const older = messageNamed("First: message 1.");
  const place = placeOf(older);

  await screen.getByRole("button", { name: "Show a message" }).click();

  const newer = messageNamed("First: message 2.");
  await expect.element(newer).toBeVisible();
  expect(placeOf(older)).toEqual(place);
  expect(box(older).top - box(newer).bottom).toBeCloseTo(8);
  expect(
    mainContent().getByRole("button", { name: "Dismiss" }).all(),
  ).toHaveLength(2);
  expect(mainContent().getByText(`Reference: ${REFERENCE}`).all()).toHaveLength(
    2,
  );
});

test("moves only the newer messages above one that goes down into its place", async () => {
  const { screen } = await renderArea();
  await showMessages(screen, 3);
  const oldest = messageNamed("First: message 1.");
  const middle = messageNamed("First: message 2.");
  const newest = messageNamed("First: message 3.");
  const place = placeOf(oldest);

  await dismissOf(middle).click();

  await expect.element(middle).not.toBeInTheDocument();
  expect(placeOf(oldest)).toEqual(place);
  expect(box(oldest).top - box(newest).bottom).toBeCloseTo(8);
});

test.each([
  ["collapsed", false, 56],
  ["expanded", true, 216],
] as const)(
  "floats 24 px above the bottom of the window, starting 24 px after the %s sidebar, as the screen's heading does, at most 400 px wide",
  async (_, expanded, sidebar) => {
    await page.viewport(1280, 800);
    const { screen } = await renderArea("/first", "First", expanded);

    await showMessages(screen, 1);

    const message = box(messageNamed("First: message 1."));
    expect(message.left).toBe(sidebar + 24);
    expect(message.left).toBe(box(screenHeading(screen)).left);
    expect(message.bottom).toBe(window.innerHeight - 24);
    expect(message.width).toBe(400);
  },
);

test.each([
  ["at the default text size", ""],
  ["with text enlarged to 200 %", "200%"],
])(
  "is as wide as the main content inside its space where that is narrower, in a window 320 px wide, %s",
  async (_, fontSize) => {
    await page.viewport(320, 640);
    document.documentElement.style.fontSize = fontSize;
    // A screen whose content fits the width of the window at both sizes.
    const { screen } = await renderArea("/short", "Short");

    show({
      tone: "danger",
      text: "Sentinel isn't available right now.",
      reference: REFERENCE,
    });

    const message = messageNamed("Sentinel isn't available right now.");
    await expect.element(message).toBeVisible();
    // The heading spans the main content inside its space.
    const shown = box(message);
    const heading = box(screenHeading(screen));
    expect([shown.left, shown.right]).toEqual([heading.left, heading.right]);
    expect(shown.width).toBeLessThan(400);
    // Inside the window, where a message higher than the area scrolls within
    // it.
    expect(box(messagesRegion()).bottom).toBeLessThan(window.innerHeight);
    // Without scrolling in two directions.
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth,
    );
  },
);

test("stays at the bottom of the window when the content scrolls", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await showMessages(screen, 1);
  const message = messageNamed("First: message 1.");
  const place = placeOf(message);

  window.scrollTo(0, 600);

  await expect.poll(() => window.scrollY).toBe(600);
  expect(placeOf(message)).toEqual(place);
  expect(box(messagesRegion()).bottom).toBe(window.innerHeight - 24);
});

test("comes last in the order of the page, after the content of the screen, named Messages, and goes with its last message", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await showMessages(screen, 1);
  const region = mainContent().getByRole("region", { name: "Messages" });
  await expect.element(region).toBeVisible();
  const last = screen.getByRole("button", { name: "Last control" });
  expect(
    last.element().compareDocumentPosition(region.element()) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).not.toBe(0);
  last.element().focus();

  // The keyboard reaches it after the last control of the screen.
  await userEvent.keyboard("{Tab}");

  const dismiss = dismissOf(messageNamed("First: message 1."));
  await expect.element(dismiss).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(region).not.toBeInTheDocument();
});

test("shows above the compact heading of a detail screen", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/record", "Record");
  const row = screen.getByRole("region", { name: "Heading row" });
  // The heading row has scrolled to the top of the window, where it stays.
  window.scrollTo(0, 100);
  await expect.poll(() => window.scrollY).toBe(100);
  await expect.poll(() => box(row).top).toBeGreaterThanOrEqual(0);

  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });

  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  // Where they meet, the message shows, with the heading row beneath it.
  const { x, y } = sharedCenter(box(message), box(row));
  const [shown, ...beneath] = document.elementsFromPoint(x, y);
  expect(message.element().contains(shown ?? null)).toBe(true);
  expect(beneath).toContain(row.element());
});

// A popover or a dialog makes the rest of the page inert while it is open,
// the area included, which the browser then leaves out of what lies at a
// point of the window: the tests read the pixels that the browser shows
// instead.

test("shows below a popover that opens over it", async () => {
  applyThemePreference("light");
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/overlays", "Overlays");
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  // While the popover is open, the message is out of reach of the locators
  // too.
  const shown = message.element();
  const button = screen.getByRole("button", { name: "More details" });
  // Its button above the area, so that the popover opens below it, over the
  // area.
  await scrollBottomTo(button, box(messagesRegion()).top - 100);

  await button.click();

  const popover = screen.getByRole("dialog", {
    name: "More details of the record",
  });
  await expect.element(popover).toHaveFocus();
  // A picture of the message, which stays where it is, while the screenshot
  // of an element that scrolls with the page would scroll it above the area,
  // by the scroll padding at its bottom. Where they meet, the popover shows
  // its background below its title, surface of the light theme.
  const picture = await screenshot(page.elementLocator(shown));
  const place = shown.getBoundingClientRect();
  const { x, y } = sharedCenter(place, box(popover));
  expect(picture.at(x - place.left, y - place.top)).toBe("#ffffff");
});

test("shows below a dialog that opens over the page, whose overlay dims it as it dims the page", async () => {
  applyThemePreference("light");
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/overlays", "Overlays");
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  // danger-soft of the light theme along its top edge.
  const soft = "#ffebe9";
  expect(await topEdge(message)).toEqual([soft, soft, soft]);
  // While the dialog is open, the message is out of reach of the locators
  // too.
  const shown = page.elementLocator(message.element());

  await screen.getByRole("button", { name: "Open the details" }).click();

  await expect
    .element(screen.getByRole("dialog", { name: "Details of SNTL-42" }))
    .toBeVisible();
  const [start, middle, end] = await topEdge(shown);
  expect(start).not.toBe(soft);
  expect([middle, end]).toEqual([start, start]);
});

test("lets the pointer reach the content beside and between its messages while they do not scroll within it", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  await showMessages(screen, 2);
  const region = messagesRegion().element();
  const older = messageNamed("First: message 1.");
  const x = box(older).left + 100;

  // Between the two messages, and beside them, where their shadows show.
  const between = document.elementFromPoint(x, box(older).top - 4);
  const beside = document.elementFromPoint(
    box(older).right + 6,
    box(older).top + 10,
  );
  const on = document.elementFromPoint(x, box(older).top + 10);

  expect(region.contains(between)).toBe(false);
  expect(region.contains(beside)).toBe(false);
  expect(older.element().contains(on)).toBe(true);
});

test("takes the pointer beside and between its messages while they scroll within it, so that its scrollbar and the wheel scroll it", async () => {
  await page.viewport(1280, 600);
  const { screen } = await renderArea();
  await showMessages(screen, 6);
  const region = messagesRegion().element();
  expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
  const newest = box(messageNamed("First: message 6."));

  // Between the two newest messages, and beside them, in the space at the end
  // of the area, once the area shows that they scroll.
  await expect
    .poll(() =>
      region.contains(
        document.elementFromPoint(newest.left + 100, newest.bottom + 4),
      ),
    )
    .toBe(true);
  expect(
    region.contains(
      document.elementFromPoint(newest.right + 6, newest.top + 10),
    ),
  ).toBe(true);
});

test("takes at most a third of the window's height, beyond which its messages scroll within it", async () => {
  await page.viewport(1280, 600);
  const { screen } = await renderArea();
  await showMessages(screen, 6);
  const region = messagesRegion();

  // As high as a third of the window, while its messages are higher.
  expect(box(region).height).toBeCloseTo(window.innerHeight / 3, 0);
  expect(box(region).bottom).toBe(600 - 24);
  expect(region.element().scrollHeight).toBeGreaterThan(
    region.element().clientHeight,
  );
  // The newest at its top, and the oldest reached by scrolling within it.
  expect(box(messageNamed("First: message 6.")).top).toBeGreaterThanOrEqual(
    box(region).top,
  );
  const oldest = messageNamed("First: message 1.");
  expect(box(oldest).top).toBeGreaterThan(box(region).bottom);

  region.element().scrollTop = region.element().scrollHeight;

  // Within the area, to the rounding of a pixel that the end of its
  // scrolling can leave.
  await expect
    .poll(() => box(oldest).bottom - box(region).bottom)
    .toBeLessThan(1);
});

// Shows six messages in a window 600 px high, more than the area holds, and
// scrolls the area to its end, where the oldest shows.
async function scrolledToOldest(screen: Screen) {
  await page.viewport(1280, 600);
  await showMessages(screen, 6);
  const region = messagesRegion();
  region.element().scrollTop = region.element().scrollHeight;
  const oldest = messageNamed("First: message 1.");
  // Within the area, to the rounding of a pixel that the end of its
  // scrolling can leave.
  await expect
    .poll(() => box(oldest).bottom - box(region).bottom)
    .toBeLessThan(1);
  return { region, oldest };
}

test("scrolls to its top for a new message, so that it shows", async () => {
  const { screen } = await renderArea();
  const { region } = await scrolledToOldest(screen);
  // Neither the pointer nor the focus is in the area.
  await pointerAwayFrom(region);
  await expect
    .element(screen.getByRole("button", { name: "Show a message" }))
    .toHaveFocus();

  show({ tone: "info", text: "Refetch started." });

  const newest = messageNamed("Refetch started.");
  await expect.element(newest).toBeVisible();
  expect(region.element().scrollTop).toBe(0);
  expect(box(newest).top).toBeGreaterThanOrEqual(box(region).top);
});

test.each([
  [
    "the pointer hovers over the area",
    async (message: Locator) => {
      await message.hover();
    },
  ],
  [
    "the focus is in the area",
    async (message: Locator) => {
      dismissOf(message).element().focus();
      await expect.element(dismissOf(message)).toHaveFocus();
    },
  ],
])(
  "keeps its messages where they show, without scrolling to its top, when a new one appears while %s",
  async (_, holdArea) => {
    const { screen } = await renderArea();
    const { region, oldest } = await scrolledToOldest(screen);
    await holdArea(oldest);
    const place = placeOf(oldest);

    show({ tone: "info", text: "Refetch started." });

    await expect.element(messageNamed("Refetch started.")).toBeInTheDocument();
    await nextFrames();
    expect(placeOf(oldest)).toEqual(place);
    expect(region.element().scrollTop).toBeGreaterThan(0);
  },
);

test("moves nothing of the screen as a message appears and as it goes", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  const content = [
    screenHeading(screen),
    ...[
      "Details",
      "Edit priority",
      "Show a message",
      "Start a change",
      "Start a change of SNTL-42",
    ].map((name) => screen.getByRole("button", { name, exact: true })),
  ];
  const places = () => content.map(placeOf);
  const before = places();

  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });

  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  await nextFrames();
  expect(places()).toEqual(before);
  expect(window.scrollY).toBe(0);
  await dismissOf(message).click();
  await expect.element(message).not.toBeInTheDocument();
  await nextFrames();
  expect(places()).toEqual(before);
  expect(window.scrollY).toBe(0);
});

test.each([
  [
    "the user moved it with Tab",
    async (screen: Screen, next: Locator) => {
      // From the control before it, to which the UI moved it.
      screen
        .getByRole("button", { name: "Start a change of SNTL-42" })
        .element()
        .focus({ preventScroll: true });
      await userEvent.keyboard("{Tab}");
      await expect.element(next).toHaveFocus();
      await nextFrames();
    },
  ],
  [
    "the UI moved it more than a second before",
    async (_: Screen, next: Locator) => {
      // A focus that the browser shows, as after a key.
      next.element().focus({ preventScroll: true, focusVisible: true });
      await expect.element(next).toHaveFocus();
      await nextFrames();
      // The clock of the page then moves on by a second.
      const now = performance.now.bind(performance);
      vi.spyOn(performance, "now").mockImplementation(() => now() + 1_000);
    },
  ],
])(
  "leaves the focus and the page where they are when a message appears over the control that has the focus, to which %s, which F6 then leaves for the message",
  async (_, focusControl) => {
    await page.viewport(1280, 800);
    const { screen } = await renderArea();
    const next = screen.getByRole("button", { name: "Next control" });
    // The control lies where the area shows.
    await scrollBottomTo(next, underArea());
    await focusControl(screen, next);
    const scroll = window.scrollY;
    const place = placeOf(next);

    show({
      tone: "danger",
      text: "Sentinel isn't available right now.",
      reference: REFERENCE,
    });

    const message = messageNamed("Sentinel isn't available right now.");
    await expect.element(message).toBeVisible();
    await nextFrames();
    // The message lies over the control.
    const control = box(next);
    expect(
      message
        .element()
        .contains(
          document.elementFromPoint(
            control.left + control.width / 2,
            control.top + control.height / 2,
          ),
        ),
    ).toBe(true);
    expect(window.scrollY).toBe(scroll);
    expect(placeOf(next)).toEqual(place);
    await expect.element(next).toHaveFocus();
    await userEvent.keyboard("{F6}");
    await expect.element(message).toHaveFocus();
    expect(window.scrollY).toBe(scroll);
  },
);

test("moves nothing of a page that only the room at the end of its content makes scroll, which keeps the room of its scrollbar", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/short", "Short");
  const root = document.documentElement;
  // The page does not scroll yet, and keeps the room of its scrollbar.
  expect(root.scrollHeight).toBeLessThanOrEqual(window.innerHeight);
  expect(getComputedStyle(root).scrollbarGutter).toBe("stable");
  const content = [
    screenHeading(screen),
    screen.getByRole("button", { name: "Edit" }),
  ];
  const places = () => content.map(placeOf);
  const before = places();

  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });

  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  await nextFrames();
  expect(root.scrollHeight).toBeGreaterThan(window.innerHeight);
  expect(places()).toEqual(before);
  expect(window.scrollY).toBe(0);
  await dismissOf(message).click();
  await expect.element(message).not.toBeInTheDocument();
  await nextFrames();
  expect(places()).toEqual(before);
  expect(window.scrollY).toBe(0);
});

test("gives the page a scroll padding at its bottom as high as the area with the 24 px below it while the area shows, and none at its top", async () => {
  await windowSize(1280, 800);
  const { screen } = await renderArea();
  const style = getComputedStyle(document.documentElement);
  const padding = () => Number.parseFloat(style.scrollPaddingBottom);
  // The scroll padding less the height that the area takes from the bottom
  // of the window.
  const difference = () =>
    padding() - (window.innerHeight - box(messagesRegion()).top);
  expect(padding()).toBe(0);

  await showMessages(screen, 1);

  await expect.poll(difference).toBeCloseTo(0);
  const one = padding();
  expect(one).toBeGreaterThan(24);
  await screen.getByRole("button", { name: "Show a message" }).click();
  await expect.element(messageNamed("First: message 2.")).toBeVisible();
  await expect.poll(padding).toBeGreaterThan(one);
  await expect.poll(difference).toBeCloseTo(0);
  expect(style.scrollPaddingTop).toBe("0px");
  await dismissOf(messageNamed("First: message 2.")).click();
  await dismissOf(messageNamed("First: message 1.")).click();
  await expect.element(messagesRegion()).not.toBeInTheDocument();
  expect(padding()).toBe(0);
});

test("keeps room at the end of the content, so that its end scrolls above the area, which grows with the area, does not shrink when a message goes, and goes when another screen opens", async () => {
  await windowSize(1280, 800);
  const { router, screen } = await renderArea();
  const root = document.documentElement;
  const initial = root.scrollHeight;
  const last = screen.getByRole("button", { name: "Last control" });
  const region = messagesRegion();
  async function scrollToEnd() {
    window.scrollTo(0, root.scrollHeight);
    await expect
      .poll(() => window.scrollY)
      .toBeCloseTo(root.scrollHeight - window.innerHeight, 0);
  }
  // The space below the last control at the end of the page, its own space
  // at the end of the content, which shows above the area once it shows.
  await scrollToEnd();
  const space = window.innerHeight - box(last).bottom;
  expect(space).toBeGreaterThanOrEqual(24);
  const oldest = "Sentinel isn't available right now.";
  const middle = "Sentinel can't be reached.";
  const newest = "Something went wrong in Sentinel.";
  show({ tone: "danger", text: oldest, reference: REFERENCE });
  await expect.element(messageNamed(oldest)).toBeVisible();

  await scrollToEnd();

  expect(box(region).top - box(last).bottom).toBeCloseTo(space, 0);
  show({ tone: "danger", text: middle, reference: REFERENCE });
  show({ tone: "danger", text: newest, reference: REFERENCE });
  await expect.element(messageNamed(newest)).toBeVisible();
  await nextFrames();
  await scrollToEnd();
  expect(box(region).top - box(last).bottom).toBeCloseTo(space, 0);
  const grown = root.scrollHeight;
  expect(grown).toBeGreaterThan(initial);
  const end = window.scrollY;
  const place = placeOf(last);
  // The two newer messages go, then the last one.
  for (const text of [newest, middle, oldest]) {
    await dismissOf(messageNamed(text)).click();
    await expect.element(messageNamed(text)).not.toBeInTheDocument();
    await nextFrames();
    expect(root.scrollHeight).toBe(grown);
    expect(window.scrollY).toBe(end);
    expect(placeOf(last)).toEqual(place);
  }
  expect(region.query()).toBeNull();
  router.history.push("/second");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "Second" }))
    .toBeVisible();
  await expect.poll(() => root.scrollHeight).toBe(initial);
});

test("keeps the room at the end of the content, also once its messages have gone, when another tab of the same screen opens, and lets it go when another screen opens", async () => {
  await windowSize(1280, 800);
  const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
  const root = document.documentElement;
  const initial = root.scrollHeight;
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  await expect.poll(() => root.scrollHeight).toBeGreaterThan(initial);
  const grown = root.scrollHeight;
  await dismissOf(message).click();
  await expect.element(message).not.toBeInTheDocument();
  await nextFrames();
  expect(root.scrollHeight).toBe(grown);

  // Audit log shows the same content as the first tab, so the page keeps
  // its height while the room stays.
  router.history.push("/tickets/SNTL-42/audit-log");

  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Audit log of SNTL-42" }),
    )
    .toBeVisible();
  await nextFrames();
  expect(root.scrollHeight).toBe(grown);
  router.history.push("/tickets/SNTL-420");
  await expect
    .element(screen.getByRole("heading", { level: 1, name: "SNTL-420" }))
    .toBeVisible();
  await expect.poll(() => root.scrollHeight).toBe(initial);
});

test("scrolls a control that takes the focus from the keyboard out from under the area", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const region = messagesRegion();
  await expect.element(region).toBeVisible();
  const next = screen.getByRole("button", { name: "Next control" });
  // The window scrolls so that the control lies under the area.
  window.scrollTo(
    0,
    window.scrollY + box(next).bottom - (window.innerHeight - 30),
  );
  await expect.poll(() => box(next).top).toBeGreaterThan(box(region).top);
  // The control before Next control.
  screen
    .getByRole("button", { name: "Start a change of SNTL-42" })
    .element()
    .focus({ preventScroll: true });

  await userEvent.keyboard("{Tab}");

  await expect.element(next).toHaveFocus();
  await expect
    .poll(() => box(next).bottom)
    .toBeLessThanOrEqual(box(region).top);
});

test.each([
  [
    "a popover",
    "More details",
    "Edit",
    () => page.getByRole("dialog", { name: "More details of the record" }),
  ],
  [
    "a menu",
    "Actions of SNTL-42",
    "More details",
    () => page.getByRole("menuitem", { name: "Rerun convergence" }),
  ],
])(
  "scrolls the button of %s out from under the area as Escape closes it and the focus returns to the button without scrolling",
  async (_, name, before, opened) => {
    await page.viewport(1280, 800);
    const { screen } = await renderArea("/overlays", "Overlays");
    show({
      tone: "danger",
      text: "Sentinel isn't available right now.",
      reference: REFERENCE,
    });
    const region = messagesRegion();
    await expect.element(region).toBeVisible();
    const button = screen.getByRole("button", { name, exact: true });
    // The keyboard moves the focus onto the button, from the control before
    // it, and the window scrolls it above the area; then the window scrolls
    // so that it lies under the area.
    screen
      .getByRole("button", { name: before, exact: true })
      .element()
      .focus({ preventScroll: true });
    await userEvent.keyboard("{Tab}");
    await expect.element(button).toHaveFocus();
    await nextFrames();
    await scrollBottomTo(button, underArea());
    expect(overlaps(box(button), box(region))).toBe(true);
    const scrolled = window.scrollY;
    await userEvent.keyboard("{Enter}");
    await expect.element(opened()).toHaveFocus();

    await userEvent.keyboard("{Escape}");

    await expect.element(button).toHaveFocus();
    await expect
      .poll(() => box(button).bottom)
      .toBeLessThanOrEqual(box(region).top);
    expect(window.scrollY).toBeGreaterThan(scrolled);
  },
);

test("scrolls a control that a script focuses without scrolling out from under the area once the focus has moved", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/overlays", "Overlays");
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const region = messagesRegion();
  await expect.element(region).toBeVisible();
  const edit = screen.getByRole("button", { name: "Edit", exact: true });
  await scrollBottomTo(edit, underArea());
  expect(overlaps(box(edit), box(region))).toBe(true);
  const scrolled = window.scrollY;

  // A focus that the browser shows, as after a key.
  edit.element().focus({ preventScroll: true, focusVisible: true });

  await expect.element(edit).toHaveFocus();
  await expect
    .poll(() => box(edit).bottom)
    .toBeLessThanOrEqual(box(region).top);
  expect(window.scrollY).toBeGreaterThan(scrolled);
});

test("leaves the page where it is as a press of the pointer on the part of a field that the area leaves uncovered focuses the field, whose focus the browser shows, while the rest of it lies under the area", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/field", "Field");
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const region = messagesRegion();
  await expect.element(region).toBeVisible();
  const field = screen.getByRole("textbox", { name: "Summary" });
  // The field reaches 20 px down under the area, and past its end.
  await scrollBottomTo(field, box(region).top + 20);
  const shown = box(field);
  expect(overlaps(shown, box(region))).toBe(true);
  expect(shown.right).toBeGreaterThan(box(region).right);
  // A point of the field above the area, which the pointer reaches, as
  // Playwright reaches it without scrolling the page, which it would do for
  // a point within the scroll padding at its bottom.
  const point = { x: shown.width / 2, y: 5 };
  expect(
    document.elementFromPoint(shown.left + point.x, shown.top + point.y),
  ).toBe(field.element());
  const scrolled = window.scrollY;
  const place = placeOf(field);

  await field.click({ position: point });

  await expect.element(field).toHaveFocus();
  expect(field.element().matches(":focus-visible")).toBe(true);
  await nextFrames();
  expect(window.scrollY).toBe(scrolled);
  expect(placeOf(field)).toEqual(place);
});

test.each([
  ["without an input of the user before", async () => {}],
  [
    "more than 100 ms after a key of the user, which the focus that moves then does not follow",
    async () => {
      // A key that moves nothing, such as one that starts a change whose
      // failure the UI shows later.
      await userEvent.keyboard("{Shift}");
      const pressed = performance.now();
      // More than the 100 ms after a key within which a focus that moves
      // follows it pass, on the clock of the page, from an instant after the
      // key.
      await expect.poll(() => performance.now() - pressed).toBeGreaterThan(100);
    },
  ],
])(
  "scrolls the control to which the UI moved the focus without scrolling as a message appears, %s, out from under the area once the message shows",
  async (_, before) => {
    await page.viewport(1280, 800);
    const { screen } = await renderArea("/overlays", "Overlays");
    const edit = screen.getByRole("button", { name: "Edit", exact: true });
    // The control lies where the area shows.
    await scrollBottomTo(edit, underArea());
    const scrolled = window.scrollY;
    await before();
    // The UI moves the focus, which the browser shows, as React Aria returns
    // it to the button of a menu whose change failed; then the message of
    // the failure appears.
    edit.element().focus({ preventScroll: true, focusVisible: true });
    await expect.element(edit).toHaveFocus();
    await nextFrames();
    expect(window.scrollY).toBe(scrolled);

    show({
      tone: "danger",
      text: "Sentinel isn't available right now.",
      reference: REFERENCE,
    });

    const region = messagesRegion();
    await expect.element(region).toBeVisible();
    await expect
      .poll(() => box(edit).bottom)
      .toBeLessThanOrEqual(box(region).top);
    expect(window.scrollY).toBeGreaterThan(scrolled);
    await expect.element(edit).toHaveFocus();
  },
);

test("scrolls the control to which the UI moved the focus without scrolling while a message shows out from under the area as it shows once another message appears, which makes it higher", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea("/overlays", "Overlays");
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const region = messagesRegion();
  await expect.element(region).toBeVisible();
  const edit = screen.getByRole("button", { name: "Edit", exact: true });
  await scrollBottomTo(edit, underArea());
  // The UI moves the focus, which the browser shows, without an input of the
  // user since: the control scrolls above the area as it shows with one
  // message.
  edit.element().focus({ preventScroll: true, focusVisible: true });
  await expect.element(edit).toHaveFocus();
  await expect
    .poll(() => box(edit).bottom)
    .toBeLessThanOrEqual(box(region).top);
  await nextFrames();
  const top = box(region).top;
  const scrolled = window.scrollY;

  // The message of the failure appears in a later commit, above the one
  // that shows.
  show({
    tone: "danger",
    text: "Sentinel can't be reached.",
    reference: REFERENCE,
  });

  await expect
    .element(messageNamed("Sentinel can't be reached."))
    .toBeVisible();
  expect(box(region).top).toBeLessThan(top);
  await expect
    .poll(() => box(edit).bottom)
    .toBeLessThanOrEqual(box(region).top);
  expect(window.scrollY).toBeGreaterThan(scrolled);
  await expect.element(edit).toHaveFocus();
});

test("scrolls the control at the end of the content to which the UI moved the focus without scrolling while a message shows out from under the area once another message appears, as soon as the room at the end of the content has grown with the area", async () => {
  await windowSize(1280, 800);
  const { screen } = await renderArea();
  const root = document.documentElement;
  show({
    tone: "danger",
    text: "Sentinel isn't available right now.",
    reference: REFERENCE,
  });
  const region = messagesRegion();
  await expect.element(region).toBeVisible();
  await nextFrames();
  // The end of the page, where the last control of the content shows above
  // the area, by the room at the end of the content.
  window.scrollTo(0, root.scrollHeight);
  await expect
    .poll(() => window.scrollY)
    .toBeCloseTo(root.scrollHeight - window.innerHeight, 0);
  const last = screen.getByRole("button", { name: "Last control" });
  expect(box(last).bottom).toBeLessThanOrEqual(box(region).top);
  // The UI moves the focus, which the browser shows, without an input of the
  // user since.
  last.element().focus({ preventScroll: true, focusVisible: true });
  await expect.element(last).toHaveFocus();
  await nextFrames();
  const top = box(region).top;
  const end = root.scrollHeight - window.innerHeight;
  expect(window.scrollY).toBeCloseTo(end, 0);

  // The message of the failure appears in a later commit, above the one
  // that shows: the page cannot scroll the control above the higher area
  // until the room at the end of the content has grown.
  show({
    tone: "danger",
    text: "Sentinel can't be reached.",
    reference: REFERENCE,
  });

  await expect
    .element(messageNamed("Sentinel can't be reached."))
    .toBeVisible();
  expect(box(region).top).toBeLessThan(top);
  await expect
    .poll(() => root.scrollHeight - window.innerHeight)
    .toBeGreaterThan(end);
  await expect
    .poll(() => box(last).bottom)
    .toBeLessThanOrEqual(box(region).top);
  expect(window.scrollY).toBeGreaterThan(end);
  await expect.element(last).toHaveFocus();
});

test("leaves the page where it is as Tab and Shift+Tab move the focus into the area and among its messages", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  show({ tone: "warning", text: "Sentinel can't be reached." });
  show({ tone: "danger", text: "Sentinel isn't available right now." });
  const older = messageNamed("Sentinel can't be reached.");
  const newer = messageNamed("Sentinel isn't available right now.");
  await expect.element(newer).toBeVisible();
  window.scrollTo(0, 600);
  await expect.poll(() => window.scrollY).toBe(600);
  screen
    .getByRole("button", { name: "Last control" })
    .element()
    .focus({ preventScroll: true });

  await userEvent.keyboard("{Tab}");

  await expect.element(dismissOf(newer)).toHaveFocus();
  await nextFrames();
  expect(window.scrollY).toBe(600);
  await userEvent.keyboard("{Tab}");
  await expect.element(dismissOf(older)).toHaveFocus();
  await nextFrames();
  expect(window.scrollY).toBe(600);
  await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
  await expect.element(dismissOf(newer)).toHaveFocus();
  await nextFrames();
  expect(window.scrollY).toBe(600);
});

test("moves the focus with F6 and Shift+F6 to the newest message, which takes it itself with its focus ring inside it, and from within the area back to where it was", async () => {
  applyThemePreference("light");
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });
  await showMessages(screen, 1);
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
  const newest = messageNamed("SNTL-42: Priority changed to P2.");
  await expect.element(newest).toBeVisible();
  await expect.element(button).toHaveFocus();

  await userEvent.keyboard("{F6}");

  await expect.element(newest).toHaveFocus();
  // focus of the light theme.
  const style = getComputedStyle(newest.element());
  expect([style.outlineStyle, style.outlineColor, style.outlineOffset]).toEqual(
    ["solid", "rgb(9, 105, 218)", "-2px"],
  );
  // Tab reaches its link and its Dismiss, then those of the older messages.
  await userEvent.keyboard("{Tab}");
  await expect
    .element(newest.getByRole("link", { name: "SNTL-42" }))
    .toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect.element(dismissOf(newest)).toHaveFocus();
  await userEvent.keyboard("{Tab}");
  await expect
    .element(dismissOf(messageNamed("First: message 1.")))
    .toHaveFocus();
  await userEvent.keyboard("{F6}");
  await expect.element(button).toHaveFocus();
  await userEvent.keyboard("{Shift>}{F6}{/Shift}");
  await expect.element(newest).toHaveFocus();
  await userEvent.keyboard("{Shift>}{F6}{/Shift}");
  await expect.element(button).toHaveFocus();
});

test("returns the focus with F6 to the screen's heading when the element that had it before it entered the area is gone", async () => {
  const { screen } = await renderArea();
  show({ tone: "danger", text: "Sentinel isn't available right now." });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  const edit = screen.getByRole("button", { name: "Edit priority" });
  edit.element().focus();
  await userEvent.keyboard("{F6}");
  await expect.element(message).toHaveFocus();
  removeControl?.();
  await expect.element(edit).not.toBeInTheDocument();

  await userEvent.keyboard("{F6}");

  await expect.element(screenHeading(screen)).toHaveFocus();
});

test("returns the focus with Shift+F6 to the screen's heading when no element had it before it entered the area", async () => {
  const { screen } = await renderArea();
  show({ tone: "danger", text: "Sentinel isn't available right now." });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  expect(document.activeElement).toBe(document.body);
  await userEvent.keyboard("{Shift>}{F6}{/Shift}");
  await expect.element(message).toHaveFocus();

  await userEvent.keyboard("{Shift>}{F6}{/Shift}");

  await expect.element(screenHeading(screen)).toHaveFocus();
});

// Presses F6 on the element as the browser tells it to the page, and tells
// whether the page left the key to the browser, whose default action a key
// that the page handles cancels. A synthetic event, so that the browser's own
// use of the key, such as moving to its address bar, does not take the focus
// from the page of the tests.
function pressF6(element: Element, modifiers: KeyboardEventInit = {}) {
  return element.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "F6",
      code: "F6",
      bubbles: true,
      cancelable: true,
      ...modifiers,
    }),
  );
}

test("leaves F6 and Shift+F6 to the browser without a message and while a popover keeps the area out of reach, and F6 with Alt, Control, or Meta always", async () => {
  const { screen } = await renderArea();
  const details = screen.getByRole("button", { name: "Details" });
  details.element().focus();

  expect(pressF6(details.element())).toBe(true);
  expect(pressF6(details.element(), { shiftKey: true })).toBe(true);
  await expect.element(details).toHaveFocus();

  show({ tone: "danger", text: "Sentinel isn't available right now." });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  await nextFrames();
  for (const modifier of [
    { altKey: true },
    { ctrlKey: true },
    { metaKey: true },
  ]) {
    expect(pressF6(details.element(), modifier)).toBe(true);
  }
  await expect.element(details).toHaveFocus();
  const area = messagesRegion().element();
  await details.click();
  const popover = screen.getByRole("dialog", { name: "Details of the record" });
  await expect.element(popover).toHaveFocus();
  await expect.poll(() => inReach(area)).toBe(false);
  await nextFrames();
  expect(pressF6(popover.element())).toBe(true);
  expect(pressF6(popover.element(), { shiftKey: true })).toBe(true);
  await expect.element(popover).toHaveFocus();
  // Once the popover has closed, the page takes F6 again.
  await userEvent.keyboard("{Escape}");
  await expect.element(details).toHaveFocus();
  await expect.poll(() => inReach(area)).toBe(true);
  await nextFrames();
  expect(pressF6(details.element())).toBe(false);
  await expect.element(message).toHaveFocus();
});

test("leaves the focus where it was when the pointer presses Dismiss", async () => {
  const { screen } = await renderArea();
  show({ tone: "warning", text: "Sentinel can't be reached." });
  show({ tone: "danger", text: "Sentinel isn't available right now." });
  const older = messageNamed("Sentinel can't be reached.");
  const newer = messageNamed("Sentinel isn't available right now.");
  await expect.element(newer).toBeVisible();
  const details = screen.getByRole("button", { name: "Details" });
  details.element().focus();

  await dismissOf(newer).click();

  await expect.element(newer).not.toBeInTheDocument();
  await expect.element(details).toHaveFocus();
  await dismissOf(older).click();
  await expect.element(older).not.toBeInTheDocument();
  await nextFrames();
  await expect.element(details).toHaveFocus();
});

test("moves the focus, when a message goes while it holds it, to the Dismiss of the newer message beside it, or of the older one where it was the newest, and after the last back to where it was before it entered the area", async () => {
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });
  await showMessages(screen, 3);
  const oldest = messageNamed("First: message 1.");
  const middle = messageNamed("First: message 2.");
  const newest = messageNamed("First: message 3.");
  await expect.element(button).toHaveFocus();
  await userEvent.keyboard("{F6}");
  await userEvent.keyboard("{Tab}");
  await userEvent.keyboard("{Tab}");
  await expect.element(dismissOf(middle)).toHaveFocus();

  await userEvent.keyboard("{Enter}");

  await expect.element(middle).not.toBeInTheDocument();
  await expect.element(dismissOf(newest)).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(newest).not.toBeInTheDocument();
  await expect.element(dismissOf(oldest)).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(oldest).not.toBeInTheDocument();
  await expect.element(button).toHaveFocus();
});

test("still returns the focus with F6 to where it was before it entered the area after it moved to the Dismiss of another message, as the message that held it went", async () => {
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });
  await showMessages(screen, 2);
  const newest = messageNamed("First: message 2.");
  await userEvent.keyboard("{F6}");
  await userEvent.keyboard("{Tab}");
  await expect.element(dismissOf(newest)).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(newest).not.toBeInTheDocument();
  await expect
    .element(dismissOf(messageNamed("First: message 1.")))
    .toHaveFocus();

  await userEvent.keyboard("{F6}");

  await expect.element(button).toHaveFocus();
});

test("moves the focus to the screen's heading after the last message goes while it holds it, when no element had it before it entered the area", async () => {
  const { screen } = await renderArea();
  await showMessages(screen, 1);
  const message = messageNamed("First: message 1.");
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  dismissOf(message).element().focus();

  await userEvent.keyboard("{Enter}");

  await expect.element(message).not.toBeInTheDocument();
  await expect.element(screenHeading(screen)).toHaveFocus();
});

test("moves the focus to the screen's heading after the last message goes while it holds it, when the element that had it before it entered the area is gone", async () => {
  const { screen } = await renderArea();
  show({ tone: "danger", text: "Sentinel isn't available right now." });
  const message = messageNamed("Sentinel isn't available right now.");
  await expect.element(message).toBeVisible();
  const edit = screen.getByRole("button", { name: "Edit priority" });
  edit.element().focus();
  await userEvent.keyboard("{F6}");
  await userEvent.keyboard("{Tab}");
  await expect.element(dismissOf(message)).toHaveFocus();
  removeControl?.();
  await expect.element(edit).not.toBeInTheDocument();

  await userEvent.keyboard("{Enter}");

  await expect.element(message).not.toBeInTheDocument();
  await expect.element(screenHeading(screen)).toHaveFocus();
});

// The countdown of the messages that go on their own runs on a fake clock of
// the timers and of the date of the page, which the test moves itself.
function fakeClock() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
}

// A check that retries moves a fake clock by its interval before each retry
// (Vitest's expect.poll and expect.element), so the checks on the fake clock
// retry without an interval, and the clock moves only as the test moves it.
const ON_FAKE_CLOCK = { interval: 0 };

// Moves the fake clock, then waits for the frames in which React renders what
// a timer that ran set.
async function clockMoves(ms: number) {
  vi.advanceTimersByTime(ms);
  await nextFrames();
}

// The animations that run in an element and its descendants, by name, and
// whether each runs or is paused.
function animationsIn(element: Element) {
  return element.getAnimations({ subtree: true }).map((animation) => ({
    name: animation instanceof CSSAnimation ? animation.animationName : "",
    state: animation.playState,
  }));
}

// Waits until the line of the time left of a message shows the state of its
// countdown, which runs or waits, then for the frames in which React runs the
// effects of that render, which stop or start the countdown itself.
async function countdownShows(message: Element, state: AnimationPlayState) {
  await expect
    .poll(() => animationsIn(message), ON_FAKE_CLOCK)
    .toEqual([{ name: "countdown", state }]);
  await nextFrames();
}

// Shows a success message that goes on its own, on the fake clock, with the
// pointer on the screen's heading, at the top of the window, away from the
// area at its bottom, and returns it once its countdown runs.
async function showGoingMessage(screen: Screen) {
  await screenHeading(screen).hover();
  fakeClock();
  show({ tone: "success", text: "API key revoked.", goesOnItsOwn: true });
  const message = messageNamed("API key revoked.");
  await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
  await countdownShows(message.element(), "running");
  return message;
}

test.each(["success", "info"] as const)(
  "makes a %s message that goes on its own go 10 seconds after it appears, with its line of the time left running until then",
  async (tone) => {
    const { screen } = await renderArea();
    await screenHeading(screen).hover();
    fakeClock();

    show({ tone, text: "API key revoked.", goesOnItsOwn: true });

    const message = messageNamed("API key revoked.");
    await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
    await nextFrames();
    const [line] = message.element().getAnimations({ subtree: true });
    expect(animationsIn(message.element())).toEqual([
      { name: "countdown", state: "running" },
    ]);
    expect(line?.effect?.getComputedTiming().duration).toBe(MESSAGE_TIMEOUT_MS);
    await clockMoves(MESSAGE_TIMEOUT_MS - 1);
    expect(message.query()).not.toBeNull();
    await clockMoves(1);
    await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
    expect(messagesRegion().query()).toBeNull();
  },
);

// The top edge of a message, inside its border line, where the line of the
// time left shows: the colors at its start, its middle, and its end.
async function topEdge(message: Locator): Promise<string[]> {
  const picture = await screenshot(message);
  return [8, picture.width / 2, picture.width - 8].map((x) => picture.at(x, 2));
}

test.each([
  [
    "a success message that does not say that it goes on its own",
    "success",
    undefined,
    "#dafbe1",
  ],
  ["a warning message, even one that says so", "warning", true, "#fff8c5"],
  ["a danger message, even one that says so", "danger", true, "#ffebe9"],
] as const)(
  "keeps %s until it is dismissed, without a line of the time left",
  async (_, tone, goesOnItsOwn, soft) => {
    applyThemePreference("light");
    const { screen } = await renderArea();
    await screenHeading(screen).hover();
    fakeClock();

    show({ tone, text: "Sentinel can't be reached.", goesOnItsOwn });

    const message = messageNamed("Sentinel can't be reached.");
    await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
    await nextFrames();
    expect(animationsIn(message.element())).toEqual([]);
    // The soft background of its tone in the light theme along its top edge.
    expect(await topEdge(message)).toEqual([soft, soft, soft]);
    await clockMoves(10 * MESSAGE_TIMEOUT_MS);
    expect(message.query()).not.toBeNull();
  },
);

test("waits while a mouse is over the area, and then goes on from where it stopped", async () => {
  await page.viewport(1280, 800);
  const { screen } = await renderArea();
  const message = await showGoingMessage(screen);
  await clockMoves(6_000);

  await message.hover();

  await countdownShows(message.element(), "paused");
  await clockMoves(6 * MESSAGE_TIMEOUT_MS);
  expect(message.query()).not.toBeNull();
  await pointerAwayFrom(messagesRegion());
  await countdownShows(message.element(), "running");
  // Vitest moves the fake clock while it moves the pointer, so a moment less
  // than the 4 seconds left remains, though more than 3.
  await clockMoves(3_000);
  expect(message.query()).not.toBeNull();
  await clockMoves(1_000);
  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
});

test("does not wait while a touch is over the area, which does not hover", async () => {
  const { screen } = await renderArea();
  const message = await showGoingMessage(screen);

  // A touch on the area, which the browser tells the page as a pointer of the
  // type touch, as the mouse of the tests cannot be.
  messagesRegion()
    .element()
    .dispatchEvent(new PointerEvent("pointerenter", { pointerType: "touch" }));

  await nextFrames();
  expect(animationsIn(message.element())).toEqual([
    { name: "countdown", state: "running" },
  ]);
  await clockMoves(MESSAGE_TIMEOUT_MS - 1);
  expect(message.query()).not.toBeNull();
  await clockMoves(1);
  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
});

test("waits while the focus is in the area, and then goes on from where it stopped", async () => {
  const { screen } = await renderArea();
  const details = screen.getByRole("button", { name: "Details" });
  details.element().focus();
  const message = await showGoingMessage(screen);
  await clockMoves(6_000);

  await userEvent.keyboard("{F6}");

  await expect.element(message, ON_FAKE_CLOCK).toHaveFocus();
  await countdownShows(message.element(), "paused");
  await clockMoves(6 * MESSAGE_TIMEOUT_MS);
  expect(message.query()).not.toBeNull();
  await userEvent.keyboard("{F6}");
  await expect.element(details, ON_FAKE_CLOCK).toHaveFocus();
  await countdownShows(message.element(), "running");
  await clockMoves(3_999);
  expect(message.query()).not.toBeNull();
  await clockMoves(1);
  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
});

test("waits while the tab is hidden, and then goes on from where it stopped", async () => {
  const { screen } = await renderArea();
  const message = await showGoingMessage(screen);
  await clockMoves(6_000);

  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  document.dispatchEvent(new Event("visibilitychange"));

  await countdownShows(message.element(), "paused");
  await clockMoves(6 * MESSAGE_TIMEOUT_MS);
  expect(message.query()).not.toBeNull();
  hidden.mockReturnValue(false);
  document.dispatchEvent(new Event("visibilitychange"));
  await countdownShows(message.element(), "running");
  await clockMoves(3_999);
  expect(message.query()).not.toBeNull();
  await clockMoves(1);
  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
});

test("waits while a popover keeps the area out of reach, and then goes on from where it stopped", async () => {
  const { screen } = await renderArea();
  const details = screen.getByRole("button", { name: "Details" });
  details.element().focus();
  const message = await showGoingMessage(screen);
  // While the popover is open, the message is out of reach of the locators
  // too.
  const shown = message.element();
  await clockMoves(6_000);

  await userEvent.keyboard("{Enter}");

  const popover = screen.getByRole("dialog", { name: "Details of the record" });
  await expect.element(popover, ON_FAKE_CLOCK).toHaveFocus();
  await expect.poll(() => inReach(shown), ON_FAKE_CLOCK).toBe(false);
  await countdownShows(shown, "paused");
  await clockMoves(6 * MESSAGE_TIMEOUT_MS);
  expect(shown.isConnected).toBe(true);
  await userEvent.keyboard("{Escape}");
  await expect.element(popover, ON_FAKE_CLOCK).not.toBeInTheDocument();
  await countdownShows(shown, "running");
  await clockMoves(3_999);
  expect(shown.isConnected).toBe(true);
  await clockMoves(1);
  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
});

test("goes on its own 10 seconds after it appears also when another tab of the same screen opens in between, whose opening neither removes it nor starts its countdown again", async () => {
  const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
  const message = await showGoingMessage(screen);
  const shown = message.element();
  await clockMoves(6_000);

  router.history.push("/tickets/SNTL-42/audit-log");

  await expect
    .element(
      screen.getByRole("heading", { level: 1, name: "Audit log of SNTL-42" }),
      ON_FAKE_CLOCK,
    )
    .toBeVisible();
  await nextFrames();
  expect(shown.isConnected).toBe(true);
  await countdownShows(shown, "running");
  await clockMoves(3_999);
  expect(shown.isConnected).toBe(true);
  await clockMoves(1);
  await expect.element(message, ON_FAKE_CLOCK).not.toBeInTheDocument();
});

test("shows the line of the time left across the whole width, standing still, under reduced motion", async () => {
  applyThemePreference("light");
  await commands.emulateReducedMotion(true);
  await renderArea();
  // On the fake clock, so that the message stays while the test reads it.
  fakeClock();

  show({ tone: "success", text: "API key revoked.", goesOnItsOwn: true });

  const message = messageNamed("API key revoked.");
  await expect.element(message, ON_FAKE_CLOCK).toBeVisible();
  await nextFrames();
  expect(animationsIn(message.element())).toEqual([]);
  // success-on-soft of the light theme, from the start to the end.
  expect(await topEdge(message)).toEqual(["#0f5323", "#0f5323", "#0f5323"]);
});

test("announces each message as it appears, with its reference, and not again when another one appears or when it goes", async () => {
  const { screen } = await renderArea();
  const button = screen.getByRole("button", { name: "Show a message" });

  await button.click();
  await expect
    .poll(announcements)
    .toEqual([`First: message 1. Reference: ${REFERENCE}`]);
  await button.click();

  // Each message an announcement of its own, which the announcer of the page
  // announces as it arrives, and none in a live region of the area itself.
  await expect
    .poll(announcements)
    .toEqual([
      `First: message 1. Reference: ${REFERENCE}`,
      `First: message 2. Reference: ${REFERENCE}`,
    ]);
  const area = messagesRegion().element();
  expect(area.closest("[aria-live]")).toBeNull();
  expect(area.querySelector("[aria-live], output")).toBeNull();
  const first = announcementNode(`First: message 1. Reference: ${REFERENCE}`);
  expect(first).not.toBeNull();

  await dismissOf(messageNamed("First: message 2.")).click();
  await expect
    .poll(announcements)
    .toEqual([`First: message 1. Reference: ${REFERENCE}`]);
  // The message that stays keeps its node, which assistive technologies do
  // not announce again.
  expect(announcementNode(`First: message 1. Reference: ${REFERENCE}`)).toBe(
    first,
  );
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

test.each([
  [
    "through a link",
    (router: AnyRouter) => {
      router.history.push("/tickets/SNTL-42");
    },
  ],
  [
    "through the browser's Back",
    (router: AnyRouter) => {
      router.history.back();
    },
  ],
])(
  "keeps its messages when another tab of the same screen opens, and when the user returns to the first tab %s",
  async (_, returnToFirst) => {
    const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
    await screen.getByRole("button", { name: "Show a message" }).click();
    const message = mainContent().getByText("SNTL-42: message 1.");
    await expect.element(message).toBeVisible();

    router.history.push("/tickets/SNTL-42/audit-log");

    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "Audit log of SNTL-42" }),
      )
      .toBeVisible();
    await nextFrames();
    expect(message.query()).not.toBeNull();
    returnToFirst(router);
    await expect
      .element(
        screen.getByRole("heading", { level: 1, name: "SNTL-42", exact: true }),
      )
      .toBeVisible();
    await nextFrames();
    expect(message.query()).not.toBeNull();
  },
);

test.each([
  ["an unknown tab of a screen", "/tickets/SNTL-42/fictional-tab"],
  [
    "a path beyond a tab of a screen",
    "/tickets/SNTL-42/audit-log/fictional-part",
  ],
])(
  "removes the messages when %s opens, which shows Not found, a screen of its own",
  async (_, path) => {
    const { router, screen } = await renderArea("/tickets/SNTL-42", "SNTL-42");
    await screen.getByRole("button", { name: "Show a message" }).click();
    await expect
      .element(mainContent().getByText("SNTL-42: message 1."))
      .toBeVisible();

    router.history.push(path);

    await expect
      .element(screen.getByRole("heading", { level: 1, name: "Not found" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("SNTL-42: message 1."))
      .not.toBeInTheDocument();
  },
);

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

test("is used only inside its provider", async () => {
  await expect(renderHook(() => useShowMessage())).rejects.toThrow(
    "The message area is used outside its provider",
  );
});
