import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type LinkProps = Omit<AriaLinkProps, "className" | "style">;

// A link in running text, in link and underlined (docs/design-system.md,
// Buttons and Links), which navigates through the router
// (src/components/router-links.tsx).
export function Link(props: LinkProps) {
  return (
    <AriaLink {...props} className={`text-link underline ${FOCUS_RING}`} />
  );
}
