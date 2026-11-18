import { Star } from "lucide-react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { DialogTabs, type DialogTab } from "./dialog-tabs";
import { TOOLTIP_DELAY_MS } from "./tooltip";

// The tabs of a dialog (docs/design-system.md, Dialogs), in the light theme.

type Version = "3.1" | "4.0";

// What the mark of the default version says.
const DEFAULT_TEXT = "The default CVSS version of the fictional tests.";

// How long the tooltip of a mark stays after the pointer leaves the tab and
// the tooltip.
const CLOSE_DELAY_MS = 500;

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

// Renders the tabs, and gives the pointer its first use, as React Aria
// shows what follows a hover only once the user works with a pointer.
async function renderVersions(props: VersionsProps = {}) {
  const screen = await render(<Versions {...props} />);
  await screen.getByRole("button", { name: "Before" }).click();
  // The keys Escape that reach the element around the tabs, as they reach a
  // dialog that holds them.
  const escapes: string[] = [];
  screen.container.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      escapes.push(event.key);
    }
  });
  return {
    screen,
    escapes,
    before: screen.getByRole("button", { name: "Before" }),
    marked: screen.getByRole("tab", {
      name: "CVSS v3.1, the default version",
      exact: true,
    }),
    other: screen.getByRole("tab", { name: "CVSS v4.0", exact: true }),
    tooltip: page.getByRole("tooltip"),
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

  const panel = screen.getByRole("tabpanel", {
    name: "CVSS v3.1, the default version",
    exact: true,
  });
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

// Whether a tooltip shows on the page.
function tooltipShows(): boolean {
  return document.querySelector('[role="tooltip"]') !== null;
}

// When the tooltip of the page appears, and when it leaves the page, by the
// clock of the page, from the time at which the test starts to follow it.
function followTooltip() {
  const times: { shown?: number; hidden?: number } = {};
  let shown = tooltipShows();
  const observer = new MutationObserver(() => {
    const now = tooltipShows();
    if (now && !shown && times.shown === undefined) {
      times.shown = performance.now();
    }
    if (!now && shown && times.hidden === undefined) {
      times.hidden = performance.now();
    }
    shown = now;
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return {
    times,
    stop: () => {
      observer.disconnect();
    },
  };
}

function fakeTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
}

// The tooltip of a mark (docs/design-system.md, Dialogs; Menus, Popovers, and
// Tooltips). Its timers run on a fake clock that the tests move themselves,
// except where a test measures a delay on the clock of the page: an action of
// Vitest, such as hover, moves a fake clock for as long as it runs. Each test
// ends with the pointer away from the tabs and every timer passed.
describe("the tooltip of a mark", () => {
  beforeEach(() => {
    fakeTimers();
  });

  afterEach(async () => {
    // Only after a test on the clock of the page: installing the fake clock
    // again would drop the timers that the test left.
    if (!vi.isFakeTimers()) {
      fakeTimers();
    }
    await page.getByRole("button", { name: "Before" }).hover();
    vi.runAllTimers();
    vi.useRealTimers();
  });

  test("does not show while its tab neither is under the pointer nor has keyboard focus", async () => {
    const { marked, tooltip } = await renderVersions();
    await expect.element(marked).toBeVisible();

    vi.advanceTimersByTime(TOOLTIP_DELAY_MS + CLOSE_DELAY_MS);
    await nextFrames();

    expect(tooltip.query()).toBeNull();
  });

  test("shows the text of the mark after the pointer has rested on its tab for 300 ms, not at once", async () => {
    // Measured by the clock of the page, on the timers of the page.
    vi.useRealTimers();
    const { marked, tooltip } = await renderVersions();
    let entered = 0;
    marked.element().addEventListener("pointerenter", () => {
      entered = performance.now();
    });
    const followed = followTooltip();

    try {
      await marked.hover();
      await expect.element(tooltip).toBeVisible();
    } finally {
      followed.stop();
    }

    expect(tooltip.element().textContent).toBe(DEFAULT_TEXT);
    // 300 ms, less the rounding of the clock of the page.
    const delay = (followed.times.shown ?? 0) - entered;
    expect(delay).toBeGreaterThanOrEqual(TOOLTIP_DELAY_MS - 1);
    expect(delay).toBeLessThan(1000);
  });

  test("shows the text of the mark at once on keyboard focus of its tab, and hides it once the focus moves to another tab", async () => {
    const { marked, other, tooltip } = await renderVersions();

    await userEvent.keyboard("{Tab}");

    await expect.element(marked).toHaveFocus();
    await expect.element(tooltip).toBeVisible();
    expect(tooltip.element().textContent).toBe(DEFAULT_TEXT);

    await userEvent.keyboard("{ArrowRight}");

    await expect.element(other).toHaveFocus();
    await expect.element(tooltip).not.toBeInTheDocument();
  });

  test("stays while the pointer moves from its tab onto it and rests there", async () => {
    const { marked, tooltip } = await renderVersions();
    await marked.hover();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    await expect.element(tooltip).toBeVisible();

    await tooltip.hover();
    // Every timer of the page passes, however long the tooltip waits after
    // the pointer leaves the tab.
    vi.runAllTimers();
    await nextFrames();
    vi.advanceTimersByTime(10 * CLOSE_DELAY_MS);
    await nextFrames();

    await expect.element(tooltip).toBeVisible();
  });

  test.each([
    ["its tab", false],
    ["the tooltip, onto which it moved from its tab", true],
  ])("hides 500 ms after the pointer leaves %s", async (_, throughTooltip) => {
    // Measured by the clock of the page, on the timers of the page.
    vi.useRealTimers();
    const { before, marked, tooltip } = await renderVersions();
    await marked.hover();
    await expect.element(tooltip).toBeVisible();
    if (throughTooltip) {
      await tooltip.hover();
    }
    let left = 0;
    before.element().addEventListener("pointerenter", () => {
      left = performance.now();
    });
    const followed = followTooltip();

    try {
      expect(tooltip.query()).not.toBeNull();
      await before.hover();
      await expect.element(tooltip).not.toBeInTheDocument();
    } finally {
      followed.stop();
    }

    // 500 ms, less the rounding of the clock of the page.
    expect(followed.times.hidden).toBeDefined();
    const delay = (followed.times.hidden ?? 0) - left;
    expect(delay).toBeGreaterThanOrEqual(CLOSE_DELAY_MS - 1);
    expect(delay).toBeLessThan(1500);
  });

  test("hides with Escape, which does not reach the element around the tabs, and shows again once its tab regains keyboard focus", async () => {
    const { escapes, marked, tooltip } = await renderVersions();
    await userEvent.keyboard("{Tab}");
    await expect.element(tooltip).toBeVisible();

    await userEvent.keyboard("{Escape}");

    await expect.element(tooltip).not.toBeInTheDocument();
    await expect.element(marked).toHaveFocus();
    expect(escapes).toEqual([]);

    // Into the panel, and back to the tab.
    await userEvent.keyboard("{Tab}");
    await expect.element(marked).not.toHaveFocus();
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

    await expect.element(marked).toHaveFocus();
    await expect.element(tooltip).toBeVisible();
  });

  test("hides with Escape while the pointer rests on its tab, which does not reach the element around the tabs, which receives Escape once it is hidden", async () => {
    const { escapes, marked, tooltip } = await renderVersions();
    await marked.hover();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    await expect.element(tooltip).toBeVisible();

    await userEvent.keyboard("{Escape}");

    await expect.element(tooltip).not.toBeInTheDocument();
    expect(escapes).toEqual([]);

    await userEvent.keyboard("{Escape}");

    expect(escapes).toEqual(["Escape"]);
  });

  test("shows again once the pointer has left the tab after Escape hid it, and rests on it again", async () => {
    const { before, marked, tooltip } = await renderVersions();
    await marked.hover();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    await expect.element(tooltip).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(tooltip).not.toBeInTheDocument();

    await before.hover();
    vi.advanceTimersByTime(CLOSE_DELAY_MS);
    await marked.hover();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);

    await expect.element(tooltip).toBeVisible();
  });

  test("does not show on the focus of a press of the pointer once the pointer has left its tab", async () => {
    const { before, marked, tooltip } = await renderVersions();

    await marked.click();
    await before.hover();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS + CLOSE_DELAY_MS);
    await nextFrames();

    await expect.element(marked).toHaveFocus();
    expect(tooltip.query()).toBeNull();
  });

  test("does not show on a tab without a mark", async () => {
    const { other, tooltip } = await renderVersions();

    await other.hover();
    vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
    await nextFrames();

    expect(tooltip.query()).toBeNull();
  });
});

// The tabs in a place that centers them with their content, as a dialog
// does, v4.0 selected at first, whose content is shorter than that of v3.1,
// so that the tabs move as the selected tab changes.
function CenteredVersions() {
  const [selected, setSelected] = useState<Version>("4.0");
  return (
    <div className="flex h-screen flex-col justify-center">
      <DialogTabs
        label="CVSS version"
        tabs={TABS}
        selected={selected}
        onSelect={setSelected}
      >
        <p className={selected === "3.1" ? "h-40" : "h-10"}>
          {`The form of v${selected}`}
        </p>
      </DialogTabs>
    </div>
  );
}

test("places the tooltip of a mark again above its tab once the tab, selected, has moved with the content", async () => {
  const screen = await render(<CenteredVersions />);
  const marked = screen.getByRole("tab", {
    name: "CVSS v3.1, the default version",
    exact: true,
  });
  const tooltip = page.getByRole("tooltip");
  await userEvent.keyboard("{Tab}");
  await expect
    .element(screen.getByRole("tab", { name: "CVSS v4.0", exact: true }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowLeft}");
  await expect.element(tooltip).toBeVisible();
  const before = marked.element().getBoundingClientRect().top;

  await userEvent.keyboard("{Enter}");

  await expect.element(screen.getByText("The form of v3.1")).toBeVisible();
  expect(marked.element().getBoundingClientRect().top).toBeLessThan(before);
  // 6 px above the tab, where it moved.
  await expect
    .poll(
      () =>
        marked.element().getBoundingClientRect().top -
        tooltip.element().getBoundingClientRect().bottom,
    )
    .toBeCloseTo(6, 0);
});
