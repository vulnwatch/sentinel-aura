import type { ReactNode } from "react";
import { Button as AriaButton, DialogTrigger } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { InfoPopover, PopoverLine, PopoverTitle } from "./info-popover";

// The button of a name or a value that opens a popover: in the style of the
// text around it, its color included, with a dotted underline in
// border-strong 3 px below it, which is in fg under the pointer. It wraps,
// and its target is at least 24 px high.
const OPENER = `max-w-full cursor-default rounded py-0.5 text-start underline decoration-border-strong decoration-dotted underline-offset-3 data-hovered:decoration-fg ${FOCUS_RING}`;

interface DetailsNameProps {
  // The name of the record, which the button and the title of its popover
  // show.
  name: string;
  // What identifies the record further, such as a CPE, below the title; it
  // takes no room while it renders nothing, such as the short name of a CNA
  // until its details arrive.
  identifier?: ReactNode;
  // The details of the record, as a description list
  // (src/components/description-list.tsx).
  children: ReactNode;
}

// A name that opens a popover with the details of its record
// (docs/design-system.md, Menus, Popovers, and Tooltips), such as a Product
// of a package tree. Its popover, 320 px wide (InfoPopover), holds its
// title, the name, in text-16, weight 600, wrapping; below it, in text-13,
// fg-muted, what identifies the record further; a border line with 12 px of
// space above and below it; and the details.
export function DetailsName({ name, identifier, children }: DetailsNameProps) {
  return (
    <DialogTrigger>
      <AriaButton className={`${OPENER} wrap-break-word`}>{name}</AriaButton>
      <InfoPopover width="wide">
        <PopoverTitle>{name}</PopoverTitle>
        {identifier !== undefined && (
          <p className="text-13 wrap-anywhere text-fg-muted empty:hidden">
            {identifier}
          </p>
        )}
        <PopoverLine />
        {children}
      </InfoPopover>
    </DialogTrigger>
  );
}

interface DetailsValueProps {
  // The value, in its type, such as a vector in monospace, which the button
  // shows and which names it, and which the popover shows below its title.
  value: ReactNode;
  // The title of the popover, which names the record of the value.
  title: string;
  // What the value encodes, as a description list whose terms take the
  // width of the longest one (src/components/description-list.tsx).
  children: ReactNode;
  // A link to another site that explains the value, below the details.
  link?: ReactNode;
}

// A value that opens a popover with what it encodes (docs/design-system.md,
// Menus, Popovers, and Tooltips), such as the vector of a CVSS assessment:
// the button of a name in the type of the value, and the popover of a name
// without actions, which holds its title; below it, in text-13, fg-muted,
// the value, which the user can select and copy; a border line; the
// details; and, with a link, another line and the link.
export function DetailsValue({
  value,
  title,
  children,
  link,
}: DetailsValueProps) {
  return (
    <DialogTrigger>
      <AriaButton className={OPENER}>{value}</AriaButton>
      <InfoPopover width="wide">
        <PopoverTitle>{title}</PopoverTitle>
        <p className="text-13 text-fg-muted">{value}</p>
        <PopoverLine />
        {children}
        {link !== undefined && (
          <>
            <PopoverLine />
            <p>{link}</p>
          </>
        )}
      </InfoPopover>
    </DialogTrigger>
  );
}
