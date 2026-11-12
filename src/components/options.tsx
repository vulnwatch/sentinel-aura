import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { ListBoxItem } from "react-aria-components";
import { INSIDE_FOCUS_RING } from "./focus-ring";
import { displayName, User, type UserFields } from "./user";

// The options of a select or a combobox, which open as a menu below their
// field (docs/design-system.md, Forms; Menus, Popovers, and Tooltips).

// The menu of the options: below the field, at least as wide as it, on
// surface with a border line, an 8 px radius, a shadow, and 4 px of padding,
// scrolling within itself when it holds more options than fit.
export const OPTIONS_POPOVER =
  "max-h-80 max-w-[calc(100vw-1rem)] min-w-(--trigger-width) overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg outline-none";

interface OptionProps {
  // The key of the option.
  id: string;
  // The text of the option, which the keyboard finds it by and a combobox
  // shows in its field once it is chosen.
  textValue: string;
  // Its label, such as a user in the full form.
  children: ReactNode;
}

// An option, 36 px high with a 6 px radius and 10 px of side padding, in
// text-15, on surface-hover under the pointer and on focus, with the focus
// ring inside it on keyboard focus, and check at its end when it is chosen.
// A disabled option shows at 60 % opacity, as a disabled button does
// (docs/design-system.md, Buttons and Links).
export function Option({ id, textValue, children }: OptionProps) {
  return (
    <ListBoxItem
      id={id}
      textValue={textValue}
      className={`group flex min-h-9 cursor-default items-center justify-between gap-2 rounded-md px-2.5 text-15 text-fg data-disabled:opacity-60 data-focused:bg-surface-hover ${INSIDE_FOCUS_RING}`}
    >
      <span className="flex min-w-0 items-center">{children}</span>
      <Check
        aria-hidden
        className="invisible size-4 shrink-0 group-data-selected:visible"
      />
    </ListBoxItem>
  );
}

interface OptionsStatusProps {
  children: ReactNode;
}

// What shows in place of the options that a field reads: the loading
// indicator, the message of the failure of the read, or a line such as "No
// users match." (docs/design-system.md, Forms).
export function OptionsStatus({ children }: OptionsStatusProps) {
  return <div className="px-2.5 py-2 text-14 text-fg-muted">{children}</div>;
}

// The text of a user as an option, which the keyboard finds it by: the
// display name, then @ and the username.
export function userOptionText(user: UserFields): string {
  return `${displayName(user)} @${user.username}`;
}

interface UserOptionLabelProps {
  user: UserFields;
  // The labels that follow the user's own, such as You.
  labels?: ReactNode;
}

// A user as the label of an option: the full form at the small size with
// the username and the labels, where users must be told apart exactly
// (docs/behaviors.md, Representation of a User).
export function UserOptionLabel({ user, labels }: UserOptionLabelProps) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <User user={user} withUsername />
      {labels}
    </span>
  );
}
