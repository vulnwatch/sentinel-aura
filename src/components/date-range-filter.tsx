import {
  parseDate,
  toCalendarDate,
  type CalendarDate,
} from "@internationalized/date";
import { CircleAlert } from "lucide-react";
import {
  use,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  DateField,
  DateFieldStateContext,
  DateInput,
  DateSegment,
  FieldError,
  I18nProvider,
  Label,
} from "react-aria-components";
import { formatDate } from "./date-time";

// A range of dates of a filter of a list (docs/design-system.md, Lists;
// docs/behaviors.md, Dates and Times, Input).

// A range of dates, each a date such as 2026-11-08, or undefined without a
// bound.
export interface DateRange {
  start?: string | undefined;
  end?: string | undefined;
}

// What a date field holds when the user presses Enter: nothing, a date, or
// only some of its parts.
type Typed =
  | { kind: "empty" }
  | { kind: "date"; date: CalendarDate }
  | { kind: "incomplete" };

// The date of a value of the range, or null without one.
function dateOf(value: string | undefined): CalendarDate | null {
  return value === undefined ? null : parseDate(value);
}

interface TypedProbeProps {
  // Records what the field holds.
  onTyped: (typed: Typed) => void;
  // Called when the parts that the field shows change.
  onEdit: () => void;
}

// Within a date field: records what the field holds, which the field's value
// does not tell while only some of its parts are typed, and reports each
// change of the parts that it shows.
function TypedProbe({ onTyped, onEdit }: TypedProbeProps) {
  const state = use(DateFieldStateContext);
  const editable = state?.segments.filter((segment) => segment.isEditable);
  const shown = editable?.map((segment) => segment.text).join("/") ?? "";
  const filled = editable?.filter((segment) => !segment.isPlaceholder) ?? [];
  const value = state?.value ?? null;
  const shownBefore = useRef(shown);
  useLayoutEffect(() => {
    if (filled.length === 0) {
      onTyped({ kind: "empty" });
    } else if (filled.length < (editable?.length ?? 0) || value === null) {
      onTyped({ kind: "incomplete" });
    } else {
      onTyped({ kind: "date", date: toCalendarDate(value) });
    }
    if (shown !== shownBefore.current) {
      shownBefore.current = shown;
      onEdit();
    }
  });
  return null;
}

interface FieldProps {
  label: string;
  value: string | undefined;
  error: string | undefined;
  onTyped: (typed: Typed) => void;
  onEdit: () => void;
  onEnter: () => void;
}

// A date field of the range, 160 px wide and 40 px high, with its name above
// it and its error after it (docs/design-system.md, Forms), its parts in the
// order day, month, year.
function Field({ label, value, error, onTyped, onEdit, onEnter }: FieldProps) {
  const [initial] = useState(() => dateOf(value));
  return (
    <DateField
      defaultValue={initial}
      isInvalid={error !== undefined}
      validationBehavior="aria"
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnter();
        }
      }}
      className="flex w-40 flex-col gap-1"
    >
      <Label className="text-12 font-medium text-fg-muted">{label}</Label>
      <DateInput className="flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-15 text-fg tabular-nums data-focus-within:outline-2 data-focus-within:outline-offset-2 data-focus-within:outline-focus data-invalid:border-2 data-invalid:border-danger-icon data-invalid:px-3.75">
        {(segment) => (
          <DateSegment
            segment={segment}
            className="rounded-sm px-px outline-none data-placeholder:text-fg-muted data-focused:bg-accent data-focused:text-on-accent data-focused:data-placeholder:text-on-accent data-[type=literal]:px-0"
          />
        )}
      </DateInput>
      <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
        <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
        <span>{error}</span>
      </FieldError>
      <TypedProbe onTyped={onTyped} onEdit={onEdit} />
    </DateField>
  );
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
  // The first and the last date that the fields take, such as 1970-01-01.
  min: string;
  max: string;
  // Applies the range that the user typed.
  onApply: (range: DateRange) => void;
}

// A range of dates as a filter: two date fields 12 px apart, each with its
// name above it in the style of the name of a group of checkboxes. Enter in
// either field applies both: a field that the user emptied removes its
// bound. A field with only some of its parts, a date outside the dates that
// the fields take, and a start after the end are not applied, and their
// field says so until the user changes either date, or until the focus
// leaves both fields, which return to the range that applies.
export function DateRangeFilter({
  startLabel,
  endLabel,
  applied,
  min,
  max,
  onApply,
}: DateRangeFilterProps) {
  const start = useRef<Typed>({ kind: "empty" });
  const end = useRef<Typed>({ kind: "empty" });
  const [errors, setErrors] = useState<Errors>({});
  // Starts the fields again with the range that applies: when the focus
  // leaves both fields, and when the range that applies changes otherwise
  // than by the fields, such as with Clear filters or back.
  const [generation, setGeneration] = useState(0);
  const [shownApplied, setShownApplied] = useState(applied);
  // The range that the fields applied last, which they already show, until
  // the range that applies changes.
  const [ownApply, setOwnApply] = useState<DateRange>();
  if (
    applied.start !== shownApplied.start ||
    applied.end !== shownApplied.end
  ) {
    setShownApplied(applied);
    setOwnApply(undefined);
    if (
      ownApply === undefined ||
      ownApply.start !== applied.start ||
      ownApply.end !== applied.end
    ) {
      setGeneration(generation + 1);
    }
  }
  const first = parseDate(min);
  const last = parseDate(max);
  const outside = `Enter a date from ${formatDate(min)} to ${formatDate(max)}.`;

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
      typed.kind === "date" &&
      (typed.date.compare(first) < 0 || typed.date.compare(last) > 0)
    ) {
      return outside;
    }
    return undefined;
  };

  const apply = () => {
    const typedStart = start.current;
    const typedEnd = end.current;
    const found: Errors = {
      start: errorOf(typedStart),
      end: errorOf(typedEnd),
    };
    if (
      found.start === undefined &&
      found.end === undefined &&
      typedStart.kind === "date" &&
      typedEnd.kind === "date" &&
      typedStart.date.compare(typedEnd.date) > 0
    ) {
      found.end = "This date is before the start.";
    }
    if (found.start !== undefined || found.end !== undefined) {
      setErrors(found);
      return;
    }
    const range = {
      start:
        typedStart.kind === "date" ? typedStart.date.toString() : undefined,
      end: typedEnd.kind === "date" ? typedEnd.date.toString() : undefined,
    };
    setOwnApply(range);
    onApply(range);
  };

  return (
    <I18nProvider locale="en-GB">
      <div
        className="flex flex-wrap items-start gap-3"
        onBlur={(event) => {
          if (
            !(event.relatedTarget instanceof Node) ||
            !event.currentTarget.contains(event.relatedTarget)
          ) {
            setErrors({});
            setGeneration((current) => current + 1);
          }
        }}
      >
        <Field
          key={`start-${String(generation)}`}
          label={startLabel}
          value={applied.start}
          error={errors.start}
          onTyped={(typed) => {
            start.current = typed;
          }}
          onEdit={clearErrors}
          onEnter={apply}
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
        <Field
          key={`end-${String(generation)}`}
          label={endLabel}
          value={applied.end}
          error={errors.end}
          onTyped={(typed) => {
            end.current = typed;
          }}
          onEdit={clearErrors}
          onEnter={apply}
        />
      </div>
    </I18nProvider>
  );
}
