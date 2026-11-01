import {
  useEffect,
  useLayoutEffect,
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

// When the element leaves the page while it holds the focus, such as Try
// again after it was pressed, or the screen's heading when an error replaces
// the screen, the focus moves to the screen's heading once the screen shows
// what replaces the element (docs/behaviors.md, Accessibility, Focus after an
// action), with or without an action of the user.
export function useFocusHeadingOnRemoval(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      if (element?.contains(document.activeElement)) {
        queueMicrotask(focusScreenHeading);
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
}

// The level-one heading of a screen (docs/design-system.md, Main Content),
// which also titles the page: the heading followed by "– Sentinel". The
// focus can move to it (focusScreenHeading), and passes to the heading that
// replaces it.
export function ScreenHeading({ children }: ScreenHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useFocusHeadingOnRemoval(ref);
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
      className={`text-20 font-semibold ${FOCUS_RING}`}
    >
      {children}
    </h1>
  );
}
