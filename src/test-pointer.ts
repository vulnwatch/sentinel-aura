import { page, type Locator } from "vitest/browser";

// Moves the pointer to a corner of the window that the element does not
// cover. Vitest runs several test files one after another in one page, so
// the pointer rests where an earlier test left it, and where it rests on the
// element, the element shows its colors under the pointer
// (docs/conventions.md, Tests). userEvent.unhover is no substitute: it moves
// the pointer to the center of the body, which the element can cover. React
// renders the end of React Aria's hover before the move returns, so the test
// reads the look at rest at once.
export async function pointerAwayFrom(element: Locator): Promise<void> {
  const box = element.element().getBoundingClientRect();
  const width = window.innerWidth;
  const height = window.innerHeight;
  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];
  const corner =
    corners.find(
      ({ x, y }) =>
        x < box.left || x >= box.right || y < box.top || y >= box.bottom,
    ) ?? corners[0]!;
  // The root element starts at the top left corner of the window unless the
  // page scrolls; force skips the check that the pointer reaches the root
  // element itself, since an element of the page lies over it.
  const root = document.documentElement.getBoundingClientRect();
  await page.elementLocator(document.documentElement).hover({
    position: { x: corner.x - root.left, y: corner.y - root.top },
    force: true,
  });
}
