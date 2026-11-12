import { getLocalTimeZone, today } from "@internationalized/date";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { Button } from "./button";
import { DateRangeFilter, type DateRange } from "./date-range-filter";

// A range of dates as a filter of a list, each date field with its calendar
// (docs/design-system.md, Lists; Forms; Menus, Popovers, and Tooltips;
// docs/behaviors.md, Dates and Times, Input), at a wide window, in the light
// theme.

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG = "rgb(31, 35, 40)";
const FG_MUTED = "rgb(89, 99, 110)";
const SURFACE = "rgb(255, 255, 255)";
const BORDER = "rgb(216, 222, 228)";
const BORDER_STRONG = "rgb(129, 139, 152)";
const ACCENT = "rgb(9, 105, 218)";
const FOCUS = "rgb(9, 105, 218)";
const ON_ACCENT = "rgb(255, 255, 255)";
const DANGER_ON_SOFT = "rgb(164, 14, 38)";
const DANGER_ICON = "rgb(207, 34, 46)";

// The dates that the fields of most tests take.
const MIN = "2099-01-15";
const MAX = "2099-12-20";

const INCOMPLETE = "Enter the day, the month, and the year.";
const OUTSIDE = "Enter a date from 15 Jan 2099 to 20 Dec 2099.";
const INVERTED = "This date is before the start.";

interface PeriodProps {
  // The range that applies as the list starts.
  initial?: DateRange;
  // The date that the start shows without a bound.
  startDefault?: string;
  min?: string;
  max?: string;
  // Called with the range that the user applies.
  onApply?: (range: DateRange) => void;
}

// The period of a fictional list, which applies the range that the user
// applies, as the URL of a list keeps it, and Clear, which removes it, as
// Clear filters does.
function Period({
  initial = {},
  startDefault,
  min = MIN,
  max = MAX,
  onApply,
}: PeriodProps) {
  const [applied, setApplied] = useState<DateRange>(initial);
  return (
    <div className="flex flex-col items-start gap-4 p-8">
      <DateRangeFilter
        startLabel="From"
        endLabel="To"
        applied={applied}
        startDefault={startDefault}
        min={min}
        max={max}
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

// A part of a date field: 0 the day, 1 the month, 2 the year.
function partOf(screen: Screen, name: string, index: number): Locator {
  return fieldOf(screen, name).getByRole("spinbutton").nth(index);
}

// What a date field shows, such as 01/11/2099 or dd/mm/yyyy without a date.
function shownIn(screen: Screen, name: string): string | null {
  return fieldOf(screen, name).element().textContent;
}

// Types a date, such as 01112099, into a date field, from its day, which
// takes the focus as from the keyboard, without opening the calendar.
async function typeDate(screen: Screen, name: string, digits: string) {
  const day = partOf(screen, name, 0).element();
  if (day instanceof HTMLElement) {
    day.focus();
  }
  await userEvent.keyboard(digits);
}

// Empties a date field from its year, which takes the focus as from the
// keyboard.
async function emptyField(screen: Screen, name: string) {
  const year = partOf(screen, name, 2).element();
  if (year instanceof HTMLElement) {
    year.focus();
  }
  // Backspace removes a digit, and in an empty part moves to the part before
  // it.
  await userEvent.keyboard("{Backspace}".repeat(10));
}

// Whether a date field is marked as invalid for assistive technologies.
function invalid(screen: Screen, name: string): boolean {
  return fieldOf(screen, name)
    .getByRole("spinbutton")
    .elements()
    .every((part) => part.getAttribute("aria-invalid") === "true");
}

// The calendar that is open.
function calendar(): Locator {
  return page.getByRole("dialog");
}

// A day of the calendar that is open, by its number in the month.
function dayCell(day: number): Locator {
  return calendar()
    .getByRole("grid")
    .getByRole("button", { name: new RegExp(`\\b${String(day)} `) })
    .filter({ hasText: new RegExp(`^${String(day)}$`) });
}

// The numbers of the days of the month that the calendar enables.
function enabledDays(): number[] {
  return calendar()
    .getByRole("grid")
    .getByRole("button")
    .elements()
    .filter(
      (cell) =>
        cell.getAttribute("aria-disabled") !== "true" &&
        getComputedStyle(cell).visibility !== "hidden",
    )
    .map((cell) => Number(cell.textContent));
}

// The heading of the calendar that is open, the month and the year that it
// shows, which assistive technologies read in the name of the calendar.
function headingOf(): Element {
  const heading = calendar().element().querySelector("header h2");
  if (heading === null) {
    throw new Error("No heading of the calendar");
  }
  return heading;
}

// The month and the year that the calendar shows, such as November 2099.
function monthShown(): string | null {
  return headingOf().textContent;
}

// The month of a date as the calendar names it, such as November 2099.
function monthOf(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

test("shows two date fields named by their ends, each with the parts day, month, and year of the range that applies and the button of its calendar, 160 px wide, 40 px high, and 12 px apart, with its name above it in text-12, weight 500, fg-muted", async () => {
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

  // The button of the calendar ends the field: a quiet icon button 24 px
  // square, calendar at 16 px in fg-muted, named after its field.
  const button = from.getByRole("button", { name: "Calendar From" });
  await expect.element(button).toBeVisible();
  await expect
    .element(to.getByRole("button"))
    .toHaveAccessibleName("Calendar To");
  const buttonBox = button.element().getBoundingClientRect();
  expect([buttonBox.width, buttonBox.height]).toEqual([24, 24]);
  expect(fromBox.right - buttonBox.right).toBe(8);
  expect(buttonBox.left).toBeGreaterThan(
    parts.nth(2).element().getBoundingClientRect().right,
  );
  const icon = button.element().querySelector("svg");
  expect(icon?.getAttribute("aria-hidden")).toBe("true");
  expect(icon?.classList.contains("lucide-calendar")).toBe(true);
  expect(icon?.getBoundingClientRect().width).toBe(16);
  expect(getComputedStyle(button.element()).color).toBe(FG_MUTED);
});

test("shows the name of the button of a calendar in its tooltip", async () => {
  const screen = await render(<Period />);
  const year = partOf(screen, "To", 2).element();
  if (year instanceof HTMLElement) {
    year.focus();
  }

  await userEvent.keyboard("{Tab}");

  await expect
    .element(page.getByRole("tooltip", { name: "Calendar To" }))
    .toBeVisible();
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
  await expect.element(calendar()).not.toBeInTheDocument();
});

test("applies a range with only one bound, and the first and the last date that the fields take", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(<Period onApply={onApply} />);

  await typeDate(screen, "From", "15012099");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: "2099-01-15",
    end: undefined,
  });

  await typeDate(screen, "To", "20122099");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: "2099-01-15",
    end: "2099-12-20",
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
  await emptyField(screen, "From");

  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: undefined,
    end: "2099-11-08",
  });
  expect(shownIn(screen, "From")).toBe("dd/mm/yyyy");
});

test.each([
  ["a field with only some of its parts", "From", "0111", "", INCOMPLETE],
  ["a date before the first", "From", "14012099", "", OUTSIDE],
  ["a date after the last", "To", "", "21122099", OUTSIDE],
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
      .element(partOf(screen, field, 0))
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
    // The field keeps its size, and its button its place, with its wider
    // boundary.
    expect([box.width, box.height]).toEqual([160, 40]);
    expect(
      box.right -
        fieldOf(screen, field)
          .getByRole("button")
          .element()
          .getBoundingClientRect().right,
    ).toBe(8);
    // Announced in the status region of the range, after the name of its
    // field.
    expect(screen.getByRole("status").element().textContent).toBe(
      `${field}: ${message}`,
    );
  },
);

test("takes a typed end before the applied start, which the calendar of the end disables, and says that it is before the start", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period initial={{ start: "2099-11-08" }} onApply={onApply} />,
  );

  await typeDate(screen, "To", "01112099");
  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByText(INVERTED, { exact: true }))
    .toBeVisible();
  expect(onApply).not.toHaveBeenCalled();
});

test("applies again as it is a date of the range that applies which its field does not take, while the user does not change it", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period initial={{ end: "2100-01-10" }} onApply={onApply} />,
  );
  expect(shownIn(screen, "To")).toBe("10/01/2100");
  expect(invalid(screen, "To")).toBe(false);

  await typeDate(screen, "From", "01112099");
  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: "2099-11-01",
    end: "2100-01-10",
  });

  // Changed, the date is the user's, which the field does not take.
  await typeDate(screen, "To", "11012100");
  await userEvent.keyboard("{Enter}");

  await expect
    .element(screen.getByText(OUTSIDE, { exact: true }))
    .toBeVisible();
  expect(onApply).toHaveBeenCalledOnce();
});

test("announces the errors of both fields in one status region, each after the name of its field, which is there before them and says nothing once they go", async () => {
  const screen = await render(<Period />);
  const status = screen.getByRole("status");
  await expect.element(status).toBeInTheDocument();
  expect(status.element().textContent).toBe("");
  const region = status.element();
  await typeDate(screen, "From", "01");
  await typeDate(screen, "To", "21122099");

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

  await userEvent.keyboard("{Shift>}{Tab}{/Shift}");

  await expect.element(error).toBeVisible();
  expect(shownIn(screen, "From")).toBe("08/11/2099");
  expect(shownIn(screen, "To")).toBe("01/11/2099");

  await typeDate(screen, "From", "0");

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
  await expect.element(partOf(screen, "From", 2)).toHaveFocus();
  expect(shownIn(screen, "From")).toBe("01/11/2099");
});

test("shows the part with the focus in on-accent on accent, also while it waits for its value", async () => {
  const screen = await render(<Period initial={{}} />);

  // The day, then the month, which the field reaches once the day is typed
  // and which shows its placeholder.
  await typeDate(screen, "From", "01");

  const month = partOf(screen, "From", 1);
  await expect.element(month).toHaveFocus();
  expect(month.element().textContent).toBe("mm");
  const style = getComputedStyle(month.element());
  expect([style.color, style.backgroundColor]).toEqual([ON_ACCENT, ACCENT]);
});

test("shows the default of the start without a bound, unless the applied end is before it, and applies a start on it as no bound", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period startDefault="2099-01-15" onApply={onApply} />,
  );
  expect(shownIn(screen, "From")).toBe("15/01/2099");

  // Applied as no bound, typed or not.
  await typeDate(screen, "To", "08112099");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: undefined,
    end: "2099-11-08",
  });
  await expect.element(partOf(screen, "To", 2)).toHaveFocus();
  await typeDate(screen, "From", "15012099");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: undefined,
    end: "2099-11-08",
  });
  await typeDate(screen, "From", "16012099");
  await userEvent.keyboard("{Enter}");
  expect(onApply).toHaveBeenLastCalledWith({
    start: "2099-01-16",
    end: "2099-11-08",
  });

  await screen.unmount();
  const before = await render(
    <Period
      startDefault="2099-01-15"
      initial={{ end: "2099-01-10" }}
      onApply={onApply}
    />,
  );
  expect(shownIn(before, "From")).toBe("dd/mm/yyyy");
  expect(shownIn(before, "To")).toBe("10/01/2099");
});

test("shows the default of the start again once the focus leaves both fields after Enter emptied it", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period startDefault="2099-01-15" onApply={onApply} />,
  );
  await emptyField(screen, "From");

  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: undefined,
    end: undefined,
  });
  expect(shownIn(screen, "From")).toBe("dd/mm/yyyy");

  screen.getByRole("button", { name: "Clear" }).element().focus();

  await expect.poll(() => shownIn(screen, "From")).toBe("15/01/2099");
});

interface LateDefaultProps {
  arrived: boolean;
  onApply?: (range: DateRange) => void;
}

// The period with a default of the start that arrives later, as the read of
// the first event of a timeline.
function LateDefault({ arrived, onApply }: LateDefaultProps) {
  return (
    <Period
      startDefault={arrived ? "2099-01-15" : undefined}
      min={arrived ? MIN : "1970-01-01"}
      onApply={onApply}
    />
  );
}

test("shows a default of the start that arrives while the focus is elsewhere at once, and one that arrives while the focus is in the range once the focus leaves both fields", async () => {
  const screen = await render(<LateDefault arrived={false} />);
  expect(shownIn(screen, "From")).toBe("dd/mm/yyyy");

  await screen.rerender(<LateDefault arrived />);

  await expect.poll(() => shownIn(screen, "From")).toBe("15/01/2099");

  await screen.unmount();
  const typing = await render(<LateDefault arrived={false} />);
  await typeDate(typing, "To", "0811");

  await typing.rerender(<LateDefault arrived />);

  // The typed parts stay.
  expect(shownIn(typing, "To")).toBe("08/11/yyyy");
  expect(shownIn(typing, "From")).toBe("dd/mm/yyyy");

  typing.getByRole("button", { name: "Clear" }).element().focus();

  await expect.poll(() => shownIn(typing, "From")).toBe("15/01/2099");
  expect(shownIn(typing, "To")).toBe("dd/mm/yyyy");
});

test("applies as no bound a start typed on a default that arrived while the focus was in the range, which the start does not show yet", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <LateDefault arrived={false} onApply={onApply} />,
  );
  await typeDate(screen, "To", "08");

  await screen.rerender(<LateDefault arrived onApply={onApply} />);
  expect(shownIn(screen, "From")).toBe("dd/mm/yyyy");
  await typeDate(screen, "To", "08112099");
  await typeDate(screen, "From", "15012099");
  await userEvent.keyboard("{Enter}");

  expect(onApply).toHaveBeenCalledExactlyOnceWith({
    start: undefined,
    end: "2099-11-08",
  });
});

test.each([
  ["a part of the date", "part"],
  ["the space between its parts and its button", "space"],
  ["its button", "button"],
])(
  "opens the calendar of a field on a click on %s, on the month of its date, with the focus on its day",
  async (_, where) => {
    const screen = await render(<Period initial={{ end: "2099-11-08" }} />);
    const field = fieldOf(screen, "To");

    if (where === "part") {
      await partOf(screen, "To", 1).click();
    } else if (where === "space") {
      await field.click({ position: { x: 110, y: 20 } });
    } else {
      await field.getByRole("button").click();
    }

    await expect.element(calendar()).toBeVisible();
    expect(monthShown()).toBe("November 2099");
    await expect.element(dayCell(8)).toHaveFocus();
    await expect
      .element(dayCell(8))
      .toHaveAccessibleName(/8 November 2099 selected/);
  },
);

test("opens the calendar with Alt+Down Arrow, and not when the keyboard moves the focus to the field", async () => {
  const screen = await render(<Period />);
  screen.getByRole("button", { name: "Clear" }).element().focus();

  // From the button before the range: Clear follows it, so the test starts
  // from the field's day.
  const day = partOf(screen, "From", 0).element();
  if (day instanceof HTMLElement) {
    day.focus();
  }
  await userEvent.keyboard("{Tab}{Tab}");

  await expect.element(partOf(screen, "From", 2)).toHaveFocus();
  await expect.element(calendar()).not.toBeInTheDocument();
  await userEvent.keyboard("{Tab}");
  await expect
    .element(fieldOf(screen, "From").getByRole("button"))
    .toHaveFocus();
  await expect.element(calendar()).not.toBeInTheDocument();

  await userEvent.keyboard("{Alt>}{ArrowDown}{/Alt}");

  await expect.element(calendar()).toBeVisible();
});

test("opens the calendar of a field without a date on the current month, with the focus on today", async () => {
  const screen = await render(<Period min="1970-01-01" max="9999-12-30" />);

  await partOf(screen, "From", 0).click();

  await expect.element(calendar()).toBeVisible();
  const now = new Date();
  expect(monthShown()).toBe(monthOf(now));
  await expect.element(dayCell(now.getDate())).toHaveAccessibleName(/^Today, /);
  await expect.element(dayCell(now.getDate())).toHaveFocus();
});

test("opens the calendar on the nearest month in which it enables a day, with the focus on the nearest day that it enables", async () => {
  const screen = await render(<Period initial={{ end: "2100-02-03" }} />);

  await fieldOf(screen, "To").getByRole("button").click();

  expect(monthShown()).toBe("December 2099");
  await expect.element(dayCell(20)).toHaveFocus();
});

test("disables the days that the field does not take, and the days beyond the other applied end while that end lies within them", async () => {
  const screen = await render(
    <Period initial={{ start: "2099-01-20", end: "2099-12-10" }} />,
  );

  // From takes the days from 15 Jan 2099 to the applied end.
  await fieldOf(screen, "From").getByRole("button").click();
  expect(monthShown()).toBe("January 2099");
  expect(enabledDays()).toEqual(
    Array.from({ length: 17 }, (_, index) => index + 15),
  );
  const previous = calendar().getByRole("button", { name: "Previous month" });
  await expect.element(previous).toBeDisabled();
  await userEvent.keyboard("{Escape}");

  // To takes the days from the applied start to 20 Dec 2099.
  await fieldOf(screen, "To").getByRole("button").click();
  expect(monthShown()).toBe("December 2099");
  expect(enabledDays()).toEqual(
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  await expect
    .element(calendar().getByRole("button", { name: "Next month" }))
    .toBeDisabled();
  await userEvent.keyboard("{Escape}");

  // Within the same month, each end limits the calendar of the other.
  await screen.unmount();
  const month = await render(
    <Period initial={{ start: "2099-11-05", end: "2099-11-20" }} />,
  );
  await fieldOf(month, "From").getByRole("button").click();
  expect(enabledDays()).toEqual(
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  await userEvent.keyboard("{Escape}");
  await fieldOf(month, "To").getByRole("button").click();
  expect(enabledDays()).toEqual(
    Array.from({ length: 26 }, (_, index) => index + 5),
  );
  await userEvent.keyboard("{Escape}");

  // An end that the fields do not take limits no calendar of the start.
  await month.unmount();
  const outside = await render(<Period initial={{ end: "2099-01-10" }} />);
  await fieldOf(outside, "From").getByRole("button").click();
  expect(monthShown()).toBe("January 2099");
  expect(enabledDays()).toEqual(
    Array.from({ length: 17 }, (_, index) => index + 15),
  );
  await calendar().getByRole("button", { name: "Next month" }).click();
  expect(monthShown()).toBe("February 2099");
  expect(enabledDays()).toHaveLength(28);
});

test("applies both dates when the user chooses a day of a calendar, which closes, and gives the focus back to the part that opened it", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(<Period onApply={onApply} />);
  await typeDate(screen, "From", "20012099");
  await partOf(screen, "To", 1).click();
  await expect.element(calendar()).toBeVisible();
  expect(monthShown()).toBe("January 2099");

  await calendar().getByRole("button", { name: "Next month" }).click();
  await dayCell(8).click();

  await vi.waitFor(() => {
    expect(onApply).toHaveBeenCalledExactlyOnceWith({
      start: "2099-01-20",
      end: "2099-02-08",
    });
  });
  await expect.element(calendar()).not.toBeInTheDocument();
  expect(shownIn(screen, "To")).toBe("08/02/2099");
  await expect.element(partOf(screen, "To", 1)).toHaveFocus();
});

test("chooses a day with the keyboard", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(
    <Period initial={{ start: "2099-11-01" }} onApply={onApply} />,
  );
  await fieldOf(screen, "From").getByRole("button").click();
  await expect.element(dayCell(1)).toHaveFocus();

  await userEvent.keyboard("{ArrowRight}{ArrowDown}{Enter}");

  await vi.waitFor(() => {
    expect(onApply).toHaveBeenCalledExactlyOnceWith({
      start: "2099-11-09",
      end: undefined,
    });
  });
});

test("shows the errors of the range when a chosen day does not apply", async () => {
  const onApply = vi.fn<(range: DateRange) => void>();
  const screen = await render(<Period onApply={onApply} />);
  await typeDate(screen, "From", "0111");
  await fieldOf(screen, "To").getByRole("button").click();

  await dayCell(20).click();

  await expect
    .element(screen.getByText(INCOMPLETE, { exact: true }))
    .toBeVisible();
  expect(onApply).not.toHaveBeenCalled();
});

test.each([
  ["Escape", "escape"],
  ["a click on the field", "field"],
  ["a click outside the field", "outside"],
])(
  "closes the calendar without a change with %s, without opening it again, and gives the focus back where it was in the field, the typed dates kept",
  async (_, how) => {
    const onApply = vi.fn<(range: DateRange) => void>();
    const screen = await render(<Period onApply={onApply} />);
    await typeDate(screen, "From", "0111");
    await partOf(screen, "To", 2).click();
    await expect.element(calendar()).toBeVisible();

    if (how === "escape") {
      await userEvent.keyboard("{Escape}");
    } else if (how === "field") {
      // Through the layer that the popover spreads behind it.
      await partOf(screen, "To", 0).click({ force: true });
    } else {
      await screen.getByRole("button", { name: "Clear" }).click({
        force: true,
      });
    }

    await expect.element(calendar()).not.toBeInTheDocument();
    await expect.element(partOf(screen, "To", 2)).toHaveFocus();
    expect(onApply).not.toHaveBeenCalled();
    expect(shownIn(screen, "From")).toBe("01/11/yyyy");
    expect(shownIn(screen, "To")).toBe("dd/mm/yyyy");

    // The typed parts of the field take what the user types.
    await userEvent.keyboard("2099");
    expect(shownIn(screen, "To")).toBe("dd/mm/2099");
  },
);

test("keeps the errors and the typed dates while the focus is in a calendar", async () => {
  const screen = await render(<Period />);
  await typeDate(screen, "From", "0111");
  await userEvent.keyboard("{Enter}");
  const error = screen.getByText(INCOMPLETE, { exact: true });
  await expect.element(error).toBeVisible();

  await fieldOf(screen, "To").getByRole("button").click();

  await expect.element(calendar()).toBeVisible();
  await expect.element(error).toBeVisible();
  expect(shownIn(screen, "From")).toBe("01/11/yyyy");
});

test("shows the calendar in a popover with 12 px of padding below the field and aligned to its start, the month and the year between Previous and Next, and the days of the month from Monday, six weeks high", async () => {
  const screen = await render(
    <Period initial={{ start: "2099-11-08" }} max="2099-11-20" />,
  );

  await fieldOf(screen, "From").getByRole("button").click();

  const popover = calendar().element().parentElement;
  if (popover === null) {
    throw new Error("No popover");
  }
  const style = getComputedStyle(popover);
  expect([
    style.paddingTop,
    style.paddingLeft,
    style.backgroundColor,
    style.borderTopColor,
    style.borderTopLeftRadius,
  ]).toEqual(["12px", "12px", SURFACE, BORDER, "8px"]);
  expect(style.boxShadow).not.toBe("none");
  const field = fieldOf(screen, "From").element().getBoundingClientRect();
  const box = popover.getBoundingClientRect();
  expect(box.left).toBe(field.left);
  expect(box.top).toBeGreaterThan(field.bottom);

  const heading = headingOf();
  const headingStyle = getComputedStyle(heading);
  expect([
    headingStyle.fontSize,
    headingStyle.fontWeight,
    headingStyle.color,
  ]).toEqual(["14px", "600", FG]);
  const previous = calendar()
    .getByRole("button", { name: "Previous month" })
    .element();
  const next = calendar().getByRole("button", { name: "Next month" }).element();
  for (const button of [previous, next]) {
    const buttonBox = button.getBoundingClientRect();
    expect([buttonBox.width, buttonBox.height]).toEqual([32, 32]);
    expect(getComputedStyle(button).color).toBe(FG_MUTED);
    expect(button.querySelector("svg")?.getBoundingClientRect().width).toBe(16);
  }
  const headingBox = heading.getBoundingClientRect();
  expect(previous.getBoundingClientRect().right).toBeLessThan(headingBox.left);
  expect(next.getBoundingClientRect().left).toBeGreaterThan(headingBox.right);
  // The month beyond the last day holds no day that the calendar enables.
  expect(next.hasAttribute("disabled")).toBe(true);
  expect(getComputedStyle(next).opacity).toBe("0.6");

  const headers = [...calendar().element().querySelectorAll("thead th")];
  const weekdays = headers.map((cell) => cell.textContent);
  expect(weekdays).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
  const weekday = getComputedStyle(headers[0] ?? document.body);
  expect([weekday.fontSize, weekday.fontWeight, weekday.color]).toEqual([
    "12px",
    "500",
    FG_MUTED,
  ]);

  // The chosen day: accent, its number in on-accent, in text-14.
  const chosen = dayCell(8).element();
  const chosenBox = chosen.getBoundingClientRect();
  expect([chosenBox.width, chosenBox.height]).toEqual([32, 32]);
  const chosenStyle = getComputedStyle(chosen);
  expect([
    chosenStyle.backgroundColor,
    chosenStyle.color,
    chosenStyle.fontSize,
    chosenStyle.borderTopLeftRadius,
  ]).toEqual([ACCENT, ON_ACCENT, "14px", "6px"]);
  // Another day, and a day that the calendar disables, at 60 % opacity.
  const other = getComputedStyle(dayCell(9).element());
  expect([other.color, other.opacity, other.fontWeight]).toEqual([
    FG,
    "1",
    "400",
  ]);
  expect(getComputedStyle(dayCell(21).element()).opacity).toBe("0.6");
  expect(dayCell(21).element().getAttribute("aria-disabled")).toBe("true");
  // The days of the months around it are left out.
  const days = calendar().getByRole("grid").getByRole("button").elements();
  const shown = days.filter(
    (cell) => getComputedStyle(cell).visibility !== "hidden",
  );
  expect(shown.map((cell) => Number(cell.textContent))).toEqual(
    Array.from({ length: 30 }, (_, index) => index + 1),
  );
  // November 2099 starts on a Sunday, the last day of its first week, as
  // 8 November is of the second.
  const firstBox = shown[0]?.getBoundingClientRect();
  expect(firstBox?.left).toBe(chosenBox.left);
  expect(firstBox?.bottom).toBeLessThanOrEqual(chosenBox.top);

  // Six weeks high in a month of five weeks, so that the popover keeps its
  // size: November 2099 takes six weeks, April 2099 five.
  const height = box.height;
  await userEvent.keyboard("{Escape}");
  await screen.unmount();
  const april = await render(
    <Period initial={{ start: "2099-04-02" }} max="2099-11-20" />,
  );
  await fieldOf(april, "From").getByRole("button").click();
  expect(monthShown()).toBe("April 2099");
  const aprilPopover = calendar().element().parentElement;
  expect(aprilPopover?.getBoundingClientRect().height).toBe(height);
});

test("shows today at weight 600, and a day under the pointer on surface-hover", async () => {
  const now = today(getLocalTimeZone());
  const screen = await render(
    <Period
      min={now.subtract({ months: 1 }).toString()}
      max={now.add({ months: 1 }).toString()}
    />,
  );
  await fieldOf(screen, "From").getByRole("button").click();

  const cell = dayCell(now.day);
  expect(getComputedStyle(cell.element()).fontWeight).toBe("600");
  const other = dayCell(now.day === 1 ? 2 : 1);
  await other.hover();
  await expect
    .poll(() => getComputedStyle(other.element()).backgroundColor)
    .toBe("rgb(243, 245, 248)");
});

test("hands the focus to the days when the button to the next month becomes disabled while it holds it", async () => {
  const screen = await render(
    <Period initial={{ start: "2099-11-08" }} max="2099-12-20" />,
  );
  await fieldOf(screen, "From").getByRole("button").click();
  const next = calendar().getByRole("button", { name: "Next month" });
  next.element().focus();
  await expect.element(next).toHaveFocus();

  await userEvent.keyboard("{Enter}");

  expect(monthShown()).toBe("December 2099");
  await expect.element(next).toBeDisabled();
  await expect
    .poll(() => document.activeElement?.getAttribute("role"))
    .toBe("button");
  expect(
    calendar().getByRole("grid").element().contains(document.activeElement),
  ).toBe(true);
});

test("names the buttons to the previous and the next month in their tooltips", async () => {
  const screen = await render(<Period initial={{ start: "2099-11-08" }} />);
  await fieldOf(screen, "From").getByRole("button").click();

  await calendar().getByRole("button", { name: "Previous month" }).hover();

  await expect
    .element(page.getByRole("tooltip", { name: "Previous month" }))
    .toBeVisible();
});

test("shows the focus ring 2 px outside the day with the focus, the chosen day included", async () => {
  const screen = await render(<Period initial={{ start: "2099-11-08" }} />);
  const day = partOf(screen, "From", 0).element();
  if (day instanceof HTMLElement) {
    day.focus();
  }

  // From the keyboard alone.
  await userEvent.keyboard("{Tab}{Tab}{Alt>}{ArrowDown}{/Alt}");

  await expect.element(dayCell(8)).toHaveFocus();
  const chosen = getComputedStyle(dayCell(8).element());
  expect([
    chosen.outlineStyle,
    chosen.outlineWidth,
    chosen.outlineOffset,
    chosen.outlineColor,
  ]).toEqual(["solid", "2px", "2px", FOCUS]);
  await userEvent.keyboard("{ArrowRight}");
  await expect.element(dayCell(9)).toHaveFocus();
  expect(getComputedStyle(dayCell(9).element()).outlineOffset).toBe("2px");
  expect(getComputedStyle(dayCell(8).element()).outlineStyle).toBe("none");
});

test("scrolls the calendar within its popover in a window shorter than it", async () => {
  await page.viewport(320, 240);
  const screen = await render(<Period initial={{ start: "2099-11-08" }} />);

  await fieldOf(screen, "From").getByRole("button").click();

  const popover = calendar().element().parentElement;
  if (popover === null) {
    throw new Error("No popover");
  }
  expect(getComputedStyle(popover).overflowY).toBe("auto");
  expect(popover.scrollHeight).toBeGreaterThan(popover.clientHeight);
  expect(popover.getBoundingClientRect().bottom).toBeLessThanOrEqual(240);
});
