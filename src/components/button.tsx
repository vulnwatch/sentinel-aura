import { LoaderCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type ButtonProps = Omit<
  AriaButtonProps,
  "className" | "style" | "children" | "isPending"
> & {
  // The label of the button.
  children: ReactNode;
  // The icon before the label, at 16 px, hidden from assistive technologies,
  // since the label names the action.
  icon?: LucideIcon | undefined;
  // Primary for the main action of a screen, a form, or a dialog, one per
  // screen part; secondary for every other action, such as Try again; quiet,
  // without a fill or a boundary, for Cancel in a form, Clear filters, and
  // Refetch all of the sources of a CVE; danger for the button that confirms
  // an action that cannot be undone or that ends another person's access
  // (docs/design-system.md, Buttons and Links).
  variant?: "primary" | "secondary" | "quiet" | "danger";
  // Large in forms and dialogs, 40 px high; small in the toolbar of a list,
  // 32 px high, in text-14; medium elsewhere, 36 px high.
  size?: "small" | "medium" | "large";
  // Whether the change that the button started is in progress.
  isBusy?: boolean;
};

const VARIANTS = {
  primary: "bg-accent text-on-accent data-hovered:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-fg data-hovered:bg-surface-hover",
  quiet: "text-fg data-hovered:bg-surface-hover",
  danger:
    "bg-danger-solid text-on-danger-solid data-hovered:bg-danger-solid-hover",
} as const;

const SIZES = {
  small: "h-8 px-3 text-14",
  medium: "h-9 px-3 text-15",
  large: "h-10 px-4 text-15",
} as const;

// A button (docs/design-system.md, Buttons and Links). While the change that
// it started is in progress, it is busy: it shows loader-circle in place of
// its icon, or before its label without one, keeps its label, and cannot be
// pressed, but it keeps the focus (docs/behaviors.md, Loading). A busy submit
// button does not submit its form; Enter in a field of a form with a single
// field still does, so such a form guards its submission itself. The spinner
// stands still under reduced motion (docs/design-system.md, Focus and
// Motion). React Aria's own pending state is not used: it announces the
// button through a reference to it, which stays behind in the page when the
// button leaves it, as Sign in does once it succeeds.
export function Button({
  children,
  icon: Icon,
  variant = "secondary",
  size = "medium",
  isBusy = false,
  type,
  onPress,
  ...props
}: ButtonProps) {
  return (
    <AriaButton
      {...props}
      type={isBusy && type === "submit" ? "button" : type}
      onPress={isBusy ? undefined : onPress}
      aria-disabled={isBusy || undefined}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-medium data-disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${FOCUS_RING}`}
    >
      {isBusy ? (
        <LoaderCircle
          aria-hidden
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      ) : (
        Icon !== undefined && <Icon aria-hidden className="size-4" />
      )}
      {children}
    </AriaButton>
  );
}
