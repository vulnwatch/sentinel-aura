import { linkOptions, useRouterState } from "@tanstack/react-router";
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
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Link as AriaLink,
  Dialog,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import type { CurrentUserData } from "../api/generated/model";
import { sidebarPreference } from "../preferences";
import { holdsAnalystRole } from "../session-gate";
import { AccountMenu } from "./account-menu";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
import { IconButton } from "./icon-button";
import { useNewestMessage } from "./message-area";
import { RouterLinks, type ScreenHref } from "./router-links";
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
  href: ScreenHref;
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

// The entries of the user, from the roles and the capabilities of Get
// Current User, which only guide what the UI shows (docs/screen-map.md,
// Roles; Capabilities of the Signed-in User): Tickets opens the Ticket list
// in its New view for a user who holds the vulnerability_analyst role, and in
// its All view for every other user; Administration appears last, only to a
// user who holds manage_users or manage_settings, and opens Users for a user
// who holds manage_users, Settings otherwise. A role or a capability that the
// pinned contract does not list changes nothing.
function entriesOf(user: CurrentUserData): readonly Entry[] {
  const entries = holdsAnalystRole(user)
    ? ENTRIES.map((entry) =>
        entry.area === "/tickets"
          ? {
              ...entry,
              href: linkOptions({ to: "/tickets", search: { view: "new" } }),
            }
          : entry,
      )
    : ENTRIES;
  const users = user.capabilities.includes("manage_users");
  if (!users && !user.capabilities.includes("manage_settings")) {
    return entries;
  }
  return [
    ...entries,
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

// The padding of an entry, so that its icon at 18 px is centered 28 px from
// the left edge of the sidebar: 8 px of margin, then 11 px.
const CONTROL_INSET = "pr-2.5 pl-2.75";

// The 3 px bar in link along the left edge of the current entry.
function CurrentBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-y-2 left-0 w-0.75 rounded-r-full bg-link"
    />
  );
}

interface EntryLinkProps {
  entry: Entry;
  current: boolean;
  // Whether the sidebar is collapsed, which leaves the icon alone.
  collapsed: boolean;
}

// An entry: its icon at 18 px and its name, in fg-muted, on sidebar-active
// under the pointer; the current entry on sidebar-active, its name in fg at
// weight 600, its icon in link, with the bar. In the collapsed sidebar the
// name is hidden but still names the entry, and shows in its tooltip.
function EntryLink({ entry, current, collapsed }: EntryLinkProps) {
  const { icon: Icon } = entry;
  return (
    <Tooltip text={entry.name} placement="end" isDisabled={!collapsed}>
      <AriaLink
        href={entry.href}
        aria-current={current ? "page" : undefined}
        className={`relative flex h-9 items-center gap-3 rounded-md ${collapsed ? "w-10" : ""} ${CONTROL_INSET} ${current ? "bg-sidebar-active font-semibold text-fg" : "text-fg-muted data-hovered:bg-sidebar-active"} ${FOCUS_RING}`}
      >
        {current && <CurrentBar />}
        <Icon
          aria-hidden
          className={`size-4.5 shrink-0 ${current ? "text-link" : ""}`}
        />
        <span className={collapsed ? "sr-only" : "min-w-0 truncate"}>
          {entry.name}
        </span>
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
  // Whether the sidebar is collapsed to its icons.
  collapsed: boolean;
  // The button that collapses, closes, or expands the sidebar.
  toggle: ToggleButton;
}

// The parts of the sidebar, the same in both of its states, at the same
// places (docs/design-system.md, Sidebar): the product name, the entries, the
// button that collapses or expands it, and, below a line, the account button.
// Their icons, the Sentinel mark, and the avatar are centered 28 px from the
// left edge of the sidebar, the middle of its collapsed width, so that
// collapsing or expanding it moves none of them: it only hides the names and
// shows them in tooltips. Each control keeps its element across the states,
// so that the one with the focus keeps it.
function SidebarContent({ user, collapsed, toggle }: SidebarContentProps) {
  const path = usePath();
  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-2">
        <Tooltip text="Sentinel" placement="end" isDisabled={!collapsed}>
          <AriaLink
            href="/"
            aria-label={collapsed ? "Sentinel" : undefined}
            className={`flex h-10 items-center gap-2.5 rounded-md px-2.5 text-16 font-semibold ${FOCUS_RING}`}
          >
            <SentinelMark className="size-5" />
            {!collapsed && "Sentinel"}
          </AriaLink>
        </Tooltip>
      </div>
      <ul className="flex flex-col gap-0.5 px-2">
        {entriesOf(user).map((entry) => (
          <li key={entry.area}>
            <EntryLink
              entry={entry}
              current={isCurrent(entry, path)}
              collapsed={collapsed}
            />
          </li>
        ))}
      </ul>
      <div className="mt-auto flex pt-4 pb-2 pl-3">
        <IconButton
          label={toggle.label}
          icon={toggle.icon}
          size="medium"
          tooltipPlacement="end"
          onPress={toggle.onPress}
        />
      </div>
      <div className="border-t border-border p-2">
        <AccountMenu user={user} compact={collapsed} />
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
// wide enough (docs/behaviors.md, Preferences). Below that width it is always
// collapsed, and its expand button opens the expanded sidebar over the
// content, as a dialog that takes the focus. Escape, its close button, or a
// click outside it closes it and returns the focus to the expand button, and
// so does a new message, such as the failure of Sign out, so that the
// message shows. A navigation from it closes it, also to the URL that shows,
// and the focus follows the navigation (FocusAfterNavigation). Opening it
// changes no preference, and a window that grows past that width closes it,
// with the focus on the screen's heading.
export function Sidebar({ user, wide, expanded }: SidebarProps) {
  const href = useRouterState({ select: (state) => state.location.href });
  const message = useNewestMessage();
  const [openedAt, setOpenedAt] = useState<OpenedAt>();
  const open = !wide && openedAt?.href === href && openedAt.message === message;
  // Once closed, only the expand button opens it again: not a return to the
  // URL, nor the dismissal of the message, nor a window that narrows.
  if (openedAt !== undefined && !open) {
    setOpenedAt(undefined);
  }
  const close = () => {
    setOpenedAt(undefined);
  };

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
        <SidebarContent
          user={user}
          collapsed={!expanded}
          toggle={
            expanded
              ? {
                  label: "Collapse navigation",
                  icon: PanelLeftClose,
                  onPress: () => {
                    sidebarPreference.set("collapsed");
                  },
                }
              : {
                  label: "Expand navigation",
                  icon: PanelLeftOpen,
                  onPress: () => {
                    if (wide) {
                      sidebarPreference.set("expanded");
                    } else {
                      setOpenedAt({ href, message });
                    }
                  },
                }
          }
        />
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
                <SidebarContent
                  user={user}
                  collapsed={false}
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
