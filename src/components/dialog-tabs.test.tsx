import { Star } from "lucide-react";
import { useState } from "react";
import { expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { DialogTabs, type DialogTab } from "./dialog-tabs";

// The tabs of a dialog (docs/design-system.md, Dialogs), in the light theme.

type Version = "3.1" | "4.0";

// What the mark of the default version says.
const DEFAULT_TEXT = "The default CVSS version of the fictional tests.";

const TABS: readonly DialogTab<Version>[] = [
  {
    id: "3.1",
    label: "CVSS v3.1",
    mark: { icon: Star, name: "the default version", text: DEFAULT_TEXT },
  },
  { id: "4.0", label: "CVSS v4.0" },
];

interface VersionsProps {
  onSelect?: (id: Version) => void;
}

// The tabs of the versions after another control, v3.1 selected at first,
// each tab showing a content of its own.
function Versions({ onSelect = () => undefined }: VersionsProps) {
  const [selected, setSelected] = useState<Version>("3.1");
  return (
    <>
      <Button>Before</Button>
      <DialogTabs
        label="CVSS version"
        tabs={TABS}
        selected={selected}
        onSelect={(id) => {
          setSelected(id);
          onSelect(id);
        }}
      >
        <p>{`The form of v${selected}`}</p>
      </DialogTabs>
    </>
  );
}

// Waits until the browser has rendered two more frames, in which React has
// rendered what the test set off and run the effects of that render.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// The name of the tab of v3.1: its label and the name of its mark. The name
// that assistive technologies compute puts a space before the comma, since
// the name of the mark is an element of its own, which a flex item is not
// inline.
const MARKED_NAME = /^CVSS v3\.1 ?, the default version$/;

// Renders the tabs, and gives the pointer its first use, as React Aria
// shows what follows a hover only once the user works with a pointer.
async function renderVersions(props: VersionsProps = {}) {
  const screen = await render(<Versions {...props} />);
  await screen.getByRole("button", { name: "Before" }).click();
  return {
    screen,
    marked: screen.getByRole("tab", { name: MARKED_NAME }),
    other: screen.getByRole("tab", { name: "CVSS v4.0", exact: true }),
  };
}

test("names its tabs by their labels, a tab with a mark also by the name of the mark, whose text describes it", async () => {
  const { screen, marked, other } = await renderVersions();

  await expect
    .element(screen.getByRole("tablist", { name: "CVSS version" }))
    .toBeVisible();
  await expect.element(marked).toHaveAccessibleDescription(DEFAULT_TEXT);
  await expect.element(other).not.toHaveAccessibleDescription();
  // The mark is an icon that assistive technologies do not read.
  expect(
    marked.element().querySelector("svg")?.getAttribute("aria-hidden"),
  ).toBe("true");
});

test("shows no tooltip while its tab neither is under the pointer nor has keyboard focus", async () => {
  const { screen, marked } = await renderVersions();
  await expect.element(marked).toBeVisible();

  await nextFrames();

  expect(screen.getByRole("tooltip").query()).toBeNull();
});

test("shows the text of the mark in a tooltip while the pointer rests on its tab, until it leaves", async () => {
  const { screen, marked } = await renderVersions();

  await marked.hover();

  const tooltip = page.getByRole("tooltip");
  await expect.element(tooltip).toBeVisible();
  expect(tooltip.element().textContent).toBe(DEFAULT_TEXT);

  await screen.getByRole("button", { name: "Before" }).hover();

  await expect.element(tooltip).not.toBeInTheDocument();
});

test("shows the text of the mark in a tooltip while its tab has keyboard focus, not on the focus of a press", async () => {
  const { screen, marked, other } = await renderVersions();

  await userEvent.keyboard("{Tab}");

  await expect.element(marked).toHaveFocus();
  const tooltip = page.getByRole("tooltip");
  await expect.element(tooltip).toBeVisible();
  expect(tooltip.element().textContent).toBe(DEFAULT_TEXT);
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(other).toHaveFocus();
  await expect.element(tooltip).not.toBeInTheDocument();

  // A press of the pointer gives the tab the focus, which the pointer then
  // leaves.
  await marked.click();
  await screen.getByRole("button", { name: "Before" }).hover();
  await expect.element(marked).toHaveFocus();
  await nextFrames();

  expect(screen.getByRole("tooltip").query()).toBeNull();
});

test("shows no tooltip on a tab without a mark", async () => {
  const { screen, other } = await renderVersions();

  await other.hover();
  await nextFrames();

  expect(screen.getByRole("tooltip").query()).toBeNull();
});

test("selects a tab on a click, Enter, or Space, not when the arrow keys move the focus to it", async () => {
  const onSelect = vi.fn<(id: Version) => void>();
  const { screen, marked, other } = await renderVersions({ onSelect });

  await userEvent.keyboard("{Tab}");
  await expect.element(marked).toHaveFocus();
  await userEvent.keyboard("{ArrowRight}");

  await expect.element(other).toHaveFocus();
  await expect.element(other).toHaveAttribute("aria-selected", "false");
  expect(onSelect).not.toHaveBeenCalled();

  await userEvent.keyboard("{Enter}");

  expect(onSelect).toHaveBeenLastCalledWith("4.0");
  await expect.element(screen.getByText("The form of v4.0")).toBeVisible();
  await expect.element(other).toHaveFocus();

  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(marked).toHaveFocus();
  expect(onSelect).toHaveBeenCalledOnce();
  await userEvent.keyboard(" ");

  expect(onSelect).toHaveBeenLastCalledWith("3.1");
  await expect.element(screen.getByText("The form of v3.1")).toBeVisible();

  await other.click();

  expect(onSelect).toHaveBeenLastCalledWith("4.0");
  await expect.element(screen.getByText("The form of v4.0")).toBeVisible();
});

test("shows the content of the selected tab alone, in its panel", async () => {
  const { screen, other } = await renderVersions();

  const panel = screen.getByRole("tabpanel", { name: MARKED_NAME });
  await expect.element(panel.getByText("The form of v3.1")).toBeVisible();
  expect(screen.getByRole("tabpanel").elements()).toHaveLength(1);

  await other.click();

  await expect
    .element(
      screen
        .getByRole("tabpanel", { name: "CVSS v4.0", exact: true })
        .getByText("The form of v4.0"),
    )
    .toBeVisible();
  expect(screen.getByRole("tabpanel").elements()).toHaveLength(1);
  expect(screen.getByText("The form of v3.1").query()).toBeNull();
});
