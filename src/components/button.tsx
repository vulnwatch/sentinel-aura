import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type ButtonProps = Omit<AriaButtonProps, "className" | "style">;

// A secondary button, 36 px high (docs/design-system.md, Buttons and Links),
// such as Try again.
export function Button(props: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-15 font-medium text-fg data-disabled:opacity-60 data-hovered:bg-surface-hover ${FOCUS_RING}`}
    />
  );
}
