import { Check, ChevronDown, ListFilter } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Button as AriaButton,
  CheckboxGroup,
  Dialog,
  DialogTrigger,
  Label,
  ListBox,
  ListBoxItem,
  ListBoxSection,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";

// The filters of a list (docs/design-system.md, Lists): Filters in the
// toolbar, which opens a popover with a group of checkboxes for each filter.

export interface FilterOption<T extends string> {
  // The value that the filter sends.
  value: T;
  // Its label, such as the name of the value, with its mark.
  label: ReactNode;
}

interface FilterGroupProps<T extends string> {
  // The name of the filter, above its checkboxes.
  label: string;
  // Its values, in their order.
  options: readonly FilterOption<T>[];
  // The values that apply.
  selected: readonly T[];
  // Applies the values that the user selects, in the order of the options.
  onChange: (values: T[]) => void;
}

// A filter as a group of checkboxes: its name in text-12, weight 500,
// fg-muted, and below it, 4 px apart, its checkboxes in a row that wraps,
// 16 px apart. A change applies at once.
export function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onChange,
}: FilterGroupProps<T>) {
  return (
    <CheckboxGroup
      value={[...selected]}
      onChange={(values) => {
        onChange(
          options
            .filter((option) => values.includes(option.value))
            .map((option) => option.value),
        );
      }}
      className="flex flex-col gap-1"
    >
      <Label className={FILTER_NAME}>{label}</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {options.map((option) => (
          <Checkbox key={option.value} value={option.value}>
            {option.label}
          </Checkbox>
        ))}
      </div>
    </CheckboxGroup>
  );
}

// The name of a filter, above its field or its checkboxes.
const FILTER_NAME = "text-12 font-medium text-fg-muted";

export interface SelectOption<T extends string> {
  // The value that the filter sends.
  value: T;
  // The text of the option, which the keyboard finds it by.
  text: string;
  // Its label, such as a user in the full form.
  label: ReactNode;
}

interface FilterSelectProps<T extends string> {
  // The name of the filter, above its field.
  label: string;
  // Its options, in groups that a line separates, in their order; an empty
  // group shows nothing.
  groups: readonly (readonly SelectOption<T>[])[];
  // In place of the options that the filter reads, while they load or when
  // their read fails: the loading indicator or the message of the failure.
  status?: ReactNode;
  // The value that applies.
  selected: T;
  // What the field shows when the value that applies is not among the
  // options, such as a user whom the read of the options does not return.
  unlisted: ReactNode;
  // Applies the value that the user chooses.
  onChange: (value: T) => void;
}

// A filter of one value among a short list that the screen reads, as a
// select (docs/design-system.md, Lists; Forms): its name above it, then a
// field-like button 40 px high that shows the option that applies and ends
// with chevron-down, which opens the options below it as a menu, at least as
// wide as the button, each 36 px high with check at its end when it applies,
// and the groups separated by border lines. A choice applies at once.
export function FilterSelect<T extends string>({
  label,
  groups,
  status,
  selected,
  unlisted,
  onChange,
}: FilterSelectProps<T>) {
  const shown = groups.filter((group) => group.length > 0);
  return (
    <Select
      value={selected}
      onChange={(key) => {
        const option = shown.flat().find((item) => item.value === key);
        if (option !== undefined) {
          onChange(option.value);
        }
      }}
      className="flex flex-col gap-1"
    >
      <Label className={FILTER_NAME}>{label}</Label>
      <AriaButton
        className={`flex h-10 items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-4 text-start text-15 text-fg ${FOCUS_RING}`}
      >
        <SelectValue className="flex min-w-0 items-center">
          {({ isPlaceholder }) =>
            isPlaceholder
              ? unlisted
              : shown.flat().find((option) => option.value === selected)?.label
          }
        </SelectValue>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-muted" />
      </AriaButton>
      <Popover
        offset={4}
        className="max-h-80 max-w-[calc(100vw-1rem)] min-w-(--trigger-width) overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg outline-none"
      >
        <ListBox className="outline-none">
          {shown.map((group, index) => (
            <ListBoxSection
              // oxlint-disable-next-line react/no-array-index-key -- the groups have no other key, and their order is fixed
              key={index}
              className={index === 0 ? "" : "mt-1 border-t border-border pt-1"}
            >
              {group.map((option) => (
                <ListBoxItem
                  key={option.value}
                  id={option.value}
                  textValue={option.text}
                  className={`group flex min-h-9 cursor-default items-center justify-between gap-2 rounded-md px-2.5 text-15 text-fg data-focused:bg-surface-hover ${INSIDE_FOCUS_RING}`}
                >
                  <span className="flex min-w-0 items-center">
                    {option.label}
                  </span>
                  <Check
                    aria-hidden
                    className="invisible size-4 shrink-0 group-data-selected:visible"
                  />
                </ListBoxItem>
              ))}
            </ListBoxSection>
          ))}
        </ListBox>
        {/* A status region that is there before what it holds, so that
            assistive technologies announce the loading or the failure of the
            options while the menu holds the focus. */}
        <output className="block">{status}</output>
      </Popover>
    </Select>
  );
}

interface FirstFieldFocusProps {
  children: ReactNode;
}

// The content of a dialog, whose first field takes the focus as the dialog
// opens (docs/behaviors.md, Accessibility, Dialogs): a checkbox, or the
// button of a select.
function FirstFieldFocus({ children }: FirstFieldFocusProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, []);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

interface FiltersProps {
  // The number of the filters that apply, which follows the label.
  applied: number;
  // What the list shows after a change, in words, which a status region of
  // the popover holds: while the popover is open, the rest of the page is out
  // of reach of assistive technologies, the status regions of the screen
  // included, so the popover announces it itself, which every list that
  // offers filters gives (docs/design-system.md, Lists).
  status: ReactNode;
  // The filters, each a FilterGroup, in their order.
  children: ReactNode;
}

// Filters, a secondary button 32 px high with list-filter, followed by the
// number of the filters that apply, which assistive technologies read as
// "2 applied". It opens below it, aligned to its end, a popover named
// "Filters" with the filters 16 px apart, at most 448 px wide, on surface
// with a border line, an 8 px radius, a shadow, and 16 px of padding, whose
// first checkbox takes the focus. Its content scrolls within it when the
// window is shorter, such as at a high zoom. Escape or a click outside closes
// it, and the focus returns to Filters.
export function Filters({ applied, status, children }: FiltersProps) {
  return (
    <DialogTrigger>
      <Button size="small">
        <ListFilter aria-hidden className="size-4" />
        <span>
          Filters
          {applied > 0 && (
            <>
              {" "}
              <span className="text-fg-muted tabular-nums">{applied}</span>
              <span className="sr-only"> applied</span>
            </>
          )}
        </span>
      </Button>
      <Popover
        placement="bottom end"
        offset={4}
        className="w-112 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4 shadow-lg outline-none"
      >
        <Dialog
          aria-label="Filters"
          className="flex flex-col gap-4 outline-none"
        >
          <FirstFieldFocus>{children}</FirstFieldFocus>
          <output className="sr-only">{status}</output>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
