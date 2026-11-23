import {
  parseDate,
  toCalendarDate,
  type CalendarDate,
} from "@internationalized/date";
import { useRef, useState } from "react";
import { DateField, UNTYPED, type Typed } from "./date-field";
import { formatDate } from "./date-time";

// A range of dates of a filter of a list, each date field with its calendar
// (docs/design-system.md, Lists; Forms; docs/behaviors.md, Dates and Times,
// Input).

// A range of dates, each a date such as 2026-11-08, or undefined without a
// bound.
export interface DateRange {
  start?: string | undefined;
  end?: string | undefined;
}

// Runs an action once a field shows the day that the user chose, a change
// that removes the errors of the range, so that those of the action stay.
function afterShown(action: () => void) {
  requestAnimationFrame(action);
}

// What a date field holds once the user chose a day in its calendar.
function chosen(date: CalendarDate): Typed {
  return { kind: "complete", value: date, edited: true };
}

// The date of a value of the range, or null without one.
function dateOf(value: string | undefined): CalendarDate | null {
  return value === undefined ? null : parseDate(value);
}

// The date of what a field holds, when it holds a complete date.
function dayOf(typed: Typed): CalendarDate | undefined {
  return typed.kind === "complete" ? toCalendarDate(typed.value) : undefined;
}

// Whether a date lies within the dates that the fields take.
function within(
  date: CalendarDate | null,
  first: CalendarDate,
  last: CalendarDate,
): date is CalendarDate {
  return date !== null && date.compare(first) >= 0 && date.compare(last) <= 0;
}

interface Errors {
  start?: string | undefined;
  end?: string | undefined;
}

interface DateRangeFilterProps {
  // The names of the fields of the start and the end, such as From and To.
  startLabel: string;
  endLabel: string;
  // The range that applies.
  applied: DateRange;
  // The date that the start shows without a bound, unless the applied end
  // is before it, such as the day of the first event of a timeline; a start
  // on that date applies as no bound.
  startDefault?: string | undefined;
  // The first and the last date that the fields take, such as 1970-01-01.
  min: string;
  max: string;
  // Applies the range that the user typed or chose.
  onApply: (range: DateRange) => void;
}

// A range of dates as a filter: two date fields 12 px apart, each with its
// name above it in the style of the name of a group of checkboxes. Enter in
// either field, or a day chosen in a calendar, applies both: a field that
// the user emptied removes its bound. A field with only some of its parts, a
// date that the user typed outside the dates that the fields take, and a
// start after the end are not applied, and their field says so until the
// user changes either date, or until the focus leaves both fields, which
// return to the range that applies. A calendar disables the days that its
// field does not take, and those beyond the other applied end while that
// end lies within them.
export function DateRangeFilter({
  startLabel,
  endLabel,
  applied,
  startDefault,
  min,
  max,
  onApply,
}: DateRangeFilterProps) {
  const start = useRef<Typed>(UNTYPED);
  const end = useRef<Typed>(UNTYPED);
  const startPopover = useRef<HTMLElement>(null);
  const endPopover = useRef<HTMLElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  // Starts the fields again with the range that applies: when the focus
  // leaves both fields, and when the range that applies changes otherwise
  // than by the fields, such as with Clear filters or back, or the default
  // of the start while the focus is elsewhere.
  const [generation, setGeneration] = useState(0);
  const [shown, setShown] = useState({ applied, startDefault });
  // The range that the fields applied last, which they already show, until
  // the range that applies changes.
  const [ownApply, setOwnApply] = useState<DateRange>();
  // Whether the focus is in the range, its calendars included.
  const [focusIn, setFocusIn] = useState(false);
  if (
    applied.start !== shown.applied.start ||
    applied.end !== shown.applied.end
  ) {
    setShown({ applied, startDefault });
    setOwnApply(undefined);
    if (
      ownApply === undefined ||
      ownApply.start !== applied.start ||
      ownApply.end !== applied.end
    ) {
      setGeneration(generation + 1);
    }
  } else if (startDefault !== shown.startDefault && !focusIn) {
    setShown({ applied, startDefault });
    setGeneration(generation + 1);
  }
  const first = parseDate(min);
  const last = parseDate(max);
  const outside = `Enter a date from ${formatDate(min)} to ${formatDate(max)}.`;
  const appliedStart = dateOf(applied.start);
  const appliedEnd = dateOf(applied.end);
  const shownDefault = dateOf(shown.startDefault);
  const startShown =
    applied.start ??
    (shownDefault !== null &&
    (appliedEnd === null || shownDefault.compare(appliedEnd) <= 0)
      ? shown.startDefault
      : undefined);

  const clearErrors = () => {
    setErrors((current) =>
      current.start === undefined && current.end === undefined ? current : {},
    );
  };

  const errorOf = (typed: Typed): string | undefined => {
    if (typed.kind === "incomplete") {
      return "Enter the day, the month, and the year.";
    }
    if (
      typed.kind === "complete" &&
      typed.edited &&
      !within(toCalendarDate(typed.value), first, last)
    ) {
      return outside;
    }
    return undefined;
  };

  const apply = (typedStart: Typed, typedEnd: Typed) => {
    const found: Errors = {
      start: errorOf(typedStart),
      end: errorOf(typedEnd),
    };
    const startDate = dayOf(typedStart);
    const endDate = dayOf(typedEnd);
    if (
      found.start === undefined &&
      found.end === undefined &&
      startDate !== undefined &&
      endDate !== undefined &&
      startDate.compare(endDate) > 0
    ) {
      found.end = "This date is before the start.";
    }
    if (found.start !== undefined || found.end !== undefined) {
      setErrors(found);
      return;
    }
    setErrors({});
    const startText = startDate?.toString();
    const range = {
      // The default of the start is what the start shows without a bound.
      start: startText === startDefault ? undefined : startText,
      end: endDate?.toString(),
    };
    setOwnApply(range);
    onApply(range);
  };

  return (
    <div
      className="flex flex-wrap items-start gap-3"
      onFocus={() => {
        setFocusIn(true);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        // The focus leaves a calendar only as it closes, for its field.
        if (
          startPopover.current?.contains(event.target) === true ||
          endPopover.current?.contains(event.target) === true
        ) {
          return;
        }
        if (
          !(next instanceof Node) ||
          !(
            event.currentTarget.contains(next) ||
            startPopover.current?.contains(next) === true ||
            endPopover.current?.contains(next) === true
          )
        ) {
          setFocusIn(false);
          setErrors({});
          setGeneration((current) => current + 1);
        }
      }}
    >
      <DateField
        key={`start-${String(generation)}`}
        label={startLabel}
        look="filter"
        granularity="day"
        initial={dateOf(startShown)}
        error={errors.start}
        first={first}
        last={within(appliedEnd, first, last) ? appliedEnd : last}
        popoverRef={startPopover}
        onTyped={(typed) => {
          start.current = typed;
        }}
        onEdit={clearErrors}
        onEnter={() => {
          apply(start.current, end.current);
        }}
        onChoose={(date) => {
          afterShown(() => {
            apply(chosen(date), end.current);
          });
        }}
      />
      {/* The errors in a status region that is there before them, so that
            assistive technologies announce them without moving the focus
            (docs/behaviors.md, Accessibility, Announcements). */}
      <output className="sr-only">
        {[
          errors.start === undefined ? "" : `${startLabel}: ${errors.start}`,
          errors.end === undefined ? "" : `${endLabel}: ${errors.end}`,
        ]
          .filter((text) => text !== "")
          .join(" ")}
      </output>
      <DateField
        key={`end-${String(generation)}`}
        label={endLabel}
        look="filter"
        granularity="day"
        initial={appliedEnd}
        error={errors.end}
        first={within(appliedStart, first, last) ? appliedStart : first}
        last={last}
        popoverRef={endPopover}
        onTyped={(typed) => {
          end.current = typed;
        }}
        onEdit={clearErrors}
        onEnter={() => {
          apply(start.current, end.current);
        }}
        onChoose={(date) => {
          afterShown(() => {
            apply(start.current, chosen(date));
          });
        }}
      />
    </div>
  );
}
