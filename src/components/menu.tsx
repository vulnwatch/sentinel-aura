import { Check, LoaderCircle, type LucideIcon } from "lucide-react";
import {
  MenuItem,
  Popover,
  Text,
  type MenuItemProps,
} from "react-aria-components";
import type { ReactNode } from "react";
import { INSIDE_FOCUS_RING } from "./focus-ring";

// The parts of a menu (docs/design-system.md, Menus, Popovers, and Tooltips),
// which the menus of the screens share, such as the account menu and the
// menu of the actions of a record.

// A menu item, 36 px high with a 6 px radius and 10 px of side padding, in
// text-15, on surface-hover under the pointer and on focus, with the focus
// ring inside it on keyboard focus.
const ITEM = `flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-15 text-fg data-focused:bg-surface-hover data-hovered:bg-surface-hover ${INSIDE_FOCUS_RING}`;

// The line that separates the groups of a menu.
export const MENU_SEPARATOR = "-mx-1 my-1 border-t border-border";

// loader-circle at 16 px in fg-muted, turning, in place of the icon or of the
// check of an item whose change is in progress; it stands still under reduced
// motion (docs/design-system.md, Focus and Motion).
function BusyMark() {
  return (
    <LoaderCircle
      aria-hidden
      className="size-4 shrink-0 animate-spin text-fg-muted motion-reduce:animate-none"
    />
  );
}

interface MenuPopoverProps {
  // Where the menu opens: below the end of its trigger, as the menu of the
  // actions of a record, or below its start, as the options of a select.
  placement: "bottom end" | "bottom start";
  children: ReactNode;
}

// The menu, 4 px below its trigger, at least as wide as it and as its
// longest item, on surface with a border line, an 8 px radius, a shadow, and
// 4 px of padding, scrolling within itself when it holds more than fits; a
// window narrower than the menu keeps it inside.
export function MenuPopover({ placement, children }: MenuPopoverProps) {
  return (
    <Popover
      placement={placement}
      offset={4}
      className="max-h-80 max-w-[calc(100vw-1rem)] min-w-(--trigger-width) overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg outline-none"
    >
      {children}
    </Popover>
  );
}

interface MenuActionProps extends Omit<
  MenuItemProps,
  "className" | "children" | "isDisabled"
> {
  icon: LucideIcon;
  // The description of the change that the item started, while it is in
  // progress: its icon gives way to loader-circle, and assistive technologies
  // read the description with the item, which keeps the focus, as a busy
  // button does (docs/behaviors.md, Loading). The item's action guards
  // against a second start.
  busy?: string | undefined;
  children: string;
}

// An item of a menu: its icon at 16 px in fg-muted before its label, and
// check at its end when it is the selected item of a single selection.
export function MenuAction({
  icon: Icon,
  busy,
  children,
  ...props
}: MenuActionProps) {
  return (
    <MenuItem {...props} textValue={children} className={ITEM}>
      {({ isSelected }) => (
        <>
          {busy !== undefined ? (
            <BusyMark />
          ) : (
            <Icon aria-hidden className="size-4 shrink-0 text-fg-muted" />
          )}
          <Text slot="label" className="min-w-0 flex-1">
            {children}
          </Text>
          {/* Always there, so that React Aria links it to the item, and
              empty unless the item is busy. */}
          <Text slot="description" className="sr-only">
            {busy}
          </Text>
          {isSelected && <Check aria-hidden className="size-4 shrink-0" />}
        </>
      )}
    </MenuItem>
  );
}

interface MenuChoiceProps extends Omit<
  MenuItemProps,
  "className" | "children" | "isDisabled" | "textValue"
> {
  // The text of the choice, which the keyboard finds it by.
  textValue: string;
  // The description of the change that choosing it started, while it is in
  // progress (MenuAction).
  busy?: string | undefined;
  // Its label, such as a value with its mark.
  children: ReactNode;
}

// An item of a single selection without an icon, such as a value of a select
// that a menu offers: its label, and at its end check when it is selected,
// or loader-circle in its place while the change that choosing it started is
// in progress.
export function MenuChoice({
  textValue,
  busy,
  children,
  ...props
}: MenuChoiceProps) {
  return (
    <MenuItem {...props} textValue={textValue} className={ITEM}>
      {({ isSelected }) => (
        <>
          <Text slot="label" className="flex min-w-0 flex-1 items-center">
            {children}
          </Text>
          <Text slot="description" className="sr-only">
            {busy}
          </Text>
          {busy !== undefined ? (
            <BusyMark />
          ) : (
            <Check
              aria-hidden
              className={`size-4 shrink-0 ${isSelected ? "" : "invisible"}`}
            />
          )}
        </>
      )}
    </MenuItem>
  );
}
