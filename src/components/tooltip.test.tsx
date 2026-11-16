import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { Tooltip, TOOLTIP_DELAY_MS } from "./tooltip";

// The tooltip of a control (docs/design-system.md, Menus, Popovers, and
// Tooltips), in the light theme.

// The timers of a tooltip are React Aria's: the delay of hover, how long a
// tooltip that the pointer has left stays, and how long after a tooltip
// closes the next one shows at once on hover. React Aria keeps that last
// state for the whole module, and only its timer ends it, which a tooltip
// that leaves the page open never starts. So the tests run on a fake clock of
// the timers, which they move themselves, and each ends with every tooltip
// closed, the pointer away from its control, where the control of the next
// test would show under it, and every timer passed, so that the next test
// starts as the page does.
function fakeTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
}

beforeEach(() => {
  fakeTimers();
});

afterEach(async () => {
  fakeTimers();
  await userEvent.keyboard("{Escape}");
  await page.getByRole("button", { name: "Before" }).hover();
  vi.runAllTimers();
  vi.useRealTimers();
});

// Waits until the browser has rendered two more frames, in which React has
// rendered what the timers that the test ran set, and run its effects.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
}

// A control with a tooltip after another control, which the tests use first:
// React Aria shows a tooltip on hover only once the user works with a
// pointer, as a click shows.
async function renderTooltip(placement: "top" | "end" = "top") {
  const screen = await render(
    <>
      <Button>Before</Button>
      <Tooltip text="Close navigation" placement={placement}>
        <Button aria-label="Close navigation">x</Button>
      </Tooltip>
    </>,
  );
  await screen.getByRole("button", { name: "Before" }).click();
  return {
    screen,
    control: screen.getByRole("button", { name: "Close navigation" }),
    tooltip: screen.getByRole("tooltip", { name: "Close navigation" }),
  };
}

test("shows at once on keyboard focus, and Escape hides it without moving the focus", async () => {
  const { control, tooltip } = await renderTooltip();

  await userEvent.keyboard("{Tab}");

  await expect.element(control).toHaveFocus();
  await expect.element(tooltip).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(tooltip).not.toBeInTheDocument();
  await expect.element(control).toHaveFocus();
});

test("shows after the pointer has rested on the control for 300 ms", async () => {
  // Measured by the clock of the page, on the timers of the page: an action
  // of Vitest, such as hover, moves a fake clock for as long as it runs.
  vi.useRealTimers();
  const { control, tooltip } = await renderTooltip();
  // When the pointer reached the control, and when the tooltip appeared, by
  // the clock of the page.
  let entered = 0;
  let appeared = 0;
  control.element().addEventListener("pointerenter", () => {
    entered = performance.now();
  });
  const observer = new MutationObserver(() => {
    if (appeared === 0 && document.querySelector('[role="tooltip"]')) {
      appeared = performance.now();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  try {
    await control.hover();
    await expect.element(tooltip).toBeVisible();
  } finally {
    observer.disconnect();
  }

  // 300 ms, less the rounding of the clock of the page, and well before
  // React Aria's own default of 1,500 ms.
  expect(appeared - entered).toBeGreaterThanOrEqual(TOOLTIP_DELAY_MS - 1);
  expect(appeared - entered).toBeLessThan(1000);
});

test("stays while the pointer is over it", async () => {
  const { control, tooltip } = await renderTooltip();
  await control.hover();
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  await expect.element(tooltip).toBeVisible();

  await tooltip.hover();
  // Every timer of the page passes, however long React Aria keeps a tooltip
  // that the pointer has left.
  vi.runAllTimers();
  await nextFrames();

  await expect.element(tooltip).toBeVisible();
});

test("inverts the colors of text", async () => {
  const { tooltip } = await renderTooltip();

  await userEvent.keyboard("{Tab}");

  await expect.element(tooltip).toBeVisible();
  const style = getComputedStyle(tooltip.element());
  // fg and surface of the light theme.
  expect(style.backgroundColor).toBe("rgb(31, 35, 40)");
  expect(style.color).toBe("rgb(255, 255, 255)");
  expect(style.fontSize).toBe("13px");
});

async function renderDisabled() {
  const screen = await render(
    <>
      <Button>Before</Button>
      <Tooltip text="Tickets" placement="end" isDisabled>
        <Button>Tickets</Button>
      </Tooltip>
    </>,
  );
  await screen.getByRole("button", { name: "Before" }).click();
  return { screen, control: screen.getByRole("button", { name: "Tickets" }) };
}

test("never shows on hover when disabled, as where the control shows its name", async () => {
  const { screen, control } = await renderDisabled();

  await control.hover();
  vi.advanceTimersByTime(TOOLTIP_DELAY_MS);
  await nextFrames();

  expect(screen.getByRole("tooltip").query()).toBeNull();
});

test("never shows on keyboard focus when disabled", async () => {
  const { screen, control } = await renderDisabled();

  await userEvent.keyboard("{Tab}");
  await expect.element(control).toHaveFocus();
  await nextFrames();

  expect(screen.getByRole("tooltip").query()).toBeNull();
});

test("shows after the control, to its right, as in the sidebar", async () => {
  const { control, tooltip } = await renderTooltip("end");

  await userEvent.keyboard("{Tab}");

  await expect.element(tooltip).toBeVisible();
  expect(tooltip.element().getBoundingClientRect().left).toBeGreaterThan(
    control.element().getBoundingClientRect().right,
  );
});
