import {
  getLocalTimeZone,
  isToday,
  toCalendarDate,
  type CalendarDate,
  type CalendarDateTime,
  type DateValue,
} from "@internationalized/date";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  use,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
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
  Group,
  Heading,
  I18nProvider,
  Label,
  Popover,
  Text,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { FieldErrorMessage } from "./text-field";
import { Tooltip } from "./tooltip";

// A date field, or a date and time field, with its calendar
// (docs/design-system.md, Forms; docs/behaviors.md, Dates and Times, Input),
// which a filter of a list (src/components/date-range-filter.tsx) and a form
// share.

// What a field holds when the user presses Enter or chooses a day: nothing, a
// complete value, the date of a date field or the date and the time of a date
// and time field, or only some of its parts; and whether the user changed
// what the field showed as it started.
export type Typed = (
  | { kind: "empty" }
  | { kind: "complete"; value: DateValue }
  | { kind: "incomplete" }
) & { edited: boolean };

export const UNTYPED: Typed = { kind: "empty", edited: false };

interface TypedProbeProps {
  // Records what the field holds.
  onTyped: (typed: Typed) => void;
  // Called when the parts that the field shows change.
  onEdit: () => void;
}

// Within the parts of a field: records what the field holds, which the
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
      onTyped({ kind: "complete", value, edited });
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

// The looks of a field: that of a filter of a list, 160 px wide, its name in
// the style of the name of a group of checkboxes (docs/design-system.md,
// Lists); and that of a field of a form, its label in text-15, weight 500,
// 224 px wide for a date and time (docs/design-system.md, Forms).
const LOOKS = {
  filter: { field: "w-40 gap-1", label: "text-12 font-medium text-fg-muted" },
  form: { field: "w-56 gap-1.5", label: "text-15 font-medium" },
} as const;

export interface DateFieldProps {
  label: string;
  look: keyof typeof LOOKS;
  // A date, or a date and a time to the minute.
  granularity: "day" | "minute";
  // What the field shows as it starts.
  initial: CalendarDate | CalendarDateTime | null;
  // What follows the control, such as the time zone of a date and time.
  description?: ReactNode;
  // The error of the field, or undefined.
  error: ReactNode;
  // The first and the last day that its calendar enables.
  first: CalendarDate;
  last: CalendarDate;
  // Whether the field cannot change, as while the change that sends it is in
  // progress; it keeps its look and the focus.
  isReadOnly?: boolean;
  // The popover of the calendar, in which the focus stays with the field.
  popoverRef?: RefObject<HTMLElement | null>;
  // The parts of the date, which a form focuses when the field has an error.
  groupRef?: RefObject<HTMLDivElement | null>;
  onTyped: (typed: Typed) => void;
  onEdit: () => void;
  // Called when the user presses Enter in a part of the field.
  onEnter: () => void;
  // Called with the day that the user chooses in the calendar.
  onChoose?: (date: CalendarDate) => void;
}

// The first part of a field, which takes the focus for the field.
export function firstPart(
  group: HTMLElement | null | undefined,
): HTMLElement | null {
  return group?.querySelector<HTMLElement>('[role="spinbutton"]') ?? null;
}

// A date field, 40 px high, with its name above it, and its description and
// its error after it (docs/design-system.md, Forms): its parts in the order
// day, month, year, then, for a date and time, the hour and the minute on
// the 24-hour clock, in the time zone of the browser, followed by the button
// of its calendar. A click anywhere on the field opens the calendar, as the
// button and Alt+Down Arrow do; a click while it is open closes it, on the
// layer that the popover spreads behind it, and opens it no more. Choosing a
// day sets the date and closes the calendar; in a date and time field, it
// keeps the time of a complete date and time, and otherwise sets 00:00, as
// React Aria does. As the calendar closes, React Aria gives the focus back
// where it was in the field. Every part shows its leading zeros, such as
// 00:05, in every browser.
export function DateField({
  label,
  look,
  granularity,
  initial,
  description,
  error,
  first,
  last,
  isReadOnly = false,
  popoverRef,
  groupRef,
  onTyped,
  onEdit,
  onEnter,
  onChoose,
}: DateFieldProps) {
  const [start] = useState(initial);
  const [isOpen, setOpen] = useState(false);
  return (
    <I18nProvider locale="en-GB">
      <DatePicker
        defaultValue={start}
        granularity={granularity}
        hourCycle={24}
        shouldForceLeadingZeros
        isInvalid={error !== undefined}
        isReadOnly={isReadOnly}
        validationBehavior="aria"
        isOpen={isOpen}
        onOpenChange={setOpen}
        className={`flex flex-col ${LOOKS[look].field}`}
      >
        <Label className={LOOKS[look].label}>{label}</Label>
        <Group
          ref={groupRef}
          // In the capture phase, as a part of the date stops the click.
          onClickCapture={() => {
            if (!isReadOnly) {
              setOpen(true);
            }
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
                    {segment.type ===
                      (granularity === "day" ? "year" : "minute") && (
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
        {description !== undefined && (
          <Text slot="description" className="text-13 text-fg-muted">
            {description}
          </Text>
        )}
        <FieldErrorMessage error={error} />
        <Popover
          ref={popoverRef}
          offset={4}
          containerPadding={8}
          className="overflow-y-auto rounded-lg border border-border bg-surface p-3 shadow-lg outline-none"
        >
          <Dialog className="outline-none">
            <Calendar
              minValue={first}
              maxValue={last}
              onChange={(date: DateValue) => {
                onChoose?.(toCalendarDate(date));
              }}
            >
              <header className="flex items-center justify-between gap-2">
                <MonthButton slot="previous" />
                <Heading className="flex-1 text-center text-14 font-semibold text-fg" />
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
                        className={({
                          isSelected,
                          isDisabled,
                          isOutsideMonth,
                        }) =>
                          [
                            "flex size-8 items-center justify-center rounded-md text-14 tabular-nums",
                            FOCUS_RING,
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
    </I18nProvider>
  );
}
