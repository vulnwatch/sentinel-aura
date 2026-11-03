import type { ReactNode } from "react";
import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type ButtonLinkProps = Omit<
  AriaLinkProps,
  "className" | "style" | "children"
> & {
  // The label of the link, with its icon.
  children: ReactNode;
  // Small in the toolbar and the pagination of a list, 32 px high, in
  // text-14; medium elsewhere, such as in an empty state, 36 px high.
  size?: "small" | "medium";
};

const SIZES = { small: "h-8 text-14", medium: "h-9 text-15" } as const;

// A link that looks like a secondary button (docs/design-system.md, Buttons
// and Links), for an action that opens another address of the UI, such as
// the next page of a list: it navigates through the router
// (src/components/router-links.tsx), so it keeps the address of a link, which
// the browser can open in another tab. A disabled one shows at 60 % opacity
// and leads nowhere.
export function ButtonLink({
  children,
  size = "medium",
  ...props
}: ButtonLinkProps) {
  return (
    <AriaLink
      {...props}
      className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-border-strong bg-surface px-3 font-medium text-fg data-disabled:opacity-60 data-hovered:bg-surface-hover ${SIZES[size]} ${FOCUS_RING}`}
    >
      {children}
    </AriaLink>
  );
}
