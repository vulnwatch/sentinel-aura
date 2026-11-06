import {
  Check,
  ChevronsUpDown,
  KeyRound,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Sun,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  Button as AriaButton,
  Header,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Popover,
  Separator,
  Text,
  type MenuItemProps,
  type Selection,
} from "react-aria-components";
import { isRequestFailure, presentFailure } from "../api/errors";
import type { CurrentUserData } from "../api/generated/model";
import { usePreference } from "../preferences";
import { useSignOut } from "../session-gate";
import { themePreference, type ThemePreference } from "../theme";
import { Avatar } from "./avatar";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
import { useShowMessage } from "./message-area";
import { Tooltip } from "./tooltip";
import { compactName, StackedUser, User } from "./user";

// The account button of the sidebar and the account menu that it opens
// (docs/screen-map.md, Sidebar; docs/design-system.md, Sidebar; Account
// Menu): the signed-in user, the screens of the user's own account, the
// theme, and Sign out.

// The choices of the theme, in the order of the menu (docs/behaviors.md,
// Preferences).
const THEMES: readonly {
  id: ThemePreference;
  name: string;
  icon: LucideIcon;
}[] = [
  { id: "system", name: "System", icon: Monitor },
  { id: "light", name: "Light", icon: Sun },
  { id: "dark", name: "Dark", icon: Moon },
];

function isThemePreference(key: unknown): key is ThemePreference {
  return THEMES.some(({ id }) => id === key);
}

// The classes of the parts of the menu (docs/design-system.md, Menus,
// Popovers, and Tooltips). A menu item shows the focus with surface-hover and,
// on keyboard focus, the focus ring inside it.
const ITEM = `flex h-9 cursor-default items-center gap-2.5 rounded-md px-2.5 text-15 data-focused:bg-surface-hover data-hovered:bg-surface-hover ${INSIDE_FOCUS_RING}`;
const SEPARATOR = "-mx-1 my-1 border-t border-border";

// Applies the theme that the user selects, in every open tab.
function selectTheme(keys: Selection) {
  if (keys === "all") {
    return;
  }
  const [key] = keys;
  if (isThemePreference(key)) {
    themePreference.set(key);
  }
}

interface ItemProps extends Omit<
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

// An item of the account menu: its icon at 16 px in fg-muted before its
// label, and check at its end when it is the selected item of a single
// selection.
function Item({ icon: Icon, busy, children, ...props }: ItemProps) {
  return (
    <MenuItem {...props} textValue={children} className={ITEM}>
      {({ isSelected }) => (
        <>
          {busy !== undefined ? (
            <LoaderCircle
              aria-hidden
              className="size-4 shrink-0 animate-spin text-fg-muted motion-reduce:animate-none"
            />
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

interface AccountTriggerProps {
  user: CurrentUserData;
  compact: boolean;
}

// The account button, 44 px high: the avatar at the medium size, 12 px from
// the left edge of the sidebar in both of its states, the display name, cut
// with an ellipsis when it is longer than its place, with its labels, and
// chevrons-up-down; in the collapsed sidebar, the avatar alone, the compact
// form of the user, named by the compact name, which its tooltip shows
// (docs/behaviors.md, Representation of a User; docs/design-system.md,
// Sidebar). The button keeps its element across the states.
function AccountTrigger({ user, compact }: AccountTriggerProps): ReactNode {
  const name = compactName(user);
  return (
    <Tooltip text={name} placement="end" isDisabled={!compact}>
      <AriaButton
        aria-label={compact ? name : undefined}
        className={`flex h-11 items-center gap-2 rounded-md px-1 text-start ${compact ? "w-10" : "w-full"} font-medium data-hovered:bg-sidebar-active ${FOCUS_RING}`}
      >
        <span className="flex min-w-0 flex-1">
          {compact ? (
            <Avatar user={user} size="medium" />
          ) : (
            <User user={user} size="medium" />
          )}
        </span>
        {!compact && (
          <ChevronsUpDown
            aria-hidden
            className="size-4 shrink-0 text-fg-muted"
          />
        )}
      </AriaButton>
    </Tooltip>
  );
}

interface AccountMenuProps {
  user: CurrentUserData;
  // Whether the sidebar is collapsed, so that the button shows the avatar
  // alone.
  compact: boolean;
}

// The account button, which opens the account menu upward, 256 px wide,
// named by the button. The menu starts with the signed-in user, with the
// username always on a line of its own, and the name and the username wrap
// rather than end with an ellipsis, so that the menu shows whole the name
// that the button cuts. Its items follow in three groups: Account and its API
// keys, the screens of the user's own account; the theme, which applies at
// once in every open tab; and Sign out, which asks for no confirmation and
// stays in the open menu, busy, until it ends. When it fails, the menu closes
// and the message area shows the message of its status, which also closes the
// sidebar opened over the content (docs/behaviors.md, Sign-out; Default
// Presentation by Status).
export function AccountMenu({ user, compact }: AccountMenuProps) {
  const showMessage = useShowMessage();
  const theme = usePreference(themePreference);
  const [isOpen, setOpen] = useState(false);
  // A failure of the UI itself, which the root route shows
  // (src/routes/root.tsx).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const signOut = useSignOut((failure) => {
    setOpen(false);
    if (!isRequestFailure(failure)) {
      setUiFailure({ error: failure });
      return;
    }
    const presentation = presentFailure(failure, "session");
    if (presentation !== undefined) {
      showMessage({
        tone: "danger",
        text: presentation.message,
        reference: presentation.reference,
      });
    }
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  return (
    <MenuTrigger isOpen={isOpen} onOpenChange={setOpen}>
      <AccountTrigger user={user} compact={compact} />
      <Popover
        placement="top start"
        offset={4}
        className="w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-surface p-1 shadow-lg outline-none"
      >
        <div className="px-2.5 py-2 font-semibold">
          <StackedUser user={user} size="medium" />
        </div>
        <div className={SEPARATOR} />
        <Menu className="outline-none">
          <MenuSection>
            <Item id="account" icon={UserIcon} href="/account">
              Account
            </Item>
            <Item id="api-keys" icon={KeyRound} href="/account/api-keys">
              API keys
            </Item>
          </MenuSection>
          <Separator className={SEPARATOR} />
          <MenuSection
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[theme]}
            onSelectionChange={selectTheme}
          >
            <Header className="px-2.5 pt-1 pb-0.5 text-12 font-medium text-fg-muted">
              Theme
            </Header>
            {THEMES.map(({ id, name, icon }) => (
              <Item key={id} id={id} icon={icon}>
                {name}
              </Item>
            ))}
          </MenuSection>
          <Separator className={SEPARATOR} />
          <MenuSection>
            <Item
              id="sign-out"
              icon={LogOut}
              busy={signOut.busy ? "Signing out" : undefined}
              shouldCloseOnSelect={false}
              onAction={signOut.start}
            >
              Sign out
            </Item>
          </MenuSection>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}
