import { Ellipsis } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Menu, MenuTrigger } from "react-aria-components";
import { IconButton } from "./icon-button";
import { MenuPopover } from "./menu";

interface ActionsMenuProps {
  // The accessible name of the button, which names its record, such as
  // "Actions of fictional-openssl"; the menu takes the same name.
  label: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // Whether the change of one of its items is in progress: the button is
  // busy, and the menu cannot be closed until the change ends
  // (docs/behaviors.md, Loading).
  busy: boolean;
  ref?: Ref<HTMLButtonElement> | undefined;
  // Its items (MenuAction).
  children: ReactNode;
}

// The other actions of a record within a part of a detail screen, such as a
// package of a Ticket (docs/design-system.md, Menus, Popovers, and Tooltips):
// an icon button of 24 px with ellipsis at 16 px in fg, which keeps its color
// in a hidden record (Detail Screens), named by the actions and their record,
// whose tooltip says "Actions", which opens them as a menu below its end. An
// item whose change applies at once keeps the menu open, busy, until
// Sentinel answers.
export function ActionsMenu({
  label,
  isOpen,
  onOpenChange,
  busy,
  ref,
  children,
}: ActionsMenuProps) {
  return (
    <MenuTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!busy) {
          onOpenChange(open);
        }
      }}
    >
      <span className="flex text-fg">
        <IconButton
          ref={ref}
          label={label}
          tooltip="Actions"
          icon={Ellipsis}
          size="small"
          isBusy={busy}
          onPress={() => undefined}
        />
      </span>
      <MenuPopover placement="bottom end">
        <Menu className="min-w-44 outline-none">{children}</Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
