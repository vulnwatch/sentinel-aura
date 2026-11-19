import type { ReactNode, Ref } from "react";
import {
  Button as AriaButton,
  DialogTrigger,
  Menu,
} from "react-aria-components";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
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
  // The accessible name of the button, which starts with the name, when the
  // name alone does not tell it from the other buttons of its kind, such as
  // "CNA for fictional-tar".
  label?: string;
  // What identifies the record further, such as a CPE, below the title.
  identifier?: ReactNode;
  // The details of the record, as a description list
  // (src/components/description-list.tsx).
  children: ReactNode;
  // Whether the popover is open, for a name whose screen follows it, such as
  // one that offers actions as they were when it opened.
  isOpen?: boolean | undefined;
  onOpenChange?: ((isOpen: boolean) => void) | undefined;
  // The actions of the record, the items of a menu (MenuAction), for a user
  // who can take them.
  actions?: ReactNode;
  // Whether the change of one of its actions is in progress, which its item
  // shows: the popover cannot be closed until the change ends
  // (docs/behaviors.md, Loading).
  busy?: boolean | undefined;
  ref?: Ref<HTMLButtonElement> | undefined;
}

// A name that opens a popover with the details of its record, and with its
// actions for a user who can take them (docs/design-system.md, Menus,
// Popovers, and Tooltips), such as a Product of a package tree. Its popover,
// 320 px wide (InfoPopover), holds its title, the name, in text-16, weight
// 600, wrapping; below it, in text-13, fg-muted, what identifies the record
// further; a border line with 12 px of space above and below it; the
// details; and, with actions, another such line and the menu "Actions", one
// stop of Tab, whose items start their icons where the details start, with
// the focus ring inside it when it holds the focus itself, as when a read
// removed the item that held it. While
// an action is in progress, Escape and a click outside leave the popover
// open.
export function DetailsName({
  name,
  label,
  identifier,
  children,
  isOpen,
  onOpenChange,
  actions,
  busy = false,
  ref,
}: DetailsNameProps) {
  return (
    <DialogTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!busy) {
          onOpenChange?.(open);
        }
      }}
    >
      <AriaButton
        ref={ref}
        aria-label={label}
        className={`${OPENER} wrap-break-word`}
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
        {actions !== undefined && (
          <>
            <PopoverLine />
            <Menu
              aria-label="Actions"
              className={`-mx-2.5 rounded-md ${INSIDE_FOCUS_RING}`}
            >
              {actions}
            </Menu>
          </>
        )}
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

interface ValueRecordsProps {
  // The value, which the button shows.
  value: string;
  // The accessible name of the button, which names what the value is, its
  // record, and then the value, such as "Delivery of fictional-openssl,
  // SUSE:FLES-15-SP7:Update: In progress".
  label: string;
  // The title of the popover, which names the value without stating it, such
  // as "Delivery".
  title: string;
  // The records, as a description list whose terms take the width of the
  // longest one (src/components/description-list.tsx).
  children: ReactNode;
}

// A value that opens the records related to it (docs/design-system.md,
// Menus, Popovers, and Tooltips), such as the delivery of a track with its
// requests: the button of a name, and the popover of a name without actions,
// which holds its title, a border line, and the records. The popover does not
// repeat the value, which its line shows beside the button.
export function ValueRecords({
  value,
  label,
  title,
  children,
}: ValueRecordsProps) {
  return (
    <DialogTrigger>
      <AriaButton aria-label={label} className={`${OPENER} wrap-break-word`}>
        {value}
      </AriaButton>
      <InfoPopover width="wide">
        <PopoverTitle>{title}</PopoverTitle>
        <PopoverLine />
        {children}
      </InfoPopover>
    </DialogTrigger>
  );
}
