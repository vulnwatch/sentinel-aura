import type { ReactNode } from "react";
import { Tooltip as AriaTooltip, TooltipTrigger } from "react-aria-components";

// How long the pointer rests on a control before its tooltip shows; keyboard
// focus shows it at once (docs/design-system.md, Menus, Popovers, and
// Tooltips).
export const TOOLTIP_DELAY_MS = 300;

interface TooltipProps {
  // The text of the tooltip, such as the name of an icon alone in a control,
  // or its lines, such as the values of a "+N".
  text: ReactNode;
  // Where the tooltip shows: above the control, or after it, as to the right
  // of the controls of the sidebar.
  placement: "top" | "end";
  // Whether the tooltip never shows, as where the control shows its name
  // itself.
  isDisabled?: boolean;
  // The control: one focusable element of React Aria, such as a button or a
  // link.
  children: ReactNode;
}

// A tooltip of a control (docs/design-system.md, Menus, Popovers, and
// Tooltips): the colors of text inverted, after 300 ms of hover and at once
// on keyboard focus. It stays while the pointer is over it, and Escape hides
// it (WCAG 2.2, 1.4.13 Content on Hover or Focus). It never holds the only
// means to act: the control has its own accessible name.
export function Tooltip({
  text,
  placement,
  isDisabled = false,
  children,
}: TooltipProps) {
  return (
    <TooltipTrigger delay={TOOLTIP_DELAY_MS} isDisabled={isDisabled}>
      {children}
      <AriaTooltip
        placement={placement}
        offset={6}
        className="rounded-md bg-fg px-2.5 py-1.5 text-13 font-medium text-surface shadow-lg"
      >
        {text}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
