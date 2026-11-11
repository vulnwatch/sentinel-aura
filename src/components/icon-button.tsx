import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { Ref } from "react";
import { Button as AriaButton } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { Tooltip } from "./tooltip";

// The sizes of an icon button: inline, an icon of 14 px in a target of 24 px,
// beside a value in text of 13 or 14 px, as the pencil of a field of a
// description list; small, an icon of 16 px in a target of 24 px, as Dismiss
// in a message; medium, an icon of 18 px in a target of 32 px, as the buttons
// of the sidebar (docs/design-system.md, Icon Set; Detail Screens; Sidebar;
// Messages).
const SIZES = {
  inline: { target: "size-6", icon: "size-3.5" },
  small: { target: "size-6", icon: "size-4" },
  medium: { target: "size-8", icon: "size-4.5" },
} as const;

interface IconButtonProps {
  // The accessible name of the button, which its tooltip shows.
  label: string;
  icon: LucideIcon;
  size: keyof typeof SIZES;
  // Where the tooltip shows (Tooltip).
  tooltipPlacement?: "top" | "end";
  // Whether the change that the button started is in progress.
  isBusy?: boolean;
  onPress: () => void;
  ref?: Ref<HTMLButtonElement> | undefined;
}

// A quiet button with an icon alone, named by its accessible name and its
// tooltip (docs/design-system.md, Buttons and Links). It takes the color of
// the text around it, and surface-hover under the pointer. While the change
// that it started is in progress, it is busy: loader-circle, turning, takes
// the place of its icon, and it cannot be pressed, but it keeps its name and
// the focus (docs/behaviors.md, Loading); the spinner stands still under
// reduced motion (docs/design-system.md, Focus and Motion).
export function IconButton({
  label,
  icon: Icon,
  size,
  tooltipPlacement = "top",
  isBusy = false,
  onPress,
  ref,
}: IconButtonProps) {
  const icon = SIZES[size].icon;
  return (
    <Tooltip text={label} placement={tooltipPlacement}>
      <AriaButton
        ref={ref}
        aria-label={label}
        onPress={isBusy ? undefined : onPress}
        aria-disabled={isBusy || undefined}
        className={`inline-flex shrink-0 items-center justify-center rounded-md data-hovered:bg-surface-hover ${SIZES[size].target} ${FOCUS_RING}`}
      >
        {isBusy ? (
          <LoaderCircle
            aria-hidden
            className={`${icon} animate-spin motion-reduce:animate-none`}
          />
        ) : (
          <Icon aria-hidden className={icon} />
        )}
      </AriaButton>
    </Tooltip>
  );
}
