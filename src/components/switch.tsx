import type { ReactNode } from "react";
import { Switch as AriaSwitch } from "react-aria-components";

interface SwitchProps {
  // Whether the choice is on.
  isSelected: boolean;
  // Turns the choice on or off.
  onChange: (isSelected: boolean) => void;
  isDisabled?: boolean;
  // Its label, which follows the rail.
  children: ReactNode;
}

// A switch, which turns a choice of a screen on or off at once, outside a
// form, such as showing the hidden records of a part (docs/design-system.md,
// Forms): a rail 28 by 16 px, round, with a 1 px border-strong boundary on
// neutral-soft and a knob of 12 px in fg-muted at its start; on, the rail and
// its boundary are accent, and the knob is in on-accent at its end. Its label
// follows 6 px later, in text-13, fg-muted. The rail and the label are one
// target, at least 24 px high, and the focus ring goes around the rail on
// keyboard focus. Disabled, it shows at 60 % opacity. Assistive technologies
// read it as a switch, on or off. It changes at once, without motion
// (docs/design-system.md, Focus and Motion).
export function Switch({
  isSelected,
  onChange,
  isDisabled = false,
  children,
}: SwitchProps) {
  return (
    <AriaSwitch
      isSelected={isSelected}
      onChange={onChange}
      isDisabled={isDisabled}
      className="group inline-flex min-h-6 cursor-default items-center gap-1.5 text-13 text-fg-muted data-disabled:opacity-60"
    >
      <span
        aria-hidden
        className="flex h-4 w-7 shrink-0 items-center rounded-full border border-border-strong bg-neutral-soft p-px group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus group-data-selected:border-accent group-data-selected:bg-accent"
      >
        <span className="size-3 rounded-full bg-fg-muted group-data-selected:translate-x-3 group-data-selected:bg-on-accent" />
      </span>
      {children}
    </AriaSwitch>
  );
}
