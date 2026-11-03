import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type LinkProps = Omit<AriaLinkProps, "className" | "style"> & {
  // In running text, underlined; in a table or a list, where it is an
  // identifier, a name, or an address, underlined under the pointer and on
  // focus.
  placement?: "text" | "list";
};

const PLACEMENTS = {
  text: "underline",
  list: "data-focus-visible:underline data-hovered:underline",
} as const;

// A link, in link (docs/design-system.md, Buttons and Links), which navigates
// through the router (src/components/router-links.tsx).
export function Link({ placement = "text", ...props }: LinkProps) {
  return (
    <AriaLink
      {...props}
      className={`text-link ${PLACEMENTS[placement]} ${FOCUS_RING}`}
    />
  );
}
