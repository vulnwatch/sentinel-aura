import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { fixedTopHeight, useFixedTopHeight } from "./fixed-top";
import { useFocusHeadingOnRemoval } from "./screen-heading";

// The layout of a detail screen with a side column (docs/design-system.md,
// Detail Screens; Main Content).

// The width of the main content, inside its space of 24 px, from which a
// detail screen shows its side column beside its parts, in rem, so that it
// follows the text size: 960 px at the default text size, so that the main
// column keeps at least 640 px beside the side column of 288 px, 32 px after
// it (docs/design-system.md, Spacing and Sizes, Breakpoint).
const TWO_COLUMNS_REM = 60;

// Whether the element, which takes the width of the main content inside its
// space, is wide enough for two columns, or undefined until it is measured.
// It follows the width of the window, the sidebar, and the text size while
// the screen is open, and is measured before the screen first shows.
export function useTwoColumns(
  element: RefObject<HTMLElement | null>,
): boolean | undefined {
  const [twoColumns, setTwoColumns] = useState<boolean>();
  useLayoutEffect(() => {
    const current = element.current;
    if (current === null) {
      return undefined;
    }
    const measure = () => {
      const rem = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      setTwoColumns(current.clientWidth >= TWO_COLUMNS_REM * rem);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(current);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [element]);
  return twoColumns;
}

interface Heights {
  // The height of the heading row with the tabs, and of the compact heading.
  full: number;
  compact: number;
}

interface DetailHeadingProps {
  // Whether the main content is wide enough for two columns, where the
  // heading row becomes the compact heading once it has scrolled to the top
  // of the window.
  sticky: boolean;
  // The heading row and the tabs, given whether they are compact.
  children: (compact: boolean) => ReactNode;
}

// The heading row of a detail screen with its tabs. While the main content
// is wide enough for two columns, it stays at the top of the window once it
// has scrolled there, below the message area, as the compact heading, on
// surface above a border line across the width of the main content, without
// a shadow, with 10 px of space above it (docs/design-system.md, Detail
// Screens). It is the heading row itself, not a copy, and its place in the
// page keeps the height of the heading row and the tabs, so that the content
// does not move when it becomes compact or returns. The window scrolls the
// element with the focus, and the target of an anchor, below it too
// (src/components/fixed-top.ts). Narrower, it scrolls with the page.
export function DetailHeading({ sticky, children }: DetailHeadingProps) {
  // An element at the place where the heading row starts, which shows
  // whether the row has reached the top of the window.
  const start = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLDivElement>(null);
  const [atTop, setAtTop] = useState(false);
  const [heights, setHeights] = useState<Heights>({ full: 0, compact: 0 });
  const compact = sticky && atTop;

  useLayoutEffect(() => {
    if (!sticky) {
      return undefined;
    }
    const update = () => {
      const top = start.current?.getBoundingClientRect().top ?? 0;
      setAtTop(top < fixedTopHeight("--message-area-height"));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sticky]);

  useLayoutEffect(() => {
    const element = heading.current;
    if (element === null) {
      return undefined;
    }
    const key = compact ? "compact" : "full";
    const record = () => {
      const height = element.offsetHeight;
      setHeights((current) =>
        current[key] === height ? current : { ...current, [key]: height },
      );
    };
    const observer = new ResizeObserver(record);
    observer.observe(element);
    record();
    return () => {
      observer.disconnect();
    };
  }, [compact]);
  // Its height counts as soon as it can stay at the top, so that the window
  // scrolls an element into view, such as the target of an anchor, below
  // the compact heading that the scroll itself brings.
  useFixedTopHeight("--compact-heading-height", heading, sticky);

  let className = "";
  if (compact) {
    className =
      "sticky top-[var(--message-area-height,0px)] z-10 -mx-6 border-b border-border bg-surface px-6 pt-2.5";
  } else if (sticky) {
    className = "sticky top-[var(--message-area-height,0px)] z-10";
  }
  return (
    <>
      <div ref={start} />
      <div
        ref={heading}
        className={className}
        // The margin keeps the height of the heading row and the tabs in the
        // page while the compact heading, which is shorter, takes their
        // place. A false positive: the style sets neither a color nor a type
        // size (docs/conventions.md, Checks).
        // oxlint-disable-next-line react/forbid-dom-props
        style={{
          marginBottom: compact ? heights.full - heights.compact : undefined,
        }}
      >
        {children(compact)}
      </div>
    </>
  );
}

interface PartProps {
  // The identifier of the part, which is also the target of its anchor in
  // the URL, such as "cve".
  id: string;
  // The level-two heading of the part.
  heading: ReactNode;
  // What follows the heading on its line, such as a link.
  besideHeading?: ReactNode;
  // The actions of the part, and its controls, such as the switch that shows
  // its hidden records, at the end of the line of the heading.
  actions?: ReactNode;
  children: ReactNode;
}

// A part of the record in the main column (docs/design-system.md, Detail
// Screens): a section on the background of the page, with its level-two
// heading in text-16, weight 600, its actions at the end of the line of the
// heading, and its content 16 px below the heading. The main column draws
// the line above each part but the first (MainColumn).
export function Part({
  id,
  heading,
  besideHeading,
  actions,
  children,
}: PartProps) {
  const headingId = sectionHeadingId(id);
  return (
    <section id={id} aria-labelledby={headingId} className="@container">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-16 font-semibold">
          {heading}
        </h2>
        {besideHeading}
        {actions !== undefined && (
          <div className="ms-auto flex items-center">{actions}</div>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// The identifier of the heading of a part or a section, by which an element
// of it, such as a group of users, is named.
export function sectionHeadingId(id: string): string {
  return `${id}-heading`;
}

interface SideSectionProps {
  // The identifier of the section, which is also the target of its anchor in
  // the URL, such as "details".
  id: string;
  // The text of its level-two heading.
  heading: string;
  // The actions of the section, at the end of the row of its heading.
  actions?: ReactNode;
  children: ReactNode;
}

// A section of the side column (docs/design-system.md, Detail Screens): its
// level-two heading in text-14, weight 600, in a row at least 32 px high
// with its actions at its end, and its content 10 px below. A section of the
// details of the record moves to its new place when the layout changes while
// the screen is open (DetailColumns); when the element with the focus is in
// a section that leaves the page, the focus moves to the screen's heading,
// which comes into view (docs/behaviors.md, Accessibility, Focus after an
// action).
export function SideSection({
  id,
  heading,
  actions,
  children,
}: SideSectionProps) {
  const ref = useRef<HTMLElement>(null);
  useFocusHeadingOnRemoval(ref);
  const headingId = sectionHeadingId(id);
  return (
    <section ref={ref} id={id} aria-labelledby={headingId}>
      <div className="flex min-h-8 flex-wrap items-center gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-14 font-semibold">
          {heading}
        </h2>
        {actions !== undefined && (
          <div className="ms-auto flex items-center">{actions}</div>
        )}
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

interface DetailColumnsProps {
  // Whether the main content is wide enough for two columns (useTwoColumns).
  twoColumns: boolean;
  // The sections of the side column that come before the parts in one
  // column, such as the details of the record.
  leadingSections: ReactNode;
  // The parts of the main column, each a Part.
  parts: ReactNode;
  // The sections of the side column that follow the parts in one column,
  // such as the sources of a CVE, each a SideSection, or none.
  trailingSections?: ReactNode;
}

// The class of the sections of the side column, which stand apart by a
// border line, 16 px below a section's content and 16 px above the next.
const SECTIONS = "divide-y divide-border *:py-4 *:first:pt-0 *:last:pb-0";

// The attribute that marks the side column while it sticks below what stays
// at the top of the window, with two columns.
const STICKY_SIDE_COLUMN = "data-sticky-side-column";

// The height of what stays at the top of the window, below which the window
// scrolls an element (src/components/fixed-top.ts).
function fixedTop(): number {
  return (
    fixedTopHeight("--message-area-height") +
    fixedTopHeight("--compact-heading-height")
  );
}

// The side column that sticks, with the columns that hold it.
interface StickyColumn {
  column: Element;
  columns: Element;
}

// The top of an element of the side column in the page once the side column
// has scrolled with the page to its own end, its bottom at the bottom of the
// columns. The side column stays at the top of its place until then, so the
// window shows there the end of a side column taller than it. A browser can
// scroll only by whole pixels, so a scroll that puts the element at the top
// rounds down, and one that puts it at the bottom rounds up, so that it shows
// whole.
function releasedTop(element: Element, { column, columns }: StickyColumn) {
  const box = column.getBoundingClientRect();
  return (
    columns.getBoundingClientRect().bottom +
    window.scrollY -
    box.height +
    (element.getBoundingClientRect().top - box.top)
  );
}

// While the side column sticks, its elements stay below what stays at the
// top of the window, and the window, which scrolls an element without
// moving it, cannot show one below the bottom of the window; once the side
// column scrolls with the page, toward its end, the window scrolls each of
// its elements as any other. So only an element below the bottom of the
// window needs the page to scroll further.

// Shows the target of an anchor of the page below what stays at the top of
// the window (docs/design-system.md, Main Content). When the start of a
// target of the side column still lies below the window, the page scrolls
// until it shows, which for the last sections of a side column taller than
// the window can be the end of the page (docs/design-system.md, Detail
// Screens).
export function showAnchorTarget(target: Element) {
  target.scrollIntoView();
  const column = target.closest(`[${STICKY_SIDE_COLUMN}]`);
  const columns = column?.parentElement;
  if (column === null || columns == null) {
    return;
  }
  if (target.getBoundingClientRect().top >= window.innerHeight) {
    window.scrollTo(
      0,
      Math.floor(releasedTop(target, { column, columns }) - fixedTop()),
    );
  }
}

// After an element of the side column takes keyboard focus,
// scrolls the page until it shows, its bottom at the bottom of the window,
// when it lies below the window (docs/behaviors.md, Accessibility,
// Keyboard).
function showFocused(element: Element, sticky: StickyColumn) {
  const box = element.getBoundingClientRect();
  if (box.bottom > window.innerHeight) {
    window.scrollTo(
      0,
      Math.ceil(releasedTop(element, sticky) + box.height - window.innerHeight),
    );
  }
}

// The parts of the record and the side column (docs/design-system.md, Detail
// Screens). With two columns, the main column, whose parts each stand below a
// border line but the first, 32 px below the content of the part before; then
// the side column, 288 px wide, 32 px after the main column and aligned with
// its top, with the leading sections and then the trailing ones. While the
// page scrolls, the side column stays at the top of its place, 24 px below
// what stays at the top of the window, until the end of the page comes into
// view, and then scrolls with the page to its own end. With one column, the
// leading sections, then a border line, 16 px below their content, and the
// parts, the heading of the first 24 px below the line; then, after a border
// line 32 px below the content of the last part, the trailing sections,
// 16 px below the line. The order of the page is the order on the screen in
// each layout (docs/design-system.md, Main Content): the leading sections
// move to their new place when the layout changes, while the main column and
// the trailing sections, whose place in that order is the same in both
// layouts, stay, with what they hold, such as the focus or a change in
// progress. With two columns, when an element of the side column that is out
// of view takes keyboard focus, the page scrolls until it shows
// (showFocused), once the window has scrolled it as any element with the
// focus.
export function DetailColumns({
  twoColumns,
  leadingSections,
  parts,
  trailingSections,
}: DetailColumnsProps) {
  const columnsRef = useRef<HTMLDivElement>(null);
  const sideColumn = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const columns = columnsRef.current;
    const column = sideColumn.current;
    if (!twoColumns || columns === null || column === null) {
      return undefined;
    }
    let frame = 0;
    // The element with the focus once the window has scrolled it, in the
    // next frame, unless the focus has left the side column meanwhile. Only
    // the focus from the keyboard, which the browser shows: a pointer
    // focuses the control that it presses where it is, and moving that
    // control away would end the press outside it, which cancels it.
    const onFocus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const element = document.activeElement;
        if (
          element !== null &&
          column.contains(element) &&
          element.matches(":focus-visible")
        ) {
          showFocused(element, { column, columns });
        }
      });
    };
    column.addEventListener("focusin", onFocus);
    return () => {
      column.removeEventListener("focusin", onFocus);
      cancelAnimationFrame(frame);
    };
  }, [twoColumns]);
  const trailing =
    trailingSections !== undefined &&
    trailingSections !== null &&
    trailingSections !== false;
  let side = "";
  if (twoColumns) {
    side = `sticky top-[calc(var(--fixed-top)_+_1.5rem)] w-72 shrink-0 ${SECTIONS}`;
  } else if (trailing) {
    side = `mt-8 border-t border-border pt-4 ${SECTIONS}`;
  }
  return (
    <div
      ref={columnsRef}
      className={twoColumns ? "flex items-start gap-8" : "flex flex-col"}
    >
      {!twoColumns && (
        <div className="border-b border-border pb-4">{leadingSections}</div>
      )}
      <div
        className={`min-w-0 flex-1 *:not-first:mt-8 *:not-first:border-t *:not-first:border-border *:not-first:pt-6 ${twoColumns ? "" : "pt-6"}`}
      >
        {parts}
      </div>
      {/* The same element in both layouts, and the trailing sections in the
          same place within it, so that they stay when the layout changes. */}
      <div
        ref={sideColumn}
        className={side}
        // STICKY_SIDE_COLUMN
        data-sticky-side-column={twoColumns ? "" : undefined}
      >
        {twoColumns && leadingSections}
        {trailingSections}
      </div>
    </div>
  );
}
