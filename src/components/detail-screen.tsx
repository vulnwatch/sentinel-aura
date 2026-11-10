import {
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
  // What follows the heading on its line, such as a link or the actions of
  // the part, at its end.
  besideHeading?: ReactNode;
  children: ReactNode;
}

// A part of the record in the main column (docs/design-system.md, Detail
// Screens): a section on the background of the page, with its level-two
// heading in text-16, weight 600, and its content 16 px below the heading.
// The main column draws the line above each part but the first (MainColumn).
export function Part({ id, heading, besideHeading, children }: PartProps) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} className="@container">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id={headingId} className="text-16 font-semibold">
          {heading}
        </h2>
        {besideHeading}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

interface SideSectionProps {
  // The identifier of the section, which is also the target of its anchor in
  // the URL, such as "details".
  id: string;
  // The text of its level-two heading.
  heading: string;
  children: ReactNode;
}

// A section of the side column (docs/design-system.md, Detail Screens): its
// level-two heading in text-14, weight 600, in a row at least 32 px high,
// and its content 10 px below. A section moves to its new place when the
// layout changes while the screen is open; when the element with the focus is
// in it, the focus moves to the screen's heading, which comes into view
// (docs/behaviors.md, Accessibility, Focus after an action).
export function SideSection({ id, heading, children }: SideSectionProps) {
  const ref = useRef<HTMLElement>(null);
  useFocusHeadingOnRemoval(ref);
  const headingId = `${id}-heading`;
  return (
    <section ref={ref} id={id} aria-labelledby={headingId}>
      <div className="flex min-h-8 items-center">
        <h2 id={headingId} className="text-14 font-semibold">
          {heading}
        </h2>
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
}

// The parts of the record and the side column (docs/design-system.md, Detail
// Screens). With two columns, the main column, whose parts each stand below a
// border line but the first, 32 px below the content of the part before; then
// the side column, 288 px wide, 32 px after the main column and aligned with
// its top, whose sections stand apart by a border line, 16 px below a
// section's content and 16 px above the next. While the page scrolls, the
// side column stays at the top of its place, 24 px below what stays at the
// top of the window, until the end of the page comes into view, and then
// scrolls with the page to its own end. With one column, the leading
// sections, then a border line, 16 px below their content, and the parts, the
// heading of the first 24 px below the line. The order of the page is the
// order on the screen in each layout (docs/design-system.md, Main Content):
// the leading sections move to their new place when the layout changes,
// while the main column stays.
export function DetailColumns({
  twoColumns,
  leadingSections,
  parts,
}: DetailColumnsProps) {
  return (
    <div className={twoColumns ? "flex items-start gap-8" : "flex flex-col"}>
      {!twoColumns && (
        <div className="border-b border-border pb-4">{leadingSections}</div>
      )}
      <div
        className={`min-w-0 flex-1 *:not-first:mt-8 *:not-first:border-t *:not-first:border-border *:not-first:pt-6 ${twoColumns ? "" : "pt-6"}`}
      >
        {parts}
      </div>
      {twoColumns && (
        <div className="sticky top-[calc(var(--fixed-top)_+_1.5rem)] w-72 shrink-0 divide-y divide-border *:py-4 *:first:pt-0 *:last:pb-0">
          {leadingSections}
        </div>
      )}
    </div>
  );
}
