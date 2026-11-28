import { useLayoutEffect, type RefObject } from "react";

// The element that stays at the top of the window while the page scrolls:
// the compact heading of a detail screen (docs/design-system.md, Detail
// Screens). It gives its height to a custom property of the root element,
// from which the stylesheet takes the scroll padding of the page, so that the
// window scrolls the element with the focus, and the target of an anchor of
// the page, below it (docs/behaviors.md, Accessibility, Keyboard), and the
// offset of what sticks below it, such as the side column of a detail screen
// (src/styles.css). The message area, at the bottom of the window, gives the
// scroll padding at the bottom itself (src/components/message-area.tsx).
export type FixedTop = "--compact-heading-height";

// The height that the element gives to its custom property while it stays,
// or can stay, at the top of the window; otherwise the property is unset,
// which counts as no height.
export function useFixedTopHeight(
  property: FixedTop,
  element: RefObject<HTMLElement | null>,
  fixed: boolean,
) {
  useLayoutEffect(() => {
    const current = element.current;
    if (!fixed || current === null) {
      return undefined;
    }
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.setProperty(property, `${current.offsetHeight}px`);
    });
    observer.observe(current);
    // The height applies before the next paint, not only once the observer
    // first reports it.
    root.style.setProperty(property, `${current.offsetHeight}px`);
    return () => {
      observer.disconnect();
      root.style.removeProperty(property);
    };
  }, [property, element, fixed]);
}

// The height that the custom property gives now, in CSS pixels, or 0 while
// it is unset.
export function fixedTopHeight(property: FixedTop): number {
  const value = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue(property),
  );
  return Number.isNaN(value) ? 0 : value;
}
