import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  use,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { FOCUS_RING } from "./focus-ring";

// The title of the entry document, which names the product, and the end of
// the title of every screen (docs/behaviors.md, Accessibility, Page title).
const PRODUCT_NAME = "Sentinel";

// Moves the focus to the screen's heading, every screen's only level-one
// heading (docs/behaviors.md, Accessibility, Structure; Focus after an
// action).
export function focusScreenHeading() {
  document.querySelector<HTMLElement>("h1")?.focus();
}

// What a screen's heading tells the root of the screens and asks it
// (FocusAfterNavigation).
interface NavigationFocus {
  // Tells that a screen shows, at the path to which the router leads.
  screenShown: () => void;
  // Whether the heading that appears takes the focus, because the screen
  // changed while it showed no heading yet. Only the first heading that asks
  // takes it.
  takesFocus: () => boolean;
}

const NavigationFocusContext = createContext<NavigationFocus | null>(null);

interface FocusAfterNavigationProps {
  children: ReactNode;
}

// When the screen changes, the focus moves to its heading (docs/behaviors.md,
// Accessibility, Focus after a navigation). The screen is the path of the
// URL that the router has shown: another search of the same screen, such as
// another page of a list, leaves the focus where it was. So does a screen
// that follows a path at which no screen showed, as the page loads, where the
// browser starts the focus at the top of the page, also when the UI leads at
// once from the URL that the page loaded to Sign in. A tab of a detail
// screen that opens its path keeps the focus, as the screen keeps its
// heading (docs/design-system.md, Detail Screens).
export function FocusAfterNavigation({ children }: FocusAfterNavigationProps) {
  const router = useRouter();
  // The paths at which a screen has shown its heading since the router last
  // showed a path, the one that it shows included.
  const shownPaths = useRef(new Set<string>());
  const awaitsHeading = useRef(false);
  const path = useRouterState({
    select: (state) => state.resolvedLocation?.pathname,
  });
  const previousPath = useRef(path);
  useLayoutEffect(() => {
    const previous = previousPath.current;
    if (path === undefined || path === previous) {
      return;
    }
    previousPath.current = path;
    const screenShown =
      previous !== undefined && shownPaths.current.has(previous);
    const active = document.activeElement;
    if (
      screenShown &&
      active instanceof HTMLElement &&
      active.getAttribute("role") === "tab"
    ) {
      shownPaths.current = new Set([path]);
      return;
    }
    shownPaths.current = new Set(shownPaths.current.has(path) ? [path] : []);
    if (!screenShown) {
      return;
    }
    const heading = document.querySelector<HTMLElement>("h1");
    awaitsHeading.current = heading === null;
    heading?.focus();
  }, [path]);
  const focus = useMemo<NavigationFocus>(
    () => ({
      // The router shows the screen of a path before it records that it has
      // shown the path, so the screen counts for the path to which it leads.
      screenShown: () => {
        shownPaths.current.add(router.state.location.pathname);
      },
      takesFocus: () => {
        const takes = awaitsHeading.current;
        awaitsHeading.current = false;
        return takes;
      },
    }),
    [router],
  );
  return (
    <NavigationFocusContext value={focus}>{children}</NavigationFocusContext>
  );
}

// When the element leaves the page while it holds the focus, such as Try
// again after it was pressed, or the screen's heading when an error replaces
// the screen, the focus moves to the screen's heading once the screen shows
// what replaces the element (docs/behaviors.md, Accessibility, Focus after an
// action), with or without an action of the user. Inside an open dialog,
// which keeps the rest of the page out of reach, it moves to the dialog
// itself instead; when the dialog leaves the page with the element, as it
// closes, the dialog decides where the focus returns.
export function useFocusHeadingOnRemoval(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    const dialog = element?.closest<HTMLElement>('[role="dialog"]') ?? null;
    return () => {
      if (element?.contains(document.activeElement)) {
        queueMicrotask(() => {
          if (dialog === null) {
            focusScreenHeading();
          } else if (dialog.isConnected) {
            dialog.focus({ preventScroll: true });
          }
        });
      }
    };
  }, [ref]);
}

interface FocusHandOffProps {
  children: ReactNode;
}

// Content that a read can replace without an action of the user, such as
// data that a 403 replaces: when it leaves the page while it holds the
// focus, the focus moves to the screen's heading (useFocusHeadingOnRemoval).
// It adds no box of its own to the layout.
export function FocusHandOff({ children }: FocusHandOffProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusHeadingOnRemoval(ref);
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}

interface ScreenHeadingProps {
  children: string;
  // Whether the heading is in the compact heading of a detail screen, in
  // text-16 (docs/design-system.md, Detail Screens).
  compact?: boolean;
}

// The level-one heading of a screen (docs/design-system.md, Main Content),
// in text-20, which also titles the page: the heading followed by "–
// Sentinel". The focus can move to it (focusScreenHeading), and passes to the
// heading that replaces it. It takes the focus as it appears when the screen
// changed before it (FocusAfterNavigation).
export function ScreenHeading({
  children,
  compact = false,
}: ScreenHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useFocusHeadingOnRemoval(ref);
  const focus = use(NavigationFocusContext);
  useLayoutEffect(() => {
    focus?.screenShown();
    if (focus?.takesFocus() === true) {
      ref.current?.focus();
    }
  }, [focus]);
  useEffect(() => {
    document.title = `${children} – ${PRODUCT_NAME}`;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, [children]);
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className={`${compact ? "text-16" : "text-20"} font-semibold ${FOCUS_RING}`}
    >
      {children}
    </h1>
  );
}
