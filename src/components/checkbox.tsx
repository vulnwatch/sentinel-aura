import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Checkbox as AriaCheckbox } from "react-aria-components";

interface CheckboxProps {
  // The value that the checkbox adds to the values of its group.
  value: string;
  // Its label, which follows the box.
  children: ReactNode;
}

// A checkbox of a group of checkboxes (docs/design-system.md, Forms): a box
// of 16 px with a border-strong boundary and a 4 px radius, and when it is
// selected an accent fill with check in on-accent, then its label in text-14,
// 6 px later. The box and the label are one target, at least 24 px high, and
// the focus ring goes around the box on keyboard focus.
export function Checkbox({ value, children }: CheckboxProps) {
  return (
    <AriaCheckbox
      value={value}
      className="group inline-flex min-h-6 cursor-default items-center gap-1.5 text-14 text-fg"
    >
      <span
        aria-hidden
        className="flex size-4 shrink-0 items-center justify-center rounded border border-border-strong bg-surface group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus group-data-selected:border-accent group-data-selected:bg-accent"
      >
        <Check className="hidden size-3 text-on-accent group-data-selected:block" />
      </span>
      {children}
    </AriaCheckbox>
  );
}
