import { useRef, type ReactNode } from "react";
import { Link as AriaLink } from "react-aria-components";
import type { CurrentUserData } from "../api/generated/model";
import { sidebarPreference, usePreference } from "../preferences";
import { FOCUS_RING } from "./focus-ring";
import { MessageArea, MessageAreaProvider } from "./message-area";
import { Sidebar, useWideWindow } from "./sidebar";

interface AppFrameProps {
  // The signed-in user.
  user: CurrentUserData;
  // The screen.
  children: ReactNode;
}

// The frame of every screen with a signed-in user (docs/screen-map.md,
// Sidebar; docs/design-system.md, Page Layout): the link that skips to the
// main content, which is the first element that takes the focus and shows
// only while it has it, at the top left of the window over the sidebar, as a
// primary button; the sidebar; and the main content beside it, on canvas,
// with 24 px of space at its top and sides, which starts with the message
// area (docs/behaviors.md, Accessibility, Structure).
export function AppFrame({ user, children }: AppFrameProps) {
  const wide = useWideWindow();
  const preference = usePreference(sidebarPreference);
  const expanded = wide && preference === "expanded";
  const main = useRef<HTMLElement>(null);
  return (
    <MessageAreaProvider>
      <AriaLink
        onPress={() => {
          main.current?.focus();
        }}
        className={`fixed top-2 left-2 z-40 inline-flex h-9 items-center rounded-md bg-accent px-3 text-15 font-medium text-on-accent not-focus:sr-only data-hovered:bg-accent-hover ${FOCUS_RING}`}
      >
        Skip to main content
      </AriaLink>
      <Sidebar user={user} wide={wide} expanded={expanded} />
      <main
        ref={main}
        tabIndex={-1}
        className={`min-h-dvh p-6 outline-none ${expanded ? "ml-54" : "ml-14"}`}
      >
        <MessageArea />
        {children}
      </main>
    </MessageAreaProvider>
  );
}
