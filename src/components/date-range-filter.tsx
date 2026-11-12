import {
  getLocalTimeZone,
  isToday,
  parseDate,
  toCalendarDate,
  type CalendarDate,
  type DateValue,
} from "@internationalized/date";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
} from "lucide-react";
import {
  use,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import {
  Button as AriaButton,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateFieldStateContext,
  DateInput,
  DatePicker,
  DateSegment,
  Dialog,
  FieldError,
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
} from "react-aria-components";
import { formatDate } from "./date-time";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
import { Tooltip } from "./tooltip";

// A range of dates of a filter of a list, each date field with its calendar
// (docs/design-system.md, Lists; Forms; docs/behaviors.md, Dates and Times,
// Input).

// A range of dates, each a date such as 2026-11-08, or undefined without a
// bound.
export interface DateRange {
  start?: string | undefined;
  end?: string | undefined;
}

// What a date field holds when the user presses Enter or chooses a day:
// nothing, a date, or only some of its parts; and whether the user changed
// what the field showed as it started.
type Typed = (
  | { kind: "empty" }
  | { kind: "date"; date: CalendarDate }
  | { kind: "incomplete" }
) & { edited: boolean };

const UNTYPED: Typed = { kind: "empty", edited: false };

// Runs an action once a field shows the day that the user chose, a change
// that removes the errors of the range, so that those of the action stay.
function afterShown(action: () => void) {
  requestAnimationFrame(action);
}

// What a date field holds once the user chose a day in its calendar.
function chosen(date: CalendarDate): Typed {
  return { kind: "date", date, edited: true };
}

// The date of a value of the range, or null without one.
function dateOf(value: string | undefined): CalendarDate | null {
  return value === undefined ? null : parseDate(value);
}

// Whether a date lies within the dates that the fields take.
function within(
  date: CalendarDate | null,
  first: CalendarDate,
  last: CalendarDate,
): date is CalendarDate {
  return date !== null && date.compare(first) >= 0 && date.compare(last) <= 0;
}

interface TypedProbeProps {
  // Records what the field holds.
  onTyped: (typed: Typed) => void;
  // Called when the parts that the field shows change.
  onEdit: () => void;
}

// Within the parts of a date field: records what the field holds, which the
// field's value does not tell while only some of its parts are typed, and
// reports each change of the parts that it shows.
function TypedProbe({ onTyped, onEdit }: TypedProbeProps) {
  const state = use(DateFieldStateContext);
  const editable = state?.segments.filter((segment) => segment.isEditable);
  const shown = editable?.map((segment) => segment.text).join("/") ?? "";
  const filled = editable?.filter((segment) => !segment.isPlaceholder) ?? [];
  const value = state?.value ?? null;
  const shownFirst = useRef(shown);
  const shownBefore = useRef(shown);
  useLayoutEffect(() => {
    const edited = shown !== shownFirst.current;
    if (filled.length === 0) {
      onTyped({ kind: "empty", edited });
    } else if (filled.length < (editable?.length ?? 0) || value === null) {
      onTyped({ kind: "incomplete", edited });
    } else {
      onTyped({ kind: "date", date: toCalendarDate(value), edited });
    }
    if (shown !== shownBefore.current) {
      shownBefore.current = shown;
      onEdit();
    }
  });
  return null;
}

interface MonthButtonProps {
  slot: "previous" | "next";
}

// Previous or Next of a calendar, a quiet icon button 32 px square, named by
// its tooltip.
function MonthButton({ slot }: MonthButtonProps) {
  const label = slot === "previous" ? "Previous month" : "Next month";
  const Icon = slot === "previous" ? ChevronLeft : ChevronRight;
  return (
    <Tooltip text={label} placement="top">
      <AriaButton
        slot={slot}
        aria-label={label}
        className={`inline-flex size-8 items-center justify-center rounded-md text-fg-muted data-disabled:opacity-60 data-hovered:bg-surface-hover ${FOCUS_RING}`}
      >
        <Icon aria-hidden className="size-4" />
      </AriaButton>
    </Tooltip>
  );
}

interface FieldProps {
  label: string;
  // The date that the field shows as it starts.
  value: string | undefined;
  error: string | undefined;
  // The first and the last day that its calendar enables.
  first: CalendarDate;
  last: CalendarDate;
  // The popover of the calendar, in which the focus stays in the range.
  popoverRef: RefObject<HTMLElement | null>;
  onTyped: (typed: Typed) => void;
  onEdit: () => void;
  onEnter: () => void;
  // Called with the day that the user chooses in the calendar.
  onChoose: (date: CalendarDate) => void;
}

// A date field of the range, 160 px wide and 40 px high, with its name above
// it and its error after it (docs/design-system.md, Forms), its parts in the
// order day, month, year, followed by the button of its calendar. A click
// anywhere on the field opens the calendar, as the button and Alt+Down Arrow
// do; a click while it is open closes it, on the layer that the popover
// spreads behind it, and opens it no more. As the calendar closes, React Aria
// gives the focus back where it was in the field.
function Field({
  label,
  value,
  error,
  first,
  last,
  popoverRef,
  onTyped,
  onEdit,
  onEnter,
  onChoose,
}: FieldProps) {
  const [initial] = useState(() => dateOf(value));
  const [isOpen, setOpen] = useState(false);
  return (
    <DatePicker
      defaultValue={initial}
      granularity="day"
      isInvalid={error !== undefined}
      validationBehavior="aria"
      isOpen={isOpen}
      onOpenChange={setOpen}
      className="flex w-40 flex-col gap-1"
    >
      <Label className="text-12 font-medium text-fg-muted">{label}</Label>
      <Group
        // In the capture phase, as a part of the date stops the click.
        onClickCapture={() => {
          setOpen(true);
        }}
        // In the capture phase, as a part of the date stops Enter.
        onKeyDownCapture={(event: KeyboardEvent) => {
          if (
            event.key === "Enter" &&
            event.target instanceof Element &&
            event.target.getAttribute("role") === "spinbutton"
          ) {
            event.preventDefault();
            onEnter();
          }
        }}
        className="flex h-10 cursor-default items-center rounded-md border border-border-strong bg-surface pr-1.75 pl-4 text-15 text-fg tabular-nums data-focus-within:outline-2 data-focus-within:outline-offset-2 data-focus-within:outline-focus data-invalid:border-2 data-invalid:border-danger-icon data-invalid:pr-1.5 data-invalid:pl-3.75"
      >
        <DateInput className="flex flex-1">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="rounded-sm px-px outline-none data-placeholder:text-fg-muted data-focused:bg-accent data-focused:text-on-accent data-focused:data-placeholder:text-on-accent data-[type=literal]:px-0"
            >
              {({ text }) => (
                <>
                  {text}
                  {segment.type === "year" && (
                    <TypedProbe onTyped={onTyped} onEdit={onEdit} />
                  )}
                </>
              )}
            </DateSegment>
          )}
        </DateInput>
        <Tooltip text={`Calendar ${label}`} placement="top">
          <AriaButton
            className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-fg-muted data-hovered:bg-surface-hover ${FOCUS_RING}`}
          >
            <CalendarIcon aria-hidden className="size-4" />
          </AriaButton>
        </Tooltip>
      </Group>
      <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
        <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
        <span>{error}</span>
      </FieldError>
      <Popover
        ref={popoverRef}
        offset={4}
        containerPadding={8}
        className="rounded-lg border border-border bg-surface p-3 shadow-lg outline-none"
      >
        <Dialog className="outline-none">
          <Calendar
            minValue={first}
            maxValue={last}
            onChange={(date: DateValue) => {
              onChoose(toCalendarDate(date));
            }}
          >
            <header className="flex items-center justify-between gap-2">
              <MonthButton slot="previous" />
              <Heading className="text-14 font-semibold text-fg" />
              <MonthButton slot="next" />
            </header>
            {/* Six weeks high in every month, so that the calendar keeps
                its size, and Previous and Next their place. */}
            <div className="mt-2 h-54">
              <CalendarGrid weekdayStyle="narrow" className="border-collapse">
                <CalendarGridHeader>
                  {(day) => (
                    <CalendarHeaderCell className="h-6 text-12 font-medium text-fg-muted">
                      {day}
                    </CalendarHeaderCell>
                  )}
                </CalendarGridHeader>
                <CalendarGridBody>
                  {(date) => (
                    <CalendarCell
                      date={date}
                      className={({ isSelected, isDisabled, isOutsideMonth }) =>
                        [
                          "flex size-8 items-center justify-center rounded-md text-14 tabular-nums",
                          INSIDE_FOCUS_RING,
                          isOutsideMonth
                            ? "invisible"
                            : isSelected
                              ? "bg-accent text-on-accent"
                              : isDisabled
                                ? "text-fg opacity-60"
                                : "text-fg data-hovered:bg-surface-hover",
                          isToday(date, getLocalTimeZone())
                            ? "font-semibold"
                            : "",
                        ].join(" ")
                      }
                    />
                  )}
                </CalendarGridBody>
              </CalendarGrid>
            </div>
          </Calendar>
        </Dialog>
      </Popover>
    </DatePicker>
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
      typed.kind === "date" &&
      typed.edited &&
      !within(typed.date, first, last)
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
    setErrors({});
    const startDate =
      typedStart.kind === "date" ? typedStart.date.toString() : undefined;
    const range = {
      // The default of the start is what the start shows without a bound.
      start: startDate === shown.startDefault ? undefined : startDate,
      end: typedEnd.kind === "date" ? typedEnd.date.toString() : undefined,
    };
    setOwnApply(range);
    onApply(range);
  };

  return (
    <I18nProvider locale="en-GB">
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
        <Field
          key={`start-${String(generation)}`}
          label={startLabel}
          value={startShown}
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
        <Field
          key={`end-${String(generation)}`}
          label={endLabel}
          value={applied.end}
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
    </I18nProvider>
  );
}
