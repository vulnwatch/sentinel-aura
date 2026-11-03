import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components";
import { FOCUS_RING, INSIDE_FOCUS_RING } from "./focus-ring";
import type { ScreenHref } from "./router-links";
import { focusScreenHeading } from "./screen-heading";

// The views of a list as tabs (docs/design-system.md, Lists;
// docs/screen-map.md, Ticket List Views).

const COUNT = new Intl.NumberFormat("en-US");

interface CountProps {
  // The number, or undefined while it loads.
  value: number | undefined;
  // Whether its read failed, even after it showed a number.
  failed: boolean;
}

// The count of a view, in fg-muted with tabular figures, its thousands
// grouped (docs/behaviors.md, Style): nothing while it loads, so that the
// label of the view shows alone, and an en dash, read as "Not available",
// when its read failed (docs/behaviors.md, Where Errors Appear;
// docs/design-system.md, Other Values).
export function Count({ value, failed }: CountProps) {
  if (failed) {
    return (
      <span className="text-fg-muted">
        <span aria-hidden>–</span>
        <span className="sr-only">Not available</span>
      </span>
    );
  }
  if (value === undefined) {
    return null;
  }
  return (
    <span className="text-fg-muted tabular-nums">{COUNT.format(value)}</span>
  );
}

export interface View {
  // The key of the view among the views of the list.
  id: string;
  // The label of its tab.
  label: string;
  // The address of the list in the view, which its URL keeps
  // (docs/screen-map.md, Browser History).
  href: ScreenHref;
  // Its count, which follows the label, such as Count.
  count: ReactNode;
}

interface TabLabelProps {
  children: ReactNode;
}

// The label of a tab. When the tab leaves the page while it holds the
// focus, because a read replaced what the screen shows, such as a view that
// a role decides after the role was removed, the focus moves to the screen's
// heading (docs/behaviors.md, Accessibility, Focus after an action).
function TabLabel({ children }: TabLabelProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const tab = ref.current?.closest('[role="tab"]');
    return () => {
      if (tab !== null && tab !== undefined && tab === document.activeElement) {
        queueMicrotask(focusScreenHeading);
      }
    };
  }, []);
  return <span ref={ref}>{children}</span>;
}

interface ViewTabsProps {
  // The accessible name of the tabs.
  label: string;
  views: readonly View[];
  // The key of the view that shows.
  selected: string;
  // What the view that shows shows, its panel.
  children: ReactNode;
}

// The views of a list as tabs, each a link to the address of its view: 32 px
// high with a border line and a 6 px radius, in text-14, each its label
// followed by its count; the selected tab has a border-strong boundary, the
// neutral-soft background, and its label at weight 600. A tab opens when the
// user clicks it or presses Enter or Space, not when the arrow keys move the
// focus to it, so that the arrow keys read the tabs without opening each
// view. The panel of the selected view follows the tabs, 16 px below.
export function ViewTabs({ label, views, selected, children }: ViewTabsProps) {
  // The view whose tab holds the focus, and how many times a tab left the
  // page while it held it, such as a view that a role decides after the role
  // was removed. The tabs then start again, so that they do not move the
  // focus to another tab while TabLabel moves it to the screen's heading;
  // every other change of the views keeps them, and the focus where it is.
  const [focused, setFocused] = useState<string>();
  const [left, setLeft] = useState(0);
  if (focused !== undefined && !views.some((view) => view.id === focused)) {
    setFocused(undefined);
    setLeft(left + 1);
  }
  return (
    <Tabs key={left} selectedKey={selected} keyboardActivation="manual">
      <TabList aria-label={label} className="flex flex-wrap gap-2">
        {views.map((view) => (
          <Tab
            key={view.id}
            id={view.id}
            href={view.href}
            onFocusChange={(isFocused) => {
              if (isFocused) {
                setFocused(view.id);
              } else {
                setFocused((current) =>
                  current === view.id ? undefined : current,
                );
              }
            }}
            className={`inline-flex h-8 cursor-default items-center rounded-md border border-border px-3 text-14 text-fg data-hovered:bg-surface-hover data-selected:border-border-strong data-selected:bg-neutral-soft data-selected:font-semibold ${FOCUS_RING}`}
          >
            <TabLabel>
              {view.label} {view.count}
            </TabLabel>
          </Tab>
        ))}
      </TabList>
      {/* A panel of its own for each view, which the tabs then name, rather
          than one panel whose view changes. */}
      <TabPanel
        key={selected}
        id={selected}
        className={`mt-4 ${INSIDE_FOCUS_RING}`}
      >
        {children}
      </TabPanel>
    </Tabs>
  );
}
