import { ListFilter } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import {
  CheckboxGroup,
  Dialog,
  DialogTrigger,
  Label,
  Popover,
} from "react-aria-components";
import { Button } from "./button";
import { Checkbox } from "./checkbox";

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
      <Label className="text-12 font-medium text-fg-muted">{label}</Label>
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

interface FirstFieldFocusProps {
  children: ReactNode;
}

// The content of a dialog, whose first field takes the focus as the dialog
// opens (docs/behaviors.md, Accessibility, Dialogs).
function FirstFieldFocus({ children }: FirstFieldFocusProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input")?.focus();
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
  // included, so the popover announces it itself.
  status?: ReactNode;
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
