import { useId, useLayoutEffect, type ReactNode, type RefObject } from "react";
import { Dialog, Heading, Popover } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { focusScreenHeading } from "./screen-heading";

// A popover that shows what a control opens, such as the phases of a track
// or the details of a record (docs/design-system.md, Menus, Popovers, and
// Tooltips), as the content of a dialog of React Aria inside a
// DialogTrigger, after its trigger.

// Its widths: 288 px, as the explanation of a priority, or 320 px, as Phases
// and the popover of a name (docs/design-system.md, Track Milestones; Menus,
// Popovers, and Tooltips). A window narrower than the popover with its
// margin keeps it inside.
const WIDTHS = {
  narrow: "w-72",
  wide: "w-80",
} as const;

interface InfoPopoverProps {
  width: keyof typeof WIDTHS;
  // The accessible name of the popover, when its title does not name it.
  label?: string;
  // The element below which it opens, when it is not the trigger itself.
  triggerRef?: RefObject<Element | null>;
  // Its content, which starts with its title (PopoverTitle).
  children: ReactNode;
}

// A popover on surface, with a border line, an 8 px radius, a shadow, and
// 16 px of padding, in text-14. It opens below its trigger and aligned to its
// start, or above it where the window has no room below, moves toward the
// start where it would pass the end of the window, and its content scrolls
// within it in a window shorter than it is. It takes the focus itself as it
// opens, with the focus ring around its content on keyboard focus, so that
// assistive technologies read it first (docs/behaviors.md, Accessibility,
// Dialogs); while it is open, the rest of the page is out of reach of the
// keyboard and of assistive technologies. Escape or a click outside closes
// it, a click without acting on what it hits, and the focus returns to the
// trigger. When its trigger leaves the page while the popover holds the
// focus, such as a record that a read removes, the focus moves to the
// screen's heading (docs/behaviors.md, Accessibility, Focus after an action).
export function InfoPopover({
  width,
  label,
  triggerRef,
  children,
}: InfoPopoverProps) {
  const dialogId = useId();
  // The popover shows outside the content around its trigger, which hands
  // off only the focus that it holds itself (FocusHandOff). Closing the
  // popover leaves the trigger, to which the focus returns.
  useLayoutEffect(
    () => () => {
      if (document.getElementById(dialogId)?.contains(document.activeElement)) {
        queueMicrotask(focusScreenHeading);
      }
    },
    [dialogId],
  );
  return (
    <Popover
      triggerRef={triggerRef}
      placement="bottom start"
      offset={4}
      className={`${WIDTHS[width]} max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-surface p-4 text-14 text-fg shadow-lg outline-none`}
    >
      <Dialog id={dialogId} aria-label={label} className={FOCUS_RING}>
        {children}
      </Dialog>
    </Popover>
  );
}

interface PopoverTitleProps {
  children: ReactNode;
}

// The title of a popover, which names it unless the popover has a label of
// its own: in text-16, weight 600, wrapping.
export function PopoverTitle({ children }: PopoverTitleProps) {
  return (
    <Heading
      slot="title"
      level={2}
      className="text-16 font-semibold wrap-break-word"
    >
      {children}
    </Heading>
  );
}

// The border line of a popover between its title and its content, with
// 12 px of space above and below it.
export function PopoverLine() {
  return <hr className="my-3 border-border" />;
}
