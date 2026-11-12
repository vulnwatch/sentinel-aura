import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { DateRangeFilter, type DateRange } from "./date-range-filter";

// A range of dates as a filter of a list (docs/design-system.md, Lists;
// Forms; docs/behaviors.md, Dates and Times, Input), at a wide window, in
// the light theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG_MUTED = "rgb(89, 99, 110)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";
const DANGER_ICON = "rgb(207, 34, 46)";

const INCOMPLETE = "Enter the day, the month, and the year.";
const OUTSIDE = "Enter a date from 1 Jan 1970 to 30 Dec 9999.";
const INVERTED = "This date is before the start.";

interface PeriodProps {
  // The range that applies as the list starts.
  initial?: DateRange;
  // Called with the range that the user applies.
  onApply?: (range: DateRange) => void;
}

// The period of a fictional list, which applies the range that the user
// applies, as the URL of a list keeps it, and Clear, which removes it, as
// Clear filters does.
function Period({ initial = {}, onApply }: PeriodProps) {
  const [applied, setApplied] = useState<DateRange>(initial);
  return (
    <div className="flex flex-col items-start gap-4 p-8">
      <DateRangeFilter
        startLabel="From"
        endLabel="To"
        applied={applied}
        min="1970-01-01"
        max="9999-12-30"
        onApply={(range) => {
          onApply?.(range);
          setApplied(range);
        }}
      />
      <Button
        onPress={() => {
          setApplied({});
        }}
      >
        Clear
      </Button>
    </div>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;

// The date field of an end of the range.
function fieldOf(screen: Screen, name: string): Locator {
  return screen.getByRole("group", { name });
}

// What a date field shows, such as 01/11/2099 or dd/mm/yyyy without a date.
function shownIn(screen: Screen, name: string): string | null {
  return fieldOf(screen, name).element().textContent;
}

// Types a date, such as 01112099, into a date field, from its day.
async function typeDate(screen: Screen, name: string, digits: string) {
  await fieldOf(screen, name).getByRole("spinbutton").first().click();
  await userEvent.keyboard(digits);
}

// Whether a date field is marked as invalid for assistive technologies.
function invalid(screen: Screen, name: string): boolean {
  return fieldOf(screen, name)
    .getByRole("spinbutton")
    .elements()
    .every((part) => part.getAttribute("aria-invalid") === "true");
}

test("shows two date fields named by their ends, each with the parts day, month, and year of the range that applies, 160 px wide, 40 px high, and 12 px apart, with its name above it in text-12, weight 500, fg-muted", async () => {
  const screen = await render(<Period initial={{ start: "2099-11-01" }} />);

  const from = fieldOf(screen, "From");
  const to = fieldOf(screen, "To");
  expect(shownIn(screen, "From")).toBe("01/11/2099");
  expect(shownIn(screen, "To")).toBe("dd/mm/yyyy");
  const parts = from.getByRole("spinbutton");
  for (const [index, name] of ["day", "month", "year"].entries()) {
    await expect
      .element(parts.nth(index))
      .toHaveAccessibleName(new RegExp(`^${name},? From$`));
  }
  const fromBox = from.element().getBoundingClientRect();
  const toBox = to.element().getBoundingClientRect();
  expect([fromBox.width, fromBox.height]).toEqual([160, 40]);
  expect(toBox.left - fromBox.right).toBe(12);
  expect(toBox.top).toBe(fromBox.top);
  const name = screen.getByText("From", { exact: true }).element();
  const style = getComputedStyle(name);
  expect([style.fontSize, style.fontWeight, style.color]).toEqual([
    "12px",
    "500",
    FG_MUTED,
  ]);
  expect(fromBox.top - name.getBoundingClientRect().bottom).toBe(4);
  expect(getComputedStyle(from.element()).borderTopColor).toBe(BORDER_STRONG);
});

test.each([
  ["the end", "To"],
  ["the start", "From"],
])("applies both dates with Enter in the field of %s", async (_, last) => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(<Period onApply={onApply} />);
  const first = last === "To" ? "From" : "To";
  await typeDate(screen, first, first === "From" ? "01112099" : "08112099");
  await typeDate(screen, last, last === "From" ? "01112099" : "08112099");

  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: "2099-11-01",
    end: "2099-11-08",
  });
});

test("applies a range with only one bound, and the first and the last date that the fields take", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(<Period onApply={onApply} />);

  await typeDate(screen, "From", "01011970");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: "1970-01-01",
    end: undefined,
  });

  await typeDate(screen, "To", "30129999");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: "1970-01-01",
    end: "9999-12-30",
  });
});

test("removes a bound with Enter in a field that the user emptied", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period
      initial={{ start: "2099-11-01", end: "2099-11-08" }}
      onApply={onApply}
    />,
  );
  await fieldOf(screen, "From").getByRole("spinbutton").last().click();

  // Backspace removes a digit, and in an empty part moves to the part
  // before it.
  await userEvent.keyboard(`${"{Backspace}".repeat(10)}{Enter}`);

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: undefined,
    end: "2099-11-08",
  });
  expect(shownIn(screen, "From")).toBe("dd/mm/yyyy");
});

test.each([
  ["a field with only some of its parts", "From", "0111", "", INCOMPLETE],
  ["a date before the first", "From", "31121969", "", OUTSIDE],
  ["a date after the last", "To", "", "31129999", OUTSIDE],
  ["a start after the end", "To", "08112099", "01112099", INVERTED],
])(
  "applies nothing for %s, and shows the error of a field at it",
  async (_, field, start, end, message) => {
    const onApply = vi.fn<(range: DateRange) => void>();
    const screen = await render(<Period onApply={onApply} />);
    if (start !== "") {
      await typeDate(screen, "From", start);
    }
    if (end !== "") {
      await typeDate(screen, "To", end);
    }

    await userEvent.keyboard("{Enter}");

    const error = screen.getByText(message, { exact: true });
    await expect.element(error).toBeVisible();
    expect(onApply).not.toHaveBeenCalled();
    const other = field === "From" ? "To" : "From";
    expect([invalid(screen, field), invalid(screen, other)]).toEqual([
      true,
      false,
    ]);
    // The error follows its field and describes it.
    await expect
      .element(fieldOf(screen, field).getByRole("spinbutton").first())
      .toHaveAccessibleDescription(new RegExp(message.replace(".", "\\.")));
    const box = fieldOf(screen, field).element().getBoundingClientRect();
    expect(error.element().getBoundingClientRect().top).toBeGreaterThan(
      box.bottom,
    );
    const style = getComputedStyle(error.element());
    expect([style.fontSize, style.fontWeight, style.color]).toEqual([
      "13px",
      "500",
      DANGER_ON_SOFT,
    ]);
    const boundary = getComputedStyle(fieldOf(screen, field).element());
    expect([boundary.borderTopWidth, boundary.borderTopColor]).toEqual([
      "2px",
      DANGER_ICON,
    ]);
    // The field keeps its size with its wider boundary.
    expect(box.height).toBe(40);
    // Announced in the status region of the range, after the name of its
    // field.
    expect(screen.getByRole("status").element().textContent).toBe(
      `${field}: ${message}`,
    );
  },
);

test("announces the errors of both fields in one status region, each after the name of its field, which is there before them and says nothing once they go", async () => {
  const screen = await render(<Period />);
  const status = screen.getByRole("status");
  await expect.element(status).toBeInTheDocument();
  expect(status.element().textContent).toBe("");
  const region = status.element();
  await typeDate(screen, "From", "01");
  await typeDate(screen, "To", "31129999");

  await userEvent.keyboard("{Enter}");

  await expect
    .element(status)
    .toHaveTextContent(`From: ${INCOMPLETE} To: ${OUTSIDE}`);
  expect(status.element()).toBe(region);
  // Not a field error of its own: the region takes no room on the screen.
  expect(status.element().getBoundingClientRect().width).toBeLessThanOrEqual(1);

  screen.getByRole("button", { name: "Clear" }).element().focus();

  await expect.poll(() => status.element().textContent).toBe("");
});

test("keeps the error and the typed dates while the focus moves from one field to the other, and removes the error when the user changes either date", async () => {
  const screen = await render(<Period />);
  await typeDate(screen, "From", "08112099");
  await typeDate(screen, "To", "01112099");
  await userEvent.keyboard("{Enter}");
  const error = screen.getByText(INVERTED, { exact: true });
  await expect.element(error).toBeVisible();

  await fieldOf(screen, "From").getByRole("spinbutton").first().click();

  await expect.element(error).toBeVisible();
  expect(shownIn(screen, "From")).toBe("08/11/2099");
  expect(shownIn(screen, "To")).toBe("01/11/2099");

  await userEvent.keyboard("0");

  await expect.element(error).not.toBeInTheDocument();
  expect(invalid(screen, "To")).toBe(false);
});

test("returns both fields to the range that applies, without errors, when the focus leaves both fields", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period initial={{ start: "2099-11-01" }} onApply={onApply} />,
  );
  await typeDate(screen, "From", "08112099");
  await typeDate(screen, "To", "01");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByText(INCOMPLETE, { exact: true }))
    .toBeVisible();

  screen.getByRole("button", { name: "Clear" }).element().focus();

  await expect
    .element(screen.getByText(INCOMPLETE, { exact: true }))
    .not.toBeInTheDocument();
  expect(shownIn(screen, "From")).toBe("01/11/2099");
  expect(shownIn(screen, "To")).toBe("dd/mm/yyyy");
  expect(onApply).not.toHaveBeenCalled();
});

test("shows the range that applies when it changes otherwise than by the fields, as with Clear filters", async () => {
  const screen = await render(
    <Period initial={{ start: "2099-11-01", end: "2099-11-08" }} />,
  );
  expect(shownIn(screen, "From")).toBe("01/11/2099");

  await screen.getByRole("button", { name: "Clear" }).click();

  await expect.poll(() => shownIn(screen, "From")).toBe("dd/mm/yyyy");
  expect(shownIn(screen, "To")).toBe("dd/mm/yyyy");

  // Also after the fields applied a range themselves.
  await typeDate(screen, "To", "08112099");
  await userEvent.keyboard("{Enter}");
  await screen.getByRole("button", { name: "Clear" }).click();

  await expect.poll(() => shownIn(screen, "To")).toBe("dd/mm/yyyy");
});

test("keeps the focus in its field once the range that it applied applies", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(<Period onApply={onApply} />);
  await typeDate(screen, "From", "01112099");

  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: "2099-11-01",
    end: undefined,
  });
  await expect
    .element(fieldOf(screen, "From").getByRole("spinbutton").last())
    .toHaveFocus();
  expect(shownIn(screen, "From")).toBe("01/11/2099");
});

test("shows the part with the focus in on-accent on accent, also while it waits for its value", async () => {
  const screen = await render(<Period initial={{}} />);

  // The day, then the month, which the field reaches once the day is typed
  // and which shows its placeholder.
  await typeDate(screen, "From", "01");

  const month = fieldOf(screen, "From").getByRole("spinbutton").nth(1);
  await expect.element(month).toHaveFocus();
  expect(month.element().textContent).toBe("mm");
  const style = getComputedStyle(month.element());
  expect([style.color, style.backgroundColor]).toEqual([
    "rgb(255, 255, 255)",
    "rgb(9, 105, 218)",
  ]);
});
