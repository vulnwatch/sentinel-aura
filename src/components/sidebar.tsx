import { useRouterState, type ToOptions } from "@tanstack/react-router";
import {
  Boxes,
  Database,
  Package,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldAlert,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Link as AriaLink,
  Dialog,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import type { CurrentUserData } from "../api/generated/model";
import { sidebarPreference, type SidebarPreference } from "../preferences";
import { AccountMenu } from "./account-menu";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
import { IconButton } from "./icon-button";
import { useNewestMessage } from "./message-area";
import { RouterLinks } from "./router-links";
import { focusScreenHeading } from "./screen-heading";
import { SentinelMark } from "./sentinel-mark";
import { Tooltip } from "./tooltip";

// The sidebar of every screen with a signed-in user (docs/screen-map.md,
// Sidebar; docs/design-system.md, Sidebar).

// The window width from which the sidebar follows the user's preference, in
// CSS pixels, which do not change with the text size; below it, the sidebar
// is always collapsed (docs/design-system.md, Spacing and Sizes).
const WIDE_WINDOW = "(min-width: 1024px)";

function subscribeToWindowWidth(listener: () => void): () => void {
  const query = window.matchMedia(WIDE_WINDOW);
  query.addEventListener("change", listener);
  return () => {
    query.removeEventListener("change", listener);
  };
}

function isWideWindow(): boolean {
  return window.matchMedia(WIDE_WINDOW).matches;
}

// Whether the window is wide enough for the expanded sidebar beside the
// content.
export function useWideWindow(): boolean {
  return useSyncExternalStore(subscribeToWindowWidth, isWideWindow);
}

// An entry of the global navigation: its name, the path to which it leads,
// the path under which every screen of its area lies, and its icon
// (docs/design-system.md, Icons by Need).
interface Entry {
  name: string;
  href: ToOptions["to"];
  area: string;
  icon: LucideIcon;
}

// The entries that every user sees, in their order (docs/screen-map.md,
// Sidebar; Areas and Screens).
const ENTRIES: readonly Entry[] = [
  { name: "Tickets", href: "/tickets", area: "/tickets", icon: Ticket },
  { name: "CVEs", href: "/cves", area: "/cves", icon: ShieldAlert },
  { name: "Packages", href: "/packages", area: "/packages", icon: Package },
  { name: "Products", href: "/products", area: "/products", icon: Boxes },
  {
    name: "My packages",
    href: "/my-packages",
    area: "/my-packages",
    icon: PackageCheck,
  },
  {
    name: "Data sources",
    href: "/data-sources",
    area: "/data-sources",
    icon: Database,
  },
];

// The entries of the user, from the capabilities of Get Current User, which
// only guide what the UI shows (docs/screen-map.md, Roles; Capabilities of
// the Signed-in User): Administration appears last, only to a user who holds
// manage_users or manage_settings, and opens Users for a user who holds
// manage_users, Settings otherwise. A capability that the pinned contract
// does not list changes nothing.
function entriesOf(user: CurrentUserData): readonly Entry[] {
  const users = user.capabilities.includes("manage_users");
  if (!users && !user.capabilities.includes("manage_settings")) {
    return ENTRIES;
  }
  return [
    ...ENTRIES,
    {
      name: "Administration",
      href: users ? "/admin/users" : "/admin/settings",
      area: "/admin",
      icon: Settings,
    },
  ];
}

// Whether the screen at the path belongs to the area of the entry, as the
// router matches a path: in any case, and with a trailing slash. The Home,
// Search results, and the screens of the user's own account belong to no
// entry.
function isCurrent(entry: Entry, path: string): boolean {
  const lowerPath = path.toLowerCase();
  return lowerPath === entry.area || lowerPath.startsWith(`${entry.area}/`);
}

// The path of the screen that shows.
function usePath(): string {
  return useRouterState({ select: (state) => state.location.pathname });
}

interface CurrentBarProps {
  // The edge along which the bar runs: the left edge of the entry, or, in the
  // collapsed sidebar, that of the sidebar beside it.
  edge: "entry" | "sidebar";
}

// The 3 px bar in link that marks the current entry.
function CurrentBar({ edge }: CurrentBarProps) {
  return (
    <span
      aria-hidden
      className={`absolute inset-y-2 w-0.75 rounded-r-full bg-link ${edge === "entry" ? "left-0" : "-left-2"}`}
    />
  );
}

interface EntryLinkProps {
  entry: Entry;
  current: boolean;
}

// An entry of the expanded sidebar: its icon at 18 px and its name, in
// fg-muted, on sidebar-active under the pointer; the current entry on
// sidebar-active, its name in fg at weight 600, its icon in link, with the bar.
function ExpandedEntry({ entry, current }: EntryLinkProps) {
  const { icon: Icon } = entry;
  return (
    <AriaLink
      href={entry.href}
      aria-current={current ? "page" : undefined}
      className={`relative flex h-9 items-center gap-3 rounded-md px-2.5 ${current ? "bg-sidebar-active font-semibold text-fg" : "text-fg-muted data-hovered:bg-sidebar-active"} ${FOCUS_RING}`}
    >
      {current && <CurrentBar edge="entry" />}
      <Icon
        aria-hidden
        className={`size-4.5 shrink-0 ${current ? "text-link" : ""}`}
      />
      <span className="min-w-0 truncate">{entry.name}</span>
    </AriaLink>
  );
}

// An entry of the collapsed sidebar: its icon at 18 px in a control of 40 px,
// named by the entry, which its tooltip shows.
function CollapsedEntry({ entry, current }: EntryLinkProps) {
  const { icon: Icon } = entry;
  return (
    <Tooltip text={entry.name} placement="end">
      <AriaLink
        href={entry.href}
        aria-label={entry.name}
        aria-current={current ? "page" : undefined}
        className={`relative flex size-10 items-center justify-center rounded-md ${current ? "bg-sidebar-active text-link" : "text-fg-muted data-hovered:bg-sidebar-active"} ${FOCUS_RING}`}
      >
        {current && <CurrentBar edge="sidebar" />}
        <Icon aria-hidden className="size-4.5" />
      </AriaLink>
    </Tooltip>
  );
}

interface ToggleButton {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
}

interface SidebarContentProps {
  user: CurrentUserData;
  // The button that collapses, closes, or expands the sidebar.
  toggle: ToggleButton;
  // Called with that button as it appears and leaves, so that it can take
  // the focus after it switched the sidebar.
  onToggleShown?: (button: HTMLButtonElement | null) => void;
}

// The expanded sidebar, 216 px wide: the product name, the entries, the
// collapse button, aligned right, and, below a line, the account button.
function ExpandedContent({ user, toggle, onToggleShown }: SidebarContentProps) {
  const path = usePath();
  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-2">
        <AriaLink
          href="/"
          className={`flex h-10 items-center gap-2.5 rounded-md px-2.5 text-16 font-semibold ${FOCUS_RING}`}
        >
          <SentinelMark className="size-5" />
          Sentinel
        </AriaLink>
      </div>
      <ul className="flex flex-col gap-0.5 px-2">
        {entriesOf(user).map((entry) => (
          <li key={entry.area}>
            <ExpandedEntry entry={entry} current={isCurrent(entry, path)} />
          </li>
        ))}
      </ul>
      <div className="mt-auto flex justify-end px-2 pt-4 pb-2">
        <IconButton
          label={toggle.label}
          icon={toggle.icon}
          size="medium"
          tooltipPlacement="end"
          onPress={toggle.onPress}
          ref={onToggleShown}
        />
      </div>
      <div className="border-t border-border p-2">
        <AccountMenu user={user} compact={false} />
      </div>
    </>
  );
}

// The collapsed sidebar, 56 px wide: the same parts as icon controls of
// 40 px, centered, each with its name in a tooltip to its right.
function CollapsedContent({
  user,
  toggle,
  onToggleShown,
}: SidebarContentProps) {
  const path = usePath();
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-center">
        <Tooltip text="Sentinel" placement="end">
          <AriaLink
            href="/"
            aria-label="Sentinel"
            className={`flex size-10 items-center justify-center rounded-md data-hovered:bg-sidebar-active ${FOCUS_RING}`}
          >
            <SentinelMark className="size-5.5" />
          </AriaLink>
        </Tooltip>
      </div>
      <ul className="flex flex-col items-center gap-0.5">
        {entriesOf(user).map((entry) => (
          <li key={entry.area}>
            <CollapsedEntry entry={entry} current={isCurrent(entry, path)} />
          </li>
        ))}
      </ul>
      <div className="mt-auto flex justify-center pt-4 pb-2">
        <IconButton
          label={toggle.label}
          icon={toggle.icon}
          size="medium"
          tooltipPlacement="end"
          onPress={toggle.onPress}
          ref={onToggleShown}
        />
      </div>
      <div className="flex justify-center border-t border-border py-2">
        <AccountMenu user={user} compact />
      </div>
    </>
  );
}

// The frame of the sidebar along the left edge of the window, the full
// height, in place while the content scrolls and scrolling within itself
// when the window is shorter. It is the navigation landmark of the screen.
const SIDEBAR_FRAME =
  "flex flex-col overflow-y-auto border-r border-border bg-sidebar";

interface SidebarProps {
  user: CurrentUserData;
  // Whether the window is wide enough for the expanded sidebar (useWideWindow).
  wide: boolean;
  // Whether the sidebar is expanded beside the content.
  expanded: boolean;
}

// Where the sidebar opened over the content: the URL, and the newest message
// of the message area. Another URL, or a new message, closes it.
interface OpenedAt {
  href: string;
  message: number | undefined;
}

// The sidebar, expanded or collapsed as the user prefers where the window is
// wide enough (docs/behaviors.md, Preferences); its button keeps the focus
// when it switches the sidebar. Below that width it is always collapsed, and
// its expand button opens the expanded sidebar over the content, as a dialog
// that takes the focus. Escape, its close button, or a click outside it
// closes it and returns the focus to the expand button, and so does a new
// message, such as the failure of Sign out, so that the message shows. A
// navigation from it closes it, also to the URL that shows, and the focus
// follows the navigation (FocusAfterNavigation). Opening it changes no
// preference, and a window that grows past that width closes it, with the
// focus on the screen's heading.
export function Sidebar({ user, wide, expanded }: SidebarProps) {
  const href = useRouterState({ select: (state) => state.location.href });
  const message = useNewestMessage();
  const [openedAt, setOpenedAt] = useState<OpenedAt>();
  if (wide && openedAt !== undefined) {
    setOpenedAt(undefined);
  }
  const open = !wide && openedAt?.href === href && openedAt.message === message;
  const close = () => {
    setOpenedAt(undefined);
  };

  // The button that collapses or expands the sidebar beside the content
  // gives way to the one of the other state, which takes the focus as it
  // appears.
  const focusToggle = useRef(false);
  const switchTo = (preference: SidebarPreference) => {
    focusToggle.current = true;
    sidebarPreference.set(preference);
  };
  const toggleShown = useCallback((button: HTMLButtonElement | null) => {
    if (button !== null && focusToggle.current) {
      focusToggle.current = false;
      button.focus();
    }
  }, []);

  // The sidebar over the content held the focus, which the window that grew
  // has removed with it, once the sidebar has left the page.
  const wasOpen = useRef(open);
  useLayoutEffect(() => {
    const closedByWidth = wasOpen.current && wide;
    wasOpen.current = open;
    if (!closedByWidth) {
      return undefined;
    }
    const frame = requestAnimationFrame(() => {
      if (document.activeElement === document.body) {
        focusScreenHeading();
      }
    });
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [open, wide]);

  return (
    <>
      <nav
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-20 ${expanded ? "w-54" : "w-14"} ${SIDEBAR_FRAME}`}
      >
        {expanded ? (
          <ExpandedContent
            user={user}
            toggle={{
              label: "Collapse navigation",
              icon: PanelLeftClose,
              onPress: () => {
                switchTo("collapsed");
              },
            }}
            onToggleShown={toggleShown}
          />
        ) : (
          <CollapsedContent
            user={user}
            toggle={{
              label: "Expand navigation",
              icon: PanelLeftOpen,
              onPress: () => {
                if (wide) {
                  switchTo("expanded");
                } else {
                  setOpenedAt({ href, message });
                }
              },
            }}
            onToggleShown={toggleShown}
          />
        )}
      </nav>
      <ModalOverlay
        isOpen={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            close();
          }
        }}
        isDismissable
        className="fixed inset-0 z-30 bg-overlay"
      >
        <Modal className="fixed inset-y-0 left-0 w-54 max-w-full shadow-xl outline-none">
          <Dialog
            aria-label="Navigation"
            className={`h-full ${INSIDE_FOCUS_RING}`}
          >
            <RouterLinks onNavigate={close}>
              <nav aria-label="Main" className={`h-full ${SIDEBAR_FRAME}`}>
                <ExpandedContent
                  user={user}
                  toggle={{
                    label: "Close navigation",
                    icon: PanelLeftClose,
                    onPress: close,
                  }}
                />
              </nav>
            </RouterLinks>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
