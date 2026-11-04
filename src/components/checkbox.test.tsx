import { CheckboxGroup, Label } from "react-aria-components";
import { expect, test } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Checkbox } from "./checkbox";

// A checkbox of a group of checkboxes (docs/design-system.md, Forms), in the
// light theme.

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const ACCENT = "rgb(9, 105, 218)";
const ON_ACCENT = "rgb(255, 255, 255)";
const FOCUS = "rgb(9, 105, 218)";

// A group whose checkboxes start each its own line at the start of the group:
// Critical with its label as text, and High with its label in an element of
// its own, as a label with a mark.
async function renderGroup() {
  const screen = await render(
    <CheckboxGroup className="flex flex-col items-start">
      <Label>Severity</Label>
      <Checkbox value="critical">Critical</Checkbox>
      <Checkbox value="high">
        <span>High</span>
      </Checkbox>
    </CheckboxGroup>,
  );
  return {
    screen,
    group: screen.getByRole("group", { name: "Severity" }),
    critical: screen.getByRole("checkbox", { name: "Critical" }),
    // The whole target of Critical, its box and its label, which its text
    // finds.
    target: screen.getByText("Critical", { exact: true }),
  };
}

// The box of a checkbox, which is hidden from assistive technologies: what
// shows at the start of the line of its label, inside its boundary.
function boxOf(group: Locator, label: Locator): Element {
  const { left } = group.element().getBoundingClientRect();
  const { top, height } = label.element().getBoundingClientRect();
  return document.elementFromPoint(left + 1, top + height / 2)!;
}

// What shows at the center of the box, where its check shows.
function centerOf(box: Element): Element {
  const { left, top, width, height } = box.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2)!;
}

test("is named by its label, in its group", async () => {
  const { group, critical } = await renderGroup();

  await expect.element(critical).toBeVisible();
  await expect.element(critical).not.toBeChecked();
  await expect
    .element(group.getByRole("checkbox", { name: "High" }))
    .toBeVisible();
});

test("toggles when the user clicks its label or its box", async () => {
  const { group, critical, target } = await renderGroup();

  await target.click();
  await expect.element(critical).toBeChecked();

  const box = boxOf(group, target).getBoundingClientRect();
  const start = target.element().getBoundingClientRect();
  await target.click({
    position: {
      x: box.left - start.left + box.width / 2,
      y: box.top - start.top + box.height / 2,
    },
  });
  await expect.element(critical).not.toBeChecked();
});

test("toggles with Space", async () => {
  const { critical } = await renderGroup();

  await userEvent.keyboard("{Tab}");
  await expect.element(critical).toHaveFocus();
  await userEvent.keyboard(" ");
  await expect.element(critical).toBeChecked();
  await userEvent.keyboard(" ");
  await expect.element(critical).not.toBeChecked();
});

test("shows a box of 16 px with a border-strong boundary and a 4 px radius on surface, without its check, while it is not selected", async () => {
  const { group, target } = await renderGroup();
  await expect.element(target).toBeVisible();
  const box = boxOf(group, target);
  const style = getComputedStyle(box);

  const { width, height } = box.getBoundingClientRect();
  expect([width, height]).toEqual([16, 16]);
  expect([
    style.borderTopWidth,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.backgroundColor,
  ]).toEqual(["1px", BORDER_STRONG, "4px", SURFACE]);
  expect(centerOf(box)).toBe(box);
});

test("fills its box with accent, with its check in on-accent, while it is selected", async () => {
  const { group, critical, target } = await renderGroup();

  await target.click();

  await expect.element(critical).toBeChecked();
  const box = boxOf(group, target);
  const style = getComputedStyle(box);
  expect([style.borderTopColor, style.backgroundColor]).toEqual([
    ACCENT,
    ACCENT,
  ]);
  const check = centerOf(box);
  expect(check).toBeInstanceOf(SVGElement);
  expect(box.contains(check)).toBe(true);
  expect(getComputedStyle(check).color).toBe(ON_ACCENT);
});

test("is a target at least 24 px high, its label in text-14 and fg, 6 px after its box", async () => {
  const { screen, group, target } = await renderGroup();
  const high = screen.getByText("High", { exact: true });

  await expect.element(target).toBeVisible();
  const style = getComputedStyle(target.element());
  expect(
    target.element().getBoundingClientRect().height,
  ).toBeGreaterThanOrEqual(24);
  expect([style.fontSize, style.color]).toEqual(["14px", FG]);
  expect(
    high.element().getBoundingClientRect().left -
      boxOf(group, high).getBoundingClientRect().right,
  ).toBe(6);
});

test("shows the focus ring around its box on keyboard focus", async () => {
  const { group, critical, target } = await renderGroup();
  await expect.element(target).toBeVisible();
  expect(getComputedStyle(boxOf(group, target)).outlineStyle).toBe("none");

  await userEvent.keyboard("{Tab}");

  await expect.element(critical).toHaveFocus();
  const style = getComputedStyle(boxOf(group, target));
  expect([
    style.outlineStyle,
    style.outlineWidth,
    style.outlineColor,
    style.outlineOffset,
  ]).toEqual(["solid", "2px", FOCUS, "2px"]);
});
