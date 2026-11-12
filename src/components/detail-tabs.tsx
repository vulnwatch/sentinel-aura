import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { fixedTopHeight } from "./fixed-top";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
import type { ScreenHref } from "./router-links";

// The tabs of a detail screen, each at a path under the path of the screen
// (docs/design-system.md, Detail Screens; docs/screen-map.md, Areas and
// Screens).

export interface DetailTab {
  // The key of the tab among the tabs of the screen.
  id: string;
  label: string;
  // The address of the tab, which its URL keeps.
  href: ScreenHref;
}

interface DetailTabsProps {
  // The accessible name of the tabs.
  label: string;
  tabs: readonly DetailTab[];
  // Whether the tabs are in the compact heading, where they are 36 px high
  // and the line below them is that of the compact heading.
  compact: boolean;
}

// The row of the tabs, with a border line across its width: each tab a link
// to its address, its label in text-14, fg-muted, 40 px high with 8 px of
// side padding, 16 px apart; the selected tab in fg at weight 600, over a bar
// of 2 px in link along its bottom edge, on the line. Where their place is
// too narrow, the tabs wrap, and the line runs under their last row. A tab
// opens when the user clicks it or presses Enter or Space, not when the arrow
// keys move the focus to it, and the focus stays on it. The row shows no
// count.
export function DetailTabList({ label, tabs, compact }: DetailTabsProps) {
  return (
    <TabList
      aria-label={label}
      // The height of the tabs is set here: the tabs, items of a collection,
      // keep the classes with which they first rendered.
      className={`flex flex-wrap gap-x-4 ${compact ? "*:h-9" : "border-b border-border *:h-10"}`}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          id={tab.id}
          href={tab.href}
          // The page stays where it is; the panel that opens shows its start
          // (DetailTabPanel).
          routerOptions={{ resetScroll: false }}
          className={`-mb-px inline-flex cursor-default items-center rounded-t border-b-2 border-transparent px-2 text-14 text-fg-muted data-hovered:text-fg data-selected:border-link data-selected:font-semibold data-selected:text-fg ${FOCUS_RING}`}
        >
          {tab.label}
        </Tab>
      ))}
    </TabList>
  );
}

interface DetailTabsRootProps {
  // The key of the tab that shows.
  selected: string;
  // The heading of the screen with the tabs (DetailTabList), and the panel
  // of the tab that shows (DetailTabPanel), in that order.
  children: ReactNode;
}

// The tabs and their panel, which the tabs name. The tab that shows follows
// the URL, which a tab changes as a link does. They stand in a column whose
// margins add up rather than collapse, so that the margin with which the
// compact heading keeps its place adds to the space above the panel
// (src/components/detail-screen.tsx, DetailHeading).
export function DetailTabs({ selected, children }: DetailTabsRootProps) {
  return (
    <Tabs
      selectedKey={selected}
      keyboardActivation="manual"
      className="flex flex-col"
    >
      {children}
    </Tabs>
  );
}

interface DetailTabPanelProps {
  // The key of the tab that shows.
  selected: string;
  children: ReactNode;
}

// The panel of the tab that shows, 24 px below the line of the tabs: a panel
// of its own for each tab, which the tabs then name. A panel that a tab opens
// where the page had scrolled past its start shows its start, 24 px below
// the message area and the compact heading (docs/design-system.md, Detail
// Screens).
export function DetailTabPanel({ selected, children }: DetailTabPanelProps) {
  return (
    <ShownPanel key={selected} selected={selected}>
      {children}
    </ShownPanel>
  );
}

function ShownPanel({ selected, children }: DetailTabPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    if (panel === null) {
      return;
    }
    const fixed =
      fixedTopHeight("--message-area-height") +
      fixedTopHeight("--compact-heading-height");
    if (panel.getBoundingClientRect().top < fixed) {
      panel.scrollIntoView({ block: "start" });
    }
  }, []);
  return (
    <TabPanel
      ref={ref}
      id={selected}
      className={`mt-6 scroll-mt-6 ${INSIDE_FOCUS_RING}`}
    >
      {children}
    </TabPanel>
  );
}
