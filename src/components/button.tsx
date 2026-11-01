import {
  Button as AriaButton,
  type ButtonProps as AriaButtonProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export interface ButtonProps extends Omit<
  AriaButtonProps,
  "className" | "style"
> {
  // 32 px high in a message, or 36 px elsewhere, such as in place of content
  // (docs/design-system.md, Buttons and Links).
  size?: "regular" | "small";
}

const HEIGHTS = { regular: "h-9", small: "h-8" } as const;

// A secondary button (docs/design-system.md, Buttons and Links), such as Try
// again.
export function Button({ size = "regular", ...props }: ButtonProps) {
  return (
    <AriaButton
      {...props}
      className={`inline-flex ${HEIGHTS[size]} shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-15 font-medium text-fg data-disabled:opacity-60 data-hovered:bg-surface-hover ${FOCUS_RING}`}
    />
  );
}
