import type { LucideIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Tooltip as AriaTooltip,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  TooltipTriggerStateContext,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { TOOLTIP_DELAY_MS } from "./tooltip";

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

// How long the tooltip of a mark stays after the pointer leaves the tab or
// the tooltip, so that the pointer can move from one to the other, as React
// Aria's tooltips do.
const MARK_CLOSE_DELAY_MS = 500;

interface MarkTooltipProps {
  triggerRef: RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  // Tells whether the pointer rests on the tooltip.
  onHoverChange: (hovered: boolean) => void;
  // Hides the tooltip, as Escape does.
  onDismiss: () => void;
  text: string;
}

// The tooltip of the mark of a tab, in the look of every tooltip
// (docs/design-system.md, Menus, Popovers, and Tooltips), which stays while
// the pointer rests on it, and which Escape hides without closing the dialog
// (WCAG 2.2, 1.4.13 Content on Hover or Focus). A tab takes no tooltip
// trigger of its own, so the tab tells when it shows.
function MarkTooltip({
  triggerRef,
  isOpen,
  onHoverChange,
  onDismiss,
  text,
}: MarkTooltipProps) {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [isOpen, onDismiss]);
  return (
    <TooltipTriggerStateContext
      // React Aria's tooltip opens and closes itself as the pointer enters
      // and leaves it; the tab decides instead.
      value={{
        isOpen,
        shouldSkipAnimation: true,
        open: () => {},
        close: () => {},
      }}
    >
      <AriaTooltip
        triggerRef={triggerRef}
        placement="top"
        offset={6}
        className="max-w-72 rounded-md bg-fg text-13 font-medium text-surface shadow-lg"
      >
        <span
          className="block px-2.5 py-1.5"
          onPointerEnter={() => {
            onHoverChange(true);
          }}
          onPointerLeave={() => {
            onHoverChange(false);
          }}
        >
          {text}
        </span>
      </AriaTooltip>
    </TooltipTriggerStateContext>
  );
}

interface DialogTabItemProps<T extends string> {
  tab: DialogTab<T>;
}

// A tab: its label in text-14, fg-muted, 40 px high with 8 px of side
// padding; selected, in fg at weight 600 over a bar of 2 px in link along
// its bottom edge, as the tabs of a detail screen (docs/design-system.md,
// Detail Screens). Its mark follows its label 6 px later, at 14 px in
// fg-muted, with its tooltip 300 ms after the pointer comes to rest on the
// tab, while it rests on the tab or on the tooltip, and for 500 ms after it
// leaves them, or while the tab has keyboard focus, until Escape hides it.
function DialogTabItem<T extends string>({ tab }: DialogTabItemProps<T>) {
  const ref = useRef<HTMLDivElement>(null);
  const [pointed, setPointed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timer = useRef<number>(undefined);
  const noteId = useId();
  const { mark } = tab;
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
    },
    [],
  );
  // Where the pointer rests: on the tab, which shows the tooltip after the
  // delay of every tooltip, or on the tooltip, which keeps it. React Aria
  // ends the hover of the tab as the pointer moves onto the tooltip, outside
  // the tab, after the tooltip has told that the pointer rests on it, so each
  // keeps its own state, and the tooltip hides once the pointer has left
  // both.
  const over = useRef({ tab: false, tooltip: false });
  const point = useCallback((part: "tab" | "tooltip", hovered: boolean) => {
    over.current = { ...over.current, [part]: hovered };
    window.clearTimeout(timer.current);
    if (hovered) {
      if (part === "tooltip") {
        setPointed(true);
      } else {
        timer.current = window.setTimeout(() => {
          setPointed(true);
        }, TOOLTIP_DELAY_MS);
      }
    } else if (!over.current.tab && !over.current.tooltip) {
      timer.current = window.setTimeout(() => {
        setPointed(false);
        setDismissed(false);
      }, MARK_CLOSE_DELAY_MS);
    }
  }, []);
  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);
  return (
    <Tab
      id={tab.id}
      ref={ref}
      onHoverChange={(hovered) => {
        point("tab", hovered);
      }}
      onFocusChange={(focused) => {
        if (!focused) {
          setDismissed(false);
        }
      }}
      aria-label={mark === undefined ? undefined : `${tab.label}, ${mark.name}`}
      aria-describedby={mark === undefined ? undefined : noteId}
      className={`-mb-px inline-flex h-10 cursor-default items-center gap-1.5 rounded-t border-b-2 border-transparent px-2 text-14 text-fg-muted data-hovered:text-fg data-selected:border-link data-selected:font-semibold data-selected:text-fg ${FOCUS_RING}`}
    >
      {({ isFocusVisible, isSelected }) => (
        <>
          {tab.label}
          {mark !== undefined && (
            <>
              <mark.icon aria-hidden className="size-3.5 text-fg-muted" />
              <span id={noteId} hidden>
                {mark.text}
              </span>
              {/* Placed again as the tab is selected or not, since the
                  content of the dialog, and with it the place of the tab,
                  changes then. */}
              <MarkTooltip
                key={String(isSelected)}
                triggerRef={ref}
                isOpen={!dismissed && (pointed || isFocusVisible)}
                onHoverChange={(hovered) => {
                  point("tooltip", hovered);
                }}
                onDismiss={dismiss}
                text={mark.text}
              />
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
  children,
}: DialogTabsProps<T>) {
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
          <DialogTabItem key={tab.id} tab={tab} />
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
