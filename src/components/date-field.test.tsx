import { CalendarDate, CalendarDateTime } from "@internationalized/date";
import { useRef, type RefObject } from "react";
import { afterEach, beforeEach, expect, test, vi, type Mock } from "vitest";
import { page, userEvent, type Locator } from "vitest/browser";
import { render } from "vitest-browser-react";
import "../styles.css";
import { DateField, firstPart, type Typed } from "./date-field";

// A date and time field of a form, with its calendar (docs/design-system.md,
// Forms; docs/behaviors.md, Dates and Times, Input), at a wide window, in the
// light theme. The date field of a filter of a list has the tests of the
// range of dates (src/components/date-range-filter.test.tsx).

beforeEach(async () => {
  await page.viewport(1280, 800);
});

afterEach(async () => {
  await page.viewport(414, 896);
});

// The colors of docs/design-system.md (Color Tokens) in the light theme.
const FG_MUTED = "rgb(89, 99, 110)";
const DANGER_ICON = "rgb(207, 34, 46)";

const DESCRIPTION = "In your time zone, Fictional Standard Time.";
const ERROR = "Enter the day, the month, the year, and the time.";

interface FormFieldProps {
  initial?: CalendarDateTime | null;
  description?: string;
  error?: string;
  isReadOnly?: boolean;
  groupRef?: RefObject<HTMLDivElement | null>;
  onTyped?: (typed: Typed) => void;
  onEdit?: () => void;
  onEnter?: () => void;
  onChoose?: (date: CalendarDate) => void;
}

// A date and time field of a fictional form, Release, which takes the days
// of 2099 but its last.
function FormField({
  initial = null,
  description,
  error,
  isReadOnly,
  groupRef,
  onTyped = () => undefined,
  onEdit = () => undefined,
  onEnter = () => undefined,
  onChoose,
}: FormFieldProps) {
  return (
    <div className="p-8">
      <DateField
        label="Release"
        look="form"
        granularity="minute"
        initial={initial}
        description={description}
        error={error}
        first={new CalendarDate(2099, 1, 1)}
        last={new CalendarDate(2099, 12, 30)}
        isReadOnly={isReadOnly}
        groupRef={groupRef}
        onTyped={onTyped}
        onEdit={onEdit}
        onEnter={onEnter}
        onChoose={onChoose}
      />
    </div>
  );
}

type Screen = Awaited<ReturnType<typeof render>>;

function fieldOf(screen: Screen): Locator {
  return screen.getByRole("group", { name: "Release", exact: true });
}

// A part of the field: 0 the day, 1 the month, 2 the year, 3 the hour, 4 the
// minute.
function partOf(screen: Screen, index: number): Locator {
  return fieldOf(screen).getByRole("spinbutton").nth(index);
}

// What the field shows, such as 25/11/2099, 13:00, without the marks that
// isolate the direction of the time.
function shownIn(screen: Screen): string {
  return (fieldOf(screen).element().textContent ?? "").replace(/[⁦-⁩]/g, "");
}

// The values of the parts of the field, as numbers, or null for a part that
// shows its placeholder.
function valuesOf(screen: Screen): (string | null)[] {
  return fieldOf(screen)
    .getByRole("spinbutton")
    .elements()
    .map((part) => part.getAttribute("aria-valuenow"));
}

// Whether every part of the field is marked as invalid for assistive
// technologies.
function invalidParts(screen: Screen): boolean {
  return fieldOf(screen)
    .getByRole("spinbutton")
    .elements()
    .every((part) => part.getAttribute("aria-invalid") === "true");
}

// Types digits from the day, which takes the focus as from the keyboard,
// without opening the calendar.
async function typeInto(screen: Screen, digits: string) {
  const day = partOf(screen, 0).element();
  if (day instanceof HTMLElement) {
    day.focus();
  }
  await userEvent.keyboard(digits);
}

// Waits until the browser has rendered two more frames, after which React
// has rendered what an event set and run the effects of that render.
async function nextFrames() {
  await new Promise((done) => requestAnimationFrame(done));
  await new Promise((done) => requestAnimationFrame(done));
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

// What the field held as it last reported it.
function lastTyped(onTyped: Mock<(typed: Typed) => void>): Typed | undefined {
  return onTyped.mock.lastCall?.[0];
}

// What the field reported, each report as text, such as "complete
// 2099-11-25T13:00:00 edited", in their order.
function reportsOf(onTyped: Mock<(typed: Typed) => void>): string[] {
  return onTyped.mock.calls.map(([typed]) =>
    [
      typed.kind,
      ...(typed.kind === "complete" ? [typed.value.toString()] : []),
      ...(typed.edited ? ["edited"] : []),
    ].join(" "),
  );
}

// Whether no report repeats the one before it.
function eachChangeOnce(reports: readonly string[]): boolean {
  return reports.every((report, index) => report !== reports[index - 1]);
}

// The date and time of a complete value, as text, such as
// 2099-11-25T13:00:00.
function valueText(typed: Typed | undefined): string | undefined {
  return typed?.kind === "complete" ? typed.value.toString() : undefined;
}

test("shows its label above it in text-15, weight 500, 6 px above the field, 224 px wide and 40 px high, with the parts day, month, year, hour, and minute, then the button of its calendar, named after the label", async () => {
  const screen = await render(
    <FormField initial={new CalendarDateTime(2099, 11, 25, 13, 0)} />,
  );

  const label = screen.getByText("Release", { exact: true });
  const style = getComputedStyle(label.element());
  expect([style.fontSize, style.fontWeight]).toEqual(["15px", "500"]);
  const field = fieldOf(screen).element().getBoundingClientRect();
  expect(field.top - label.element().getBoundingClientRect().bottom).toBe(6);
  expect([field.width, field.height]).toEqual([224, 40]);
  expect(shownIn(screen)).toBe("25/11/2099, 13:00");
  const parts = fieldOf(screen).getByRole("spinbutton");
  for (const [index, name] of [
    "day",
    "month",
    "year",
    "hour",
    "minute",
  ].entries()) {
    await expect
      .element(parts.nth(index))
      .toHaveAccessibleName(new RegExp(`^${name},? Release$`));
  }
  expect(valuesOf(screen)).toEqual(["25", "11", "2099", "13", "0"]);
  await expect
    .element(fieldOf(screen).getByRole("button"))
    .toHaveAccessibleName("Calendar Release");
});

test("shows the placeholders of its parts without a value", async () => {
  const screen = await render(<FormField />);

  expect(shownIn(screen)).toBe("dd/mm/yyyy, ––:––");
  expect(valuesOf(screen)).toEqual([null, null, null, null, null]);
});

test("sets its parts 24 px apart at least, center to center, empty or with a value, and shows the space after the comma before the time", async () => {
  for (const initial of [null, new CalendarDateTime(2099, 1, 1, 11, 11)]) {
    const screen = await render(<FormField initial={initial} />);
    const centers = fieldOf(screen)
      .getByRole("spinbutton")
      .elements()
      .map((part) => {
        const box = part.getBoundingClientRect();
        return box.left + box.width / 2;
      });
    for (const [index, center] of centers.slice(1).entries()) {
      expect(center - (centers[index] ?? 0)).toBeGreaterThanOrEqual(24);
    }
    const year = partOf(screen, 2).element().getBoundingClientRect();
    const hour = partOf(screen, 3).element().getBoundingClientRect();
    // The comma and the space, at least 6 px in text-15.
    expect(hour.left - year.right).toBeGreaterThanOrEqual(6);
    await screen.unmount();
  }
});

test("reports what it holds, empty, only some of its parts, or a complete date and time, with whether the user changed what it showed as it started, and each change of the parts that it shows", async () => {
  const onTyped = vi.fn<(typed: Typed) => void>();
  const onEdit = vi.fn<() => void>();
  const screen = await render(<FormField onTyped={onTyped} onEdit={onEdit} />);
  expect(reportsOf(onTyped)).toEqual(["empty"]);
  expect(onEdit).not.toHaveBeenCalled();

  await typeInto(screen, "25");

  // Reported once, as the first digit makes it hold only some of its parts.
  expect(reportsOf(onTyped)).toEqual(["empty", "incomplete edited"]);
  expect(onEdit).toHaveBeenCalled();

  // The time alone is only some of the parts too: nothing more to report.
  await userEvent.keyboard("112099");
  expect(reportsOf(onTyped)).toEqual(["empty", "incomplete edited"]);

  await userEvent.keyboard("1305");

  expect(lastTyped(onTyped)?.kind).toBe("complete");
  expect(valueText(lastTyped(onTyped))).toBe("2099-11-25T13:05:00");
  expect(lastTyped(onTyped)?.edited).toBe(true);

  // Backspace removes a digit, and in an empty part moves to the part
  // before it. Empty again, the field shows what it showed as it started.
  await userEvent.keyboard("{Backspace}".repeat(20));

  expect(shownIn(screen)).toBe("dd/mm/yyyy, ––:––");
  expect(lastTyped(onTyped)).toEqual({ kind: "empty", edited: false });
  expect(eachChangeOnce(reportsOf(onTyped))).toBe(true);
});

test("reports nothing on a render that changes nothing of what it holds, such as a new description or error, and each change of what it holds once", async () => {
  const onTyped = vi.fn<(typed: Typed) => void>();
  const initial = new CalendarDateTime(2099, 11, 25, 13, 0);
  const screen = await render(
    <FormField initial={initial} onTyped={onTyped} />,
  );
  expect(reportsOf(onTyped)).toEqual(["complete 2099-11-25T13:00:00"]);

  await screen.rerender(
    <FormField initial={initial} description={DESCRIPTION} onTyped={onTyped} />,
  );
  await screen.rerender(
    <FormField
      initial={initial}
      description={DESCRIPTION}
      error={ERROR}
      onTyped={onTyped}
    />,
  );

  await expect.element(screen.getByText(ERROR, { exact: true })).toBeVisible();
  expect(invalidParts(screen)).toBe(true);
  // The frames in which React runs the effects of those renders.
  await nextFrames();
  expect(reportsOf(onTyped)).toEqual(["complete 2099-11-25T13:00:00"]);

  // Each digit changes the day: 02, then 26.
  await typeInto(screen, "26");

  expect(reportsOf(onTyped)).toEqual([
    "complete 2099-11-25T13:00:00",
    "complete 2099-11-02T13:00:00 edited",
    "complete 2099-11-26T13:00:00 edited",
  ]);
});

test("reports the date and time with which it starts as complete and not changed, and changed once the user changes it and not once they type it again", async () => {
  const onTyped = vi.fn<(typed: Typed) => void>();
  const onEdit = vi.fn<() => void>();
  const screen = await render(
    <FormField
      initial={new CalendarDateTime(2099, 11, 25, 13, 0)}
      onTyped={onTyped}
      onEdit={onEdit}
    />,
  );
  expect(lastTyped(onTyped)?.kind).toBe("complete");
  expect(valueText(lastTyped(onTyped))).toBe("2099-11-25T13:00:00");
  expect(lastTyped(onTyped)?.edited).toBe(false);

  await typeInto(screen, "26");

  expect(valueText(lastTyped(onTyped))).toBe("2099-11-26T13:00:00");
  expect(lastTyped(onTyped)?.edited).toBe(true);
  // Each digit changed the day that the field shows: 02, then 26.
  expect(onEdit).toHaveBeenCalledTimes(2);

  await typeInto(screen, "25");

  expect(valueText(lastTyped(onTyped))).toBe("2099-11-25T13:00:00");
  expect(lastTyped(onTyped)?.edited).toBe(false);
});

test("calls onEnter with Enter in each part, and not with Enter on the button of its calendar", async () => {
  const onEnter = vi.fn<() => void>();
  const screen = await render(<FormField onEnter={onEnter} />);

  for (const index of [0, 4]) {
    const part = partOf(screen, index).element();
    if (part instanceof HTMLElement) {
      part.focus();
    }
    await userEvent.keyboard("{Enter}");
  }

  expect(onEnter).toHaveBeenCalledTimes(2);
  await userEvent.keyboard("{Tab}");
  await expect.element(fieldOf(screen).getByRole("button")).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(calendar()).toBeVisible();
  expect(onEnter).toHaveBeenCalledTimes(2);
});

test("keeps the time when the user chooses a day in the calendar of a field with a date and time, which closes, and reports the day chosen", async () => {
  const onTyped = vi.fn<(typed: Typed) => void>();
  const onChoose = vi.fn<(date: CalendarDate) => void>();
  const screen = await render(
    <FormField
      initial={new CalendarDateTime(2099, 11, 25, 13, 30)}
      onTyped={onTyped}
      onChoose={onChoose}
    />,
  );
  await fieldOf(screen).getByRole("button").click();
  await expect.element(dayCell(25)).toHaveFocus();

  await dayCell(8).click();

  await expect.element(calendar()).not.toBeInTheDocument();
  expect(shownIn(screen)).toBe("08/11/2099, 13:30");
  expect(valueText(lastTyped(onTyped))).toBe("2099-11-08T13:30:00");
  expect(onChoose).toHaveBeenCalledExactlyOnceWith(
    new CalendarDate(2099, 11, 8),
  );
});

test("sets 00:00 when the user chooses a day in the calendar of an empty field", async () => {
  const onTyped = vi.fn<(typed: Typed) => void>();
  const screen = await render(<FormField onTyped={onTyped} />);
  await fieldOf(screen).getByRole("button").click();
  // The nearest month in which the calendar enables a day.
  await expect.element(dayCell(1)).toHaveFocus();

  await dayCell(8).click();

  await expect.element(calendar()).not.toBeInTheDocument();
  expect(valuesOf(screen)).toEqual(["8", "1", "2099", "0", "0"]);
  expect(valueText(lastTyped(onTyped))).toBe("2099-01-08T00:00:00");
  // Every part with its leading zeros, in every browser.
  expect(shownIn(screen)).toBe("08/01/2099, 00:00");
});

test("keeps its value while read-only, takes no typing, and opens no calendar", async () => {
  const onTyped = vi.fn<(typed: Typed) => void>();
  const screen = await render(
    <FormField
      initial={new CalendarDateTime(2099, 11, 25, 13, 0)}
      isReadOnly
      onTyped={onTyped}
    />,
  );
  for (const part of fieldOf(screen).getByRole("spinbutton").elements()) {
    expect(part.getAttribute("aria-readonly")).toBe("true");
  }

  // A click on a part, then on the button of the calendar, each followed by
  // the frames in which React renders a calendar that it opened.
  await partOf(screen, 1).click();
  await nextFrames();
  expect(calendar().query()).toBeNull();
  await fieldOf(screen).getByRole("button").click({ force: true });
  await nextFrames();
  expect(calendar().query()).toBeNull();

  await typeInto(screen, "2612");

  await expect.element(partOf(screen, 0)).toHaveFocus();
  expect(shownIn(screen)).toBe("25/11/2099, 13:00");
  expect(valueText(lastTyped(onTyped))).toBe("2099-11-25T13:00:00");
});

test("shows its description below it in text-13, fg-muted, which describes it to assistive technologies", async () => {
  const screen = await render(<FormField description={DESCRIPTION} />);

  const description = screen.getByText(DESCRIPTION, { exact: true });
  await expect.element(description).toBeVisible();
  const style = getComputedStyle(description.element());
  expect([style.fontSize, style.color]).toEqual(["13px", FG_MUTED]);
  expect(description.element().getBoundingClientRect().top).toBeGreaterThan(
    fieldOf(screen).element().getBoundingClientRect().bottom,
  );
  await expect
    .element(partOf(screen, 0))
    .toHaveAccessibleDescription(new RegExp(DESCRIPTION.replace(".", "\\.")));
});

test("shows a description longer than the control on lines as wide as the form, not the control", async () => {
  const long = `${DESCRIPTION} ${DESCRIPTION}`;
  const screen = await render(<FormField description={long} />);

  const description = screen.getByText(long, { exact: true }).element();
  expect(description.getBoundingClientRect().width).toBeGreaterThan(
    fieldOf(screen).element().getBoundingClientRect().width,
  );
});

test("shows its error below its description, marks its parts invalid, and draws its boundary in danger-icon, 2 px wide", async () => {
  const screen = await render(
    <FormField description={DESCRIPTION} error={ERROR} />,
  );

  const error = screen.getByText(ERROR, { exact: true });
  await expect.element(error).toBeVisible();
  expect(error.element().getBoundingClientRect().top).toBeGreaterThan(
    screen
      .getByText(DESCRIPTION, { exact: true })
      .element()
      .getBoundingClientRect().bottom,
  );
  for (const part of fieldOf(screen).getByRole("spinbutton").elements()) {
    expect(part.getAttribute("aria-invalid")).toBe("true");
  }
  await expect
    .element(partOf(screen, 0))
    .toHaveAccessibleDescription(new RegExp(ERROR.replace(".", "\\.")));
  const boundary = getComputedStyle(fieldOf(screen).element());
  expect([boundary.borderTopWidth, boundary.borderTopColor]).toEqual([
    "2px",
    DANGER_ICON,
  ]);
});

// A field whose first part a button of its form gives the focus, as a form
// does for a field with an error.
function FocusedByForm() {
  const group = useRef<HTMLDivElement>(null);
  return (
    <>
      <FormField groupRef={group} />
      <button
        type="button"
        onClick={() => {
          firstPart(group.current)?.focus();
        }}
      >
        Focus the field
      </button>
    </>
  );
}

test("gives its first part, the day, to a form that focuses the field", async () => {
  const screen = await render(<FocusedByForm />);

  await screen.getByRole("button", { name: "Focus the field" }).click();

  await expect.element(partOf(screen, 0)).toHaveFocus();
  await expect
    .element(partOf(screen, 0))
    .toHaveAccessibleName(/^day,? Release$/);
});

test("gives no first part without a field", () => {
  expect(firstPart(null)).toBeNull();
  expect(firstPart(undefined)).toBeNull();
  expect(firstPart(document.createElement("div"))).toBeNull();
});
