import type { LucideIcon } from "lucide-react";
import { Button as AriaButton } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { Tooltip } from "./tooltip";

// The sizes of an icon button: small, an icon of 16 px in a target of 24 px,
// as Dismiss in a message; medium, an icon of 18 px in a target of 32 px, as
// the buttons of the sidebar (docs/design-system.md, Sidebar; Messages).
const SIZES = {
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
  onPress: () => void;
}

// A quiet button with an icon alone, named by its accessible name and its
// tooltip (docs/design-system.md, Buttons and Links). It takes the color of
// the text around it, and surface-hover under the pointer.
export function IconButton({
  label,
  icon: Icon,
  size,
  tooltipPlacement = "top",
  onPress,
}: IconButtonProps) {
  return (
    <Tooltip text={label} placement={tooltipPlacement}>
      <AriaButton
        aria-label={label}
        onPress={onPress}
        className={`inline-flex shrink-0 items-center justify-center rounded-md data-hovered:bg-surface-hover ${SIZES[size].target} ${FOCUS_RING}`}
      >
        <Icon aria-hidden className={SIZES[size].icon} />
      </AriaButton>
    </Tooltip>
  );
}
