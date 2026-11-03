import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { FilterGroup, Filters, type FilterOption } from "./filters";

// The filters of a list (docs/design-system.md, Lists; Menus, Popovers, and
// Tooltips), at a wide window, in the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER = "rgb(216, 222, 228)";
const BORDER_STRONG = "rgb(129, 139, 152)";

type Severity = "critical" | "high" | "low";

const SEVERITIES: readonly FilterOption<Severity>[] = [
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "low", label: "Low" },
];

const PRIORITIES: readonly FilterOption<"p1" | "p2">[] = [
  { value: "p1", label: "P1" },
  { value: "p2", label: "P2" },
];

interface ListFiltersProps {
  // The severities that apply as the list starts.
  initial?: readonly Severity[];
  // Called with the severities that the user selects.
  onChange?: (values: Severity[]) => void;
}

// The filters of a fictional list, at the end of its toolbar, which apply the
// severities that the user selects, as the URL of a list keeps them.
function ListFilters({ initial = [], onChange }: ListFiltersProps) {
  const [severities, setSeverities] = useState<readonly Severity[]>(initial);
  return (
    <div className="flex justify-end p-8">
      <Filters applied={severities.length > 0 ? 1 : 0}>
        <FilterGroup
          label="Severity"
          options={SEVERITIES}
          selected={severities}
          onChange={(values) => {
            onChange?.(values);
            setSeverities(values);
          }}
        />
        <FilterGroup
          label="Priority"
          options={PRIORITIES}
          selected={[]}
          onChange={() => {}}
        />
      </Filters>
    </div>
  );
}

// Opens the popover of the filters, and returns it.
async function openFilters(button: Locator) {
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await expect.element(dialog).toBeVisible();
  return dialog;
}

// The popover around the dialog of the filters, the nearest element around it
// with a border line.
function popoverOf(dialog: Locator): Element {
  let element = dialog.element().parentElement;
  while (
    element !== null &&
    getComputedStyle(element).borderTopWidth !== "1px"
  ) {
    element = element.parentElement;
  }
  return element!;
}

test("is a secondary button 32 px high named Filters while no filter applies", async () => {
  const screen = await render(<ListFilters />);
  const button = screen.getByRole("button", { name: "Filters", exact: true });

  await expect.element(button).toBeVisible();
  // Away from the pointer, which an earlier test can leave over it.
  await userEvent.unhover(button);
  const style = getComputedStyle(button.element());
  expect([
    button.element().getBoundingClientRect().height,
    style.backgroundColor,
    style.borderTopColor,
  ]).toEqual([32, SURFACE, BORDER_STRONG]);
  expect(screen.container.textContent).toBe("Filters");
});

test("shows the number of the filters that apply after its label, which assistive technologies read as applied", async () => {
  const screen = await render(
    <Filters applied={2}>
      <FilterGroup
        label="Severity"
        options={SEVERITIES}
        selected={["high"]}
        onChange={() => {}}
      />
    </Filters>,
  );
  const button = screen.getByRole("button", {
    name: "Filters 2 applied",
    exact: true,
  });

  await expect.element(button).toBeVisible();
  await expect.element(button.getByText("2", { exact: true })).toBeVisible();
  // The words take no room on the screen.
  expect(
    button.getByText("applied").element().getBoundingClientRect().width,
  ).toBeLessThanOrEqual(1);
});

test("opens a dialog named Filters, whose first checkbox takes the focus, with each filter as a group named by its label and listing its values in order", async () => {
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const groups = dialog.getByRole("group");
  expect(groups.elements()).toHaveLength(2);
  for (const [index, [name, values]] of (
    [
      ["Severity", ["Critical", "High", "Low"]],
      ["Priority", ["P1", "P2"]],
    ] as const
  ).entries()) {
    await expect.element(groups.nth(index)).toHaveAccessibleName(name);
    const boxes = groups.nth(index).getByRole("checkbox");
    expect(boxes.elements()).toHaveLength(values.length);
    for (const [position, value] of values.entries()) {
      await expect.element(boxes.nth(position)).toHaveAccessibleName(value);
      await expect.element(boxes.nth(position)).not.toBeChecked();
    }
  }
  await expect
    .element(dialog.getByRole("checkbox", { name: "Critical" }))
    .toHaveFocus();
});

test("applies the values that the user selects at once, in the order of the values of the filter", async () => {
  const onChange = vi.fn<(values: Severity[]) => void>();
  const screen = await render(<ListFilters onChange={onChange} />);
  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );
  const severity = dialog.getByRole("group", { name: "Severity" });

  await severity.getByText("Low", { exact: true }).click();
  expect(onChange).toHaveBeenLastCalledWith(["low"]);
  await severity.getByText("Critical", { exact: true }).click();
  expect(onChange).toHaveBeenLastCalledWith(["critical", "low"]);
  await severity.getByText("Low", { exact: true }).click();
  expect(onChange).toHaveBeenLastCalledWith(["critical"]);

  expect(onChange).toHaveBeenCalledTimes(3);
  // The popover stays, with the values that apply checked.
  await expect
    .element(severity.getByRole("checkbox", { name: "Critical" }))
    .toBeChecked();
  await expect
    .element(severity.getByRole("checkbox", { name: "Low" }))
    .not.toBeChecked();
});

test("shows the values that apply as checked", async () => {
  const screen = await render(<ListFilters initial={["critical", "low"]} />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters 1 applied" }),
  );

  const severity = dialog.getByRole("group", { name: "Severity" });
  await expect
    .element(severity.getByRole("checkbox", { name: "Critical" }))
    .toBeChecked();
  await expect
    .element(severity.getByRole("checkbox", { name: "High" }))
    .not.toBeChecked();
  await expect
    .element(severity.getByRole("checkbox", { name: "Low" }))
    .toBeChecked();
});

test("closes with Escape, and returns the focus to Filters", async () => {
  const screen = await render(<ListFilters />);
  const button = screen.getByRole("button", { name: "Filters" });
  const dialog = await openFilters(button);
  await expect
    .element(dialog.getByRole("checkbox", { name: "Critical" }))
    .toHaveFocus();

  await userEvent.keyboard("{Escape}");

  await expect.element(dialog).not.toBeInTheDocument();
  await expect.element(button).toHaveFocus();
});

test("opens below Filters, aligned to its end, on surface with a border line, an 8 px radius, a shadow, and 16 px of padding, 448 px wide", async () => {
  const screen = await render(<ListFilters />);
  const button = screen.getByRole("button", { name: "Filters" });

  const dialog = await openFilters(button);

  const popover = popoverOf(dialog);
  const style = getComputedStyle(popover);
  expect([
    style.backgroundColor,
    style.borderTopColor,
    style.borderTopLeftRadius,
    style.paddingTop,
    style.paddingLeft,
  ]).toEqual([SURFACE, BORDER, "8px", "16px", "16px"]);
  expect(style.boxShadow).not.toBe("none");
  const box = popover.getBoundingClientRect();
  const trigger = button.element().getBoundingClientRect();
  expect(box.width).toBe(448);
  expect(box.top - trigger.bottom).toBe(4);
  expect(box.right).toBeCloseTo(trigger.right);
});

test("takes the width of a narrow window", async () => {
  await page.viewport(320, 640);
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const box = popoverOf(dialog).getBoundingClientRect();
  expect(box.left).toBeGreaterThanOrEqual(0);
  expect(box.right).toBeLessThanOrEqual(320);
});

test("names each filter in text-12, weight 500, fg-muted, and shows the filters 16 px apart", async () => {
  const screen = await render(<ListFilters />);

  const dialog = await openFilters(
    screen.getByRole("button", { name: "Filters" }),
  );

  const name = getComputedStyle(
    dialog.getByText("Severity", { exact: true }).element(),
  );
  expect([name.fontSize, name.fontWeight, name.color]).toEqual([
    "12px",
    "500",
    FG_MUTED,
  ]);
  expect(
    dialog
      .getByRole("group", { name: "Priority" })
      .element()
      .getBoundingClientRect().top -
      dialog
        .getByRole("group", { name: "Severity" })
        .element()
        .getBoundingClientRect().bottom,
  ).toBe(16);
});
