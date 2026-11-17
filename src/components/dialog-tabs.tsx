import type { LucideIcon } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";
import {
  Tooltip as AriaTooltip,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TooltipTriggerStateContext,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

// The tabs of a dialog, which show one of several forms of the same change,
// such as the versions of a CVSS assessment (docs/design-system.md, Dialogs).

export interface DialogTab<T extends string> {
  id: T;
  label: string;
  // An icon after the label that marks the tab, such as the default CVSS
  // version: its name, which assistive technologies read in the name of the
  // tab, and what it means, which its tooltip shows on hover and keyboard
  // focus and assistive technologies read as the description of the tab.
  mark?: { icon: LucideIcon; name: string; text: string } | undefined;
}

interface DialogTabItemProps<T extends string> {
  tab: DialogTab<T>;
  // Whether the tab takes the focus as it shows.
  takesFocus: boolean;
}

// A tab: its label in text-14, fg-muted, 40 px high with 8 px of side
// padding; selected, in fg at weight 600 over a bar of 2 px in link along
// its bottom edge, as the tabs of a detail screen (docs/design-system.md,
// Detail Screens). Its mark follows its label 6 px later, at 14 px in
// fg-muted.
function DialogTabItem<T extends string>({
  tab,
  takesFocus,
}: DialogTabItemProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const noteId = useId();
  const { mark } = tab;
  // React Aria renders this component to build its collection and shows the
  // element of the tab apart from it, later, so the tab takes the focus as
  // that element shows, once.
  const focused = useRef(false);
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      ref.current = element;
      if (element !== null && takesFocus && !focused.current) {
        focused.current = true;
        element.focus();
      }
    },
    [takesFocus],
  );
  return (
    <Tab
      id={tab.id}
      ref={attach}
      onHoverChange={setHovered}
      aria-label={mark === undefined ? undefined : `${tab.label}, ${mark.name}`}
      aria-describedby={mark === undefined ? undefined : noteId}
      className={`-mb-px inline-flex h-10 cursor-default items-center gap-1.5 rounded-t border-b-2 border-transparent px-2 text-14 text-fg-muted data-hovered:text-fg data-selected:border-link data-selected:font-semibold data-selected:text-fg ${FOCUS_RING}`}
    >
      {({ isFocusVisible }) => (
        <>
          {tab.label}
          {mark !== undefined && (
            <>
              <mark.icon aria-hidden className="size-3.5 text-fg-muted" />
              <span id={noteId} hidden>
                {mark.text}
              </span>
              {/* The tooltip of the mark shows while the pointer rests on
                  the tab or the tab has keyboard focus: a tab takes no
                  tooltip trigger of its own. */}
              <TooltipTriggerStateContext
                value={{
                  isOpen: hovered || isFocusVisible,
                  shouldSkipAnimation: true,
                  open: () => {},
                  close: () => {
                    setHovered(false);
                  },
                }}
              >
                <AriaTooltip
                  triggerRef={ref}
                  placement="top"
                  offset={6}
                  className="max-w-72 rounded-md bg-fg px-2.5 py-1.5 text-13 font-medium text-surface shadow-lg"
                >
                  {mark.text}
                </AriaTooltip>
              </TooltipTriggerStateContext>
            </>
          )}
        </>
      )}
    </Tab>
  );
}

interface DialogTabsProps<T extends string> {
  // The accessible name of the tabs.
  label: string;
  tabs: readonly DialogTab<T>[];
  selected: T;
  onSelect: (id: T) => void;
  // Whether the selected tab takes the focus as the tabs show, as the first
  // control of a dialog (docs/behaviors.md, Accessibility, Dialogs).
  focusSelected?: boolean;
  // The content of the selected tab.
  children: ReactNode;
}

// The tabs at the top of the content of a dialog, in a row with a border line
// across its width, 16 px apart, and the content of the selected tab 20 px
// below the line. A tab opens when the user clicks it or presses Enter or
// Space, not when the arrow keys move the focus to it, as the tabs of a
// detail screen do.
export function DialogTabs<T extends string>({
  label,
  tabs,
  selected,
  onSelect,
  focusSelected = false,
  children,
}: DialogTabsProps<T>) {
  // The tab selected as the tabs show, which takes the focus.
  const [first] = useState(selected);
  return (
    <Tabs
      selectedKey={selected}
      onSelectionChange={(key) => {
        const tab = tabs.find((item) => item.id === key);
        if (tab !== undefined) {
          onSelect(tab.id);
        }
      }}
      keyboardActivation="manual"
    >
      <TabList
        aria-label={label}
        className="flex flex-wrap gap-x-4 border-b border-border"
      >
        {tabs.map((tab) => (
          <DialogTabItem
            key={tab.id}
            tab={tab}
            takesFocus={focusSelected && tab.id === first}
          />
        ))}
      </TabList>
      {tabs.map((tab) => (
        <TabPanel
          key={tab.id}
          id={tab.id}
          className={`mt-5 rounded ${FOCUS_RING}`}
        >
          {tab.id === selected && children}
        </TabPanel>
      ))}
    </Tabs>
  );
}
