import type { ReactNode } from "react";
import { Button as AriaButton, DialogTrigger } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { InfoPopover, PopoverLine, PopoverTitle } from "./info-popover";

interface DetailsNameProps {
  // The name of the record, which the button and the title of its popover
  // show.
  name: string;
  // What identifies the record further, such as a CPE, below the title.
  identifier?: ReactNode;
  // The details of the record, as a description list
  // (src/components/description-list.tsx).
  children: ReactNode;
}

// A name that opens a popover with the details of its record
// (docs/design-system.md, Menus, Popovers, and Tooltips), such as a Product
// of a package tree: a button in the style of the text around it, its color
// included, with a dotted underline in border-strong 3 px below it, which is
// in fg under the pointer. It wraps, and its target is at least 24 px high.
// Its popover, 320 px wide (InfoPopover), holds its title, the name, in
// text-16, weight 600, wrapping; below it, in text-13, fg-muted, what
// identifies the record further; a border line with 12 px of space above
// and below it; and the details.
export function DetailsName({ name, identifier, children }: DetailsNameProps) {
  return (
    <DialogTrigger>
      <AriaButton
        className={`max-w-full cursor-default rounded py-0.5 text-start wrap-break-word underline decoration-border-strong decoration-dotted underline-offset-3 data-hovered:decoration-fg ${FOCUS_RING}`}
      >
        {name}
      </AriaButton>
      <InfoPopover width="wide">
        <PopoverTitle>{name}</PopoverTitle>
        {identifier !== undefined && (
          <p className="text-13 wrap-anywhere text-fg-muted">{identifier}</p>
        )}
        <PopoverLine />
        {children}
      </InfoPopover>
    </DialogTrigger>
  );
}
