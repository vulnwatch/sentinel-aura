import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Label, LabelList } from "./label";

// A label and a value made of labels (docs/design-system.md, Labels), at the
// browser's default text size, in the light theme.

// fg-muted and border-strong of the light theme.
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER_STRONG = "rgb(129, 139, 152)";

function rectOf(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

// The look of a label: text-12, weight 500, fg-muted, a 1 px border-strong
// boundary, a 4 px radius, and 4 px of side padding.
function lookOf(element: Element): string[] {
  const style = getComputedStyle(element);
  return [
    style.fontSize,
    style.fontWeight,
    style.color,
    style.borderTopWidth,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.paddingLeft,
  ];
}

const LOOK = ["12px", "500", FG_MUTED, "1px", BORDER_STRONG, "4px", "4px"];

test("shows a label in its look", async () => {
  const screen = await render(<Label>Inactive</Label>);

  expect(lookOf(screen.getByText("Inactive").element())).toEqual(LOOK);
});

test("shows a value made of labels as a list, so that assistive technologies tell one label from the next", async () => {
  const screen = await render(
    <LabelList labels={["Open Source", "Researcher"]} />,
  );

  const items = screen.getByRole("listitem").elements();
  expect(items.map((item) => item.textContent)).toEqual([
    "Open Source",
    "Researcher",
  ]);
  expect(lookOf(items[0]!)).toEqual(LOOK);
  // 6 px apart on one line.
  expect(rectOf(items[1]!).left - rectOf(items[0]!).right).toBe(6);
  expect(rectOf(items[1]!).top).toBe(rectOf(items[0]!).top);
});

test("wraps the labels to the next line, 4 px below, and the text of a label wider than the value within its boundary", async () => {
  const long =
    "Fictional Researcher (Fictional Pilot of the Example Numbering Authorities)";
  const screen = await render(
    <div className="w-40">
      <LabelList labels={["Vendor", long]} />
    </div>,
  );

  const [vendor, wide] = screen.getByRole("listitem").elements();
  expect(rectOf(wide!).top - rectOf(vendor!).bottom).toBe(4);
  // Within the value, on several lines.
  expect(rectOf(wide!).right).toBeLessThanOrEqual(
    rectOf(wide!.parentElement!).right,
  );
  expect(rectOf(wide!).height).toBeGreaterThan(2 * rectOf(vendor!).height);
});
