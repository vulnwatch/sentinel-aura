import { LoaderCircle } from "lucide-react";
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
  // Primary for the main action of a screen, a form, or a dialog, one per
  // screen part; secondary for every other action, such as Try again
  // (docs/design-system.md, Buttons and Links).
  variant?: "primary" | "secondary";
  // Large in forms and dialogs, 40 px high; medium elsewhere, 36 px high.
  size?: "medium" | "large";
  // Whether the change that the button started is in progress.
  isBusy?: boolean;
};

const VARIANTS = {
  primary: "bg-accent text-on-accent data-hovered:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-fg data-hovered:bg-surface-hover",
} as const;

const SIZES = { medium: "h-9 px-3", large: "h-10 px-4" } as const;

// A button (docs/design-system.md, Buttons and Links). While the change that
// it started is in progress, it is busy: it shows loader-circle before its
// label, which it keeps, and cannot be pressed, but it keeps the focus
// (docs/behaviors.md, Loading). A busy submit button does not submit its
// form; Enter in a field of a form with a single field still does, so such a
// form guards its submission itself. The spinner stands still under reduced
// motion (docs/design-system.md, Focus and Motion). React Aria's own pending
// state is not used: it announces the button through a reference to it, which
// stays behind in the page when the button leaves it, as Sign in does once it
// succeeds.
export function Button({
  children,
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
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-15 font-medium data-disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${FOCUS_RING}`}
    >
      {isBusy && (
        <LoaderCircle
          aria-hidden
          className="size-4 animate-spin motion-reduce:animate-none"
        />
      )}
      {children}
    </AriaButton>
  );
}
