import {
  Link as AriaLink,
  type LinkProps as AriaLinkProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type LinkProps = Omit<AriaLinkProps, "className" | "style"> & {
  // In running text, in link, underlined; in a table or a list, where it is
  // an identifier, a name, or an address, in link, underlined under the
  // pointer and on focus; in a message, in the color of its text,
  // underlined, at weight 500.
  placement?: "text" | "list" | "message";
};

const PLACEMENTS = {
  text: "text-link underline",
  list: "text-link data-focus-visible:underline data-hovered:underline",
  message: "font-medium underline",
} as const;

// A link (docs/design-system.md, Buttons and Links; Messages), which
// navigates through the router (src/components/router-links.tsx).
export function Link({ placement = "text", ...props }: LinkProps) {
  return (
    <AriaLink {...props} className={`${PLACEMENTS[placement]} ${FOCUS_RING}`} />
  );
}
