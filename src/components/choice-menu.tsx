import { ChevronDown } from "lucide-react";
import type { ReactNode, Ref } from "react";
import {
  Button as AriaButton,
  Menu,
  MenuTrigger,
  type Key,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { MENU_FOCUS_RING, MenuChoice, MenuPopover } from "./menu";

// A choice of the menu.
export interface Choice {
  id: string;
  // The text of the choice, which the keyboard finds it by.
  textValue: string;
  // How it shows, such as a value with its mark.
  content: ReactNode;
}

interface ChoiceMenuProps {
  // The accessible name of the button, which names what it chooses and its
  // record, and states the value chosen, such as "Affectedness of
  // fictional-openssl, SUSE:FLES-15-SP7:Update: Affected".
  label: string;
  // The value chosen, as the button shows it.
  value: ReactNode;
  choices: readonly Choice[];
  // The id of the choice that holds the value.
  chosen: string;
  // The id of the choice whose change is in progress, or null.
  busy: string | null;
  // What assistive technologies read with the busy choice, such as
  // "Changing the affectedness.".
  busyText: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  // Applies a choice other than the one chosen.
  onChoose: (id: string) => void;
  ref?: Ref<HTMLButtonElement> | undefined;
}

// A select of a value of a record whose choice applies at once, within the
// line of the record, such as the affectedness of a track
// (docs/design-system.md, Forms; Menus, Popovers, and Tooltips): a quiet
// button 28 px high, without a boundary or a fill, with a 6 px radius and
// surface-hover under the pointer, in text-14 and fg, which keeps its colors
// in a hidden record, the value as its choice shows it, then chevron-down at
// 14 px in fg-muted. It
// opens its choices as a menu of single selection below its start, at least
// as wide as it, the chosen one with check, rather than as the options of a
// select, which change the value while the user types on the button closed,
// with the focus ring inside the menu when it holds the focus itself, as when
// a read removed the choice that held it. Choosing another value starts its
// change: the choice is busy, the others are unavailable, and the menu
// cannot be closed until the change ends (docs/behaviors.md, Loading;
// docs/design-system.md, Menus, Popovers, and Tooltips); choosing the value
// chosen closes the menu.
export function ChoiceMenu({
  label,
  value,
  choices,
  chosen,
  busy,
  busyText,
  isOpen,
  onOpenChange,
  onChoose,
  ref,
}: ChoiceMenuProps) {
  const choose = (key: Key) => {
    if (busy === null && key !== chosen) {
      onChoose(String(key));
    }
  };
  return (
    <MenuTrigger
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (busy === null) {
          onOpenChange(open);
        }
      }}
    >
      <AriaButton
        ref={ref}
        aria-label={label}
        className={`inline-flex h-7 max-w-full shrink-0 cursor-default items-center gap-1.5 rounded-md ps-2 pe-1.5 text-14 text-fg data-hovered:bg-surface-hover data-pressed:bg-surface-hover ${FOCUS_RING}`}
      >
        <span className="flex min-w-0 items-center">{value}</span>
        <ChevronDown aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
      </AriaButton>
      <MenuPopover placement="bottom start">
        <Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[chosen]}
          onAction={choose}
          className={MENU_FOCUS_RING}
        >
          {choices.map((choice) => (
            <MenuChoice
              key={choice.id}
              id={choice.id}
              textValue={choice.textValue}
              busy={busy === choice.id ? busyText : undefined}
              unavailable={busy !== null && busy !== choice.id}
              shouldCloseOnSelect={choice.id === chosen}
            >
              {choice.content}
            </MenuChoice>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}
