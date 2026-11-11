import { expect, test } from "vitest";
import { render } from "vitest-browser-react";
import "../styles.css";
import {
  DescriptionGroup,
  DescriptionItem,
  DescriptionList,
  GroupedItem,
} from "./description-list";

// The fields of a record as a description list (docs/design-system.md,
// Detail Screens), at the browser's default text size, in the light theme.

// fg and fg-muted of the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";

// The place of the list: 288 px, as the side column of a detail screen,
// 280 px, or 279 px.
const WIDTHS = {
  side: "w-72",
  least: "w-[280px]",
  narrow: "w-[279px]",
} as const;

function renderList(width: keyof typeof WIDTHS) {
  return render(
    <div className={WIDTHS[width]}>
      <DescriptionList>
        <DescriptionItem term="Assignee">Alice Smith</DescriptionItem>
        <DescriptionGroup term="Deadlines">
          <GroupedItem term="Triage" tone="text-fg-muted">
            12 Oct 2099, 14:05
          </GroupedItem>
          <GroupedItem term="Submission">27 Oct 2099, 14:05</GroupedItem>
        </DescriptionGroup>
        <DescriptionItem term="Created">9 Oct 2099, 14:05</DescriptionItem>
      </DescriptionList>
    </div>,
  );
}

function rectOf(element: Element): DOMRect {
  return element.getBoundingClientRect();
}

// The rectangle of the text of an element, without its padding.
function textRectOf(element: Element): DOMRect {
  const range = document.createRange();
  range.selectNodeContents(element);
  return range.getBoundingClientRect();
}

test("shows each term on the line of its value, in text-13 and fg-muted, in a column of 104 px, 12 px before the value in text-14 and fg, the fields 8 px apart", async () => {
  const screen = await renderList("side");
  const term = screen.getByText("Assignee").element();
  const value = screen.getByText("Alice Smith").element();

  expect(screen.getByRole("term").elements()).toHaveLength(5);
  expect(rectOf(value).left - rectOf(term).left).toBe(116);
  // On the same line, which their baselines align, whatever the rounding.
  expect(Math.abs(rectOf(value).top - rectOf(term).top)).toBeLessThanOrEqual(1);
  expect([
    getComputedStyle(term).fontSize,
    getComputedStyle(term).color,
  ]).toEqual(["13px", FG_MUTED]);
  expect([
    getComputedStyle(value).fontSize,
    getComputedStyle(value).color,
  ]).toEqual(["14px", FG]);
  // From the field to the next, whose term starts its line.
  const deadlines = screen.getByText("Deadlines").element();
  expect(
    rectOf(deadlines.parentElement!).top - rectOf(term.parentElement!).bottom,
  ).toBe(8);
});

test("shows the term of a group on a line of its own, then its fields 4 px apart, their terms indented by 12 px in the column of the terms", async () => {
  const screen = await renderList("side");
  const deadlines = screen.getByText("Deadlines").element();
  const triage = screen.getByText("Triage").element();
  const submission = screen.getByText("Submission").element();
  const date = screen.getByText("27 Oct 2099, 14:05").element();

  expect(rectOf(triage).top).toBeGreaterThanOrEqual(rectOf(deadlines).bottom);
  expect(textRectOf(triage).left - rectOf(deadlines).left).toBe(12);
  expect(rectOf(submission).top - rectOf(triage).bottom).toBe(4);
  expect(rectOf(date).left - rectOf(deadlines).left).toBe(116);
  expect(getComputedStyle(submission).fontSize).toBe("14px");
  expect(getComputedStyle(triage).color).toBe(FG_MUTED);
  expect(getComputedStyle(submission).color).toBe(FG);
});

test("shows each term on the line of its value where the list is 280 px wide", async () => {
  const screen = await renderList("least");
  const term = screen.getByText("Assignee").element();
  const value = screen.getByText("Alice Smith").element();

  expect(rectOf(value).left - rectOf(term).left).toBe(116);
  expect(Math.abs(rectOf(value).top - rectOf(term).top)).toBeLessThanOrEqual(1);
});

test("shows each term above its value where the list is narrower than 280 px", async () => {
  const screen = await renderList("narrow");
  const term = screen.getByText("Assignee").element();
  const value = screen.getByText("Alice Smith").element();

  expect(rectOf(value).top).toBeGreaterThanOrEqual(rectOf(term).bottom);
  expect(rectOf(value).left).toBe(rectOf(term).left);
});

// A list whose terms take the width of the longest one, as the popover of a
// value shows it (docs/design-system.md, Menus, Popovers, and Tooltips), in
// a place of 288 px, or narrower than 280 px.
function renderFittedList(width: "side" | "narrow") {
  return render(
    <div className={WIDTHS[width]}>
      <DescriptionList fittedTerms>
        <DescriptionGroup term="Exploitability">
          <GroupedItem term="Privileges required">None</GroupedItem>
          <GroupedItem term="Attack vector">Network</GroupedItem>
        </DescriptionGroup>
        <DescriptionItem term="Scope">Unchanged</DescriptionItem>
        <DescriptionGroup term="Impact">
          <GroupedItem term="Integrity">High</GroupedItem>
        </DescriptionGroup>
      </DescriptionList>
    </div>,
  );
}

test("gives the column of the terms the width of the longest one, 12 px before the values, without wrapping a term", async () => {
  const screen = await renderFittedList("side");
  const longest = screen.getByText("Privileges required").element();
  const values = ["None", "Network", "Unchanged", "High"].map((value) =>
    screen.getByText(value, { exact: true }).element(),
  );

  // Every value starts at the same place, 12 px after the longest term,
  // which stays on one line.
  expect(new Set(values.map((value) => rectOf(value).left)).size).toBe(1);
  expect(rectOf(values[0]!).left - textRectOf(longest).right).toBeCloseTo(
    12,
    0,
  );
  expect(textRectOf(longest).height).toBeLessThanOrEqual(20);
  expect(textRectOf(longest).width).toBeGreaterThan(104 - 12);
  // The groups keep their term on a line of its own, their fields indented
  // by 12 px and 4 px apart, and the fields 8 px apart.
  const exploitability = screen.getByText("Exploitability").element();
  expect(rectOf(longest).top).toBeGreaterThanOrEqual(
    rectOf(exploitability).bottom,
  );
  expect(textRectOf(longest).left - rectOf(exploitability).left).toBe(12);
  const vector = screen.getByText("Attack vector").element();
  // 4 px and 8 px, whatever the rounding of the lines.
  expect(
    Math.abs(rectOf(vector).top - rectOf(longest).bottom - 4),
  ).toBeLessThanOrEqual(1);
  const scope = screen.getByText("Scope").element();
  expect(
    Math.abs(rectOf(scope).top - rectOf(vector).bottom - 8),
  ).toBeLessThanOrEqual(1);
  expect(getComputedStyle(scope).color).toBe(FG_MUTED);
});

test("shows each term of a list whose terms take the width of the longest one above its value where the list is narrower than 280 px", async () => {
  const screen = await renderFittedList("narrow");
  const term = screen.getByText("Scope").element();
  const value = screen.getByText("Unchanged").element();

  expect(rectOf(value).top).toBeGreaterThanOrEqual(rectOf(term).bottom);
  expect(rectOf(value).left).toBe(rectOf(term).left);
});
