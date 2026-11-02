import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

// The tooltip of a control (docs/design-system.md, Menus, Popovers, and
// Tooltips), in the light theme.

function wait(milliseconds: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

// A control with a tooltip after another control, which the tests use first:
// React Aria shows a tooltip on hover only once the user works with a
// pointer, as a click shows, and at once while another tooltip has just
// closed.
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
  await wait(1000);
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

test("shows after the pointer has rested on the control for 300 ms, and stays while the pointer is over it", async () => {
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
  expect(appeared - entered).toBeGreaterThanOrEqual(299);
  expect(appeared - entered).toBeLessThan(1000);
  await tooltip.hover();
  await wait(1000);
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

test("shows after the control, to its right, as in the sidebar", async () => {
  const { control, tooltip } = await renderTooltip("end");

  await userEvent.keyboard("{Tab}");

  await expect.element(tooltip).toBeVisible();
  expect(tooltip.element().getBoundingClientRect().left).toBeGreaterThan(
    control.element().getBoundingClientRect().right,
  );
});
