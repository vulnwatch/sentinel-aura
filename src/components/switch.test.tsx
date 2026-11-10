import { useState } from "react";
import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Switch } from "./switch";

// A switch (docs/design-system.md, Forms), at the browser's default text
// size, in the light theme.

// The colors of docs/design-system.md (Color Tokens; Tones) in the light
// theme.
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const NEUTRAL_SOFT = "rgb(239, 242, 245)";
const ACCENT = "rgb(9, 105, 218)";
const ON_ACCENT = "rgb(255, 255, 255)";
const FOCUS = "rgb(9, 105, 218)";

interface ChoiceProps {
  initial?: boolean;
  isDisabled?: boolean;
}

// A choice that the switch turns on or off, which says its state.
function Choice({ initial = false, isDisabled = false }: ChoiceProps) {
  const [on, setOn] = useState(initial);
  return (
    <div className="p-4">
      <Switch isSelected={on} onChange={setOn} isDisabled={isDisabled}>
        Show hidden 4
      </Switch>
      <p>{on ? "Hidden records shown" : "Hidden records hidden"}</p>
    </div>
  );
}

// The target of the switch, its rail and its label, which its text finds,
// and the rail and the knob, which are hidden from assistive technologies:
// what shows at the start of the target, inside the boundary of the rail,
// and at the center of the knob, 8 px inside the rail from its start, or
// from its end when the switch is on.
function partsOf(target: Element, on = false) {
  const box = target.getBoundingClientRect();
  const middle = box.top + box.height / 2;
  const rail = document.elementFromPoint(box.left + 0.5, middle);
  if (!(rail instanceof HTMLElement)) {
    throw new Error("The switch has no rail");
  }
  const railBox = rail.getBoundingClientRect();
  const knob = document.elementFromPoint(
    on ? railBox.right - 8 : railBox.left + 8,
    middle,
  );
  if (!(knob instanceof HTMLElement) || knob === rail) {
    throw new Error("The switch has no knob");
  }
  return { rail, knob };
}

// The whole target of the switch, its rail and its label.
function targetOf(screen: Awaited<ReturnType<typeof render>>): HTMLElement {
  const target = screen.getByText("Show hidden 4").element();
  if (!(target instanceof HTMLElement)) {
    throw new Error("The switch has no target");
  }
  return target;
}

test("reads as a switch named by its label, off or on, and turns on and off with a click and Space", async () => {
  const screen = await render(<Choice />);
  const toggle = screen.getByRole("switch", { name: "Show hidden 4" });
  await expect.element(toggle).not.toBeChecked();

  await screen.getByText("Show hidden 4").click();

  await expect.element(toggle).toBeChecked();
  await expect.element(screen.getByText("Hidden records shown")).toBeVisible();
  await userEvent.keyboard(" ");
  await expect.element(toggle).not.toBeChecked();
});

test("shows a rail of 28 by 16 px with a knob of 12 px at its start, then its label 6 px later, in text-13, fg-muted, as one target at least 24 px high", async () => {
  const screen = await render(<Choice />);
  const label = targetOf(screen);
  const { rail, knob } = partsOf(label);

  const railBox = rail.getBoundingClientRect();
  expect([railBox.width, railBox.height]).toEqual([28, 16]);
  const railStyle = getComputedStyle(rail);
  // Round: a radius of at least half its height.
  expect(Number.parseFloat(railStyle.borderRadius)).toBeGreaterThanOrEqual(8);
  expect(railStyle.borderTopWidth).toBe("1px");
  expect(railStyle.borderTopColor).toBe(BORDER_STRONG);
  expect(railStyle.backgroundColor).toBe(NEUTRAL_SOFT);
  const knobBox = knob.getBoundingClientRect();
  expect([knobBox.width, knobBox.height]).toEqual([12, 12]);
  expect(knobBox.left - railBox.left).toBe(2);
  expect(getComputedStyle(knob).backgroundColor).toBe(FG_MUTED);
  const labelStyle = getComputedStyle(label);
  expect(labelStyle.fontSize).toBe("13px");
  expect(labelStyle.color).toBe(FG_MUTED);
  const range = document.createRange();
  range.selectNodeContents(label);
  range.setStartAfter(rail);
  expect(range.getBoundingClientRect().left - railBox.right).toBe(6);
  expect(label.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
});

test("fills the rail and its boundary in accent when on, with the knob in on-accent at its end", async () => {
  const screen = await render(<Choice initial />);
  const { rail, knob } = partsOf(targetOf(screen), true);

  const railStyle = getComputedStyle(rail);
  expect(railStyle.backgroundColor).toBe(ACCENT);
  expect(railStyle.borderTopColor).toBe(ACCENT);
  expect(getComputedStyle(knob).backgroundColor).toBe(ON_ACCENT);
  expect(
    rail.getBoundingClientRect().right - knob.getBoundingClientRect().right,
  ).toBe(2);
});

test("shows the focus ring around the rail on keyboard focus", async () => {
  const screen = await render(<Choice />);
  const { rail } = partsOf(targetOf(screen));

  await userEvent.keyboard("{Tab}");

  await expect.element(screen.getByRole("switch")).toHaveFocus();
  const style = getComputedStyle(rail);
  expect(style.outlineStyle).toBe("solid");
  expect(style.outlineWidth).toBe("2px");
  expect(style.outlineOffset).toBe("2px");
  expect(style.outlineColor).toBe(FOCUS);
});

test("shows at 60 % opacity when disabled, and does not turn on", async () => {
  const screen = await render(<Choice isDisabled />);
  const toggle = screen.getByRole("switch");
  const label = targetOf(screen);

  await expect.element(toggle).toBeDisabled();
  expect(getComputedStyle(label).opacity).toBe("0.6");
  await screen.getByText("Show hidden 4").click({ force: true });
  await expect.element(toggle).not.toBeChecked();
});
