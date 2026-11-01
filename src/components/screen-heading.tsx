import { useEffect } from "react";
import { FOCUS_RING } from "./focus-ring";

// The title of the entry document, which names the product, and the end of
// the title of every screen (docs/behaviors.md, Accessibility, Page title).
const PRODUCT_NAME = "Sentinel";

interface ScreenHeadingProps {
  children: string;
}

// The level-one heading of a screen (docs/design-system.md, Main Content),
// which also titles the page: the heading followed by "– Sentinel". The
// focus can move to it (focusScreenHeading).
export function ScreenHeading({ children }: ScreenHeadingProps) {
  useEffect(() => {
    document.title = `${children} – ${PRODUCT_NAME}`;
    return () => {
      document.title = PRODUCT_NAME;
    };
  }, [children]);
  return (
    <h1 tabIndex={-1} className={`text-20 font-semibold ${FOCUS_RING}`}>
      {children}
    </h1>
  );
}

// Moves the focus to the screen's heading, every screen's only level-one
// heading (docs/behaviors.md, Accessibility, Structure; Focus after an
// action).
export function focusScreenHeading() {
  document.querySelector<HTMLElement>("h1")?.focus();
}
