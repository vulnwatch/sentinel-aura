import { useLayoutEffect, useState, type ReactNode } from "react";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  Popover,
} from "react-aria-components";
import { afterEach, expect, test } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { announcements, inReach } from "../test-announcements";
import { Announcement, Announcer, withReference } from "./announcer";

// The announcer of the page, the one live region through which the UI
// announces what appears outside an open overlay (docs/behaviors.md,
// Accessibility, Announcements).

// What the fictional screen announces when the test chooses: a new
// announcement, of the words given, or nothing.
let announce: ((text: string, again?: boolean) => void) | undefined;

afterEach(() => {
  announce = undefined;
});

interface FictionalScreenProps {
  // An overlay that the screen offers.
  overlay?: ReactNode;
}

// A fictional screen that announces what the test gives it, and, beside the
// announcer, a status region of its own, as every part of a screen had one
// before the announcer.
function FictionalScreen({ overlay }: FictionalScreenProps) {
  const [shown, setShown] = useState({ id: 0, text: "" });
  useLayoutEffect(() => {
    announce = (text, again = false) => {
      setShown(({ id }) => ({ id: again ? id + 1 : id, text }));
    };
  }, []);
  return (
    <>
      <h1>Fictional screen</h1>
      {overlay}
      <output aria-label="Status of the screen">{shown.text}</output>
      <Announcement id={shown.id}>{shown.text}</Announcement>
    </>
  );
}

async function renderScreen(overlay?: ReactNode) {
  const screen = await render(
    <Announcer>
      <FictionalScreen overlay={overlay} />
    </Announcer>,
  );
  await expect
    .element(screen.getByRole("heading", { name: "Fictional screen" }))
    .toBeVisible();
  return screen;
}

// The node of the announcer that holds its first announcement.
function firstNode(): Element | null {
  return page.getByRole("status", { name: "Announcements" }).element()
    .firstElementChild;
}

test("is on the page before its first announcement, named Announcements, and takes no room on the screen", async () => {
  await renderScreen();

  const region = page.getByRole("status", { name: "Announcements" });
  await expect.element(region).toBeInTheDocument();
  expect(announcements()).toEqual([]);
  const box = region.element().getBoundingClientRect();
  expect([box.width, box.height]).toEqual([1, 1]);
});

test("announces each announcement on its own, not again those that it held before", async () => {
  await renderScreen();

  expect(
    page
      .getByRole("status", { name: "Announcements" })
      .element()
      .getAttribute("aria-atomic"),
  ).toBe("false");
});

test("holds each announcement in a node of its own, which another one replaces, also with the same words, and removes it with its words", async () => {
  await renderScreen();

  announce?.("NVD: Failure.");
  await expect.poll(announcements).toEqual(["NVD: Failure."]);
  const first = firstNode();
  announce?.("NVD: Failure.", true);

  // A new node, which assistive technologies announce although its words are
  // those of the one before.
  await expect.poll(firstNode).not.toBe(first);
  expect(announcements()).toEqual(["NVD: Failure."]);

  announce?.("OSV: Success.");
  await expect.poll(announcements).toEqual(["OSV: Success."]);

  announce?.("");
  await expect.poll(announcements).toEqual([]);
});

// The modal overlays of the UI, each open as the screen shows: while one is
// open, React Aria hides the rest of the page from assistive technologies.
test.each([
  [
    "a popover",
    <DialogTrigger key="popover" defaultOpen>
      <AriaButton>Details</AriaButton>
      <Popover>
        <Dialog aria-label="Details">Details of the record</Dialog>
      </Popover>
    </DialogTrigger>,
  ],
  [
    "a menu",
    <MenuTrigger key="menu" defaultOpen>
      <AriaButton>Actions</AriaButton>
      <Popover>
        <Menu aria-label="Actions">
          <MenuItem>Refetch</MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>,
  ],
  [
    "a dialog",
    <DialogTrigger key="dialog" defaultOpen>
      <AriaButton>Change</AriaButton>
      <Modal>
        <Dialog aria-label="Change">Fields of the change</Dialog>
      </Modal>
    </DialogTrigger>,
  ],
])(
  "stays in reach of assistive technologies while %s is open, which hides the status regions of the screen, and announces what arrives meanwhile",
  async (_, overlay) => {
    await renderScreen(overlay);
    await expect
      .element(page.getByRole("dialog").or(page.getByRole("menu")).first())
      .toBeVisible();
    // A status region of the screen is out of reach meanwhile, so the
    // overlay hides what is not the announcer.
    const status = page.getByRole("status", { name: "Status of the screen" });
    await expect.poll(() => inReach(status.element())).toBe(false);

    announce?.("NVD: Failure.");

    await expect.poll(announcements).toEqual(["NVD: Failure."]);
  },
);

test("is used only inside the announcer", async () => {
  await expect(
    render(<Announcement>NVD: Failure.</Announcement>),
  ).rejects.toThrow("An announcement is made outside the announcer");
});

test.each([
  ["without a reference", undefined, "This couldn't be updated."],
  [
    "with a reference",
    "01890a5d-ac96-774b-bcce-b302099a8057",
    "This couldn't be updated. Reference: 01890a5d-ac96-774b-bcce-b302099a8057",
  ],
])("gives the words of a message %s", (_, reference, words) => {
  expect(withReference("This couldn't be updated.", reference)).toBe(words);
});
