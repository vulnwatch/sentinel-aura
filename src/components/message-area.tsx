import {
  useRouter,
  useRouterState,
  type ParsedLocation,
} from "@tanstack/react-router";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { Announcement, withReference } from "./announcer";
import { Link } from "./link";
import { Message, type MessageTone } from "./message";
import { screenOptions, type ScreenHref } from "./router-links";
import { focusScreenHeading } from "./screen-heading";

// The message area over the content, which every screen with the sidebar
// shares (docs/behaviors.md, Outcome of a Change;
// docs/design-system.md, Main Content; Messages).

// The record that the outcome of a change concerns: its name, such as
// SNTL-42, and the address of its screen.
export interface MessageRecord {
  name: string;
  href: ScreenHref;
}

// A message to show in the message area.
export interface AreaMessage {
  tone: MessageTone;
  text: string;
  // The request identifier of an error.
  reference?: string | undefined;
  // The record of the outcome of a change, which the message names when it
  // appears on a screen other than the record's own.
  record?: MessageRecord | undefined;
  // Whether a success or an info message goes on its own, 10 seconds after
  // it appears, since it confirms what the user did on the screen where the
  // user is, or tells what the screen then shows. Every other message stays
  // until the user dismisses it or opens another screen, so a caller that
  // does not say so keeps its message: a warning or a danger message, the
  // outcome of a change that ended while the user was on another screen or
  // tab, the outcome shown because the read after it failed, and a message
  // that its screen document states stays (docs/behaviors.md, Outcome of a
  // Change).
  goesOnItsOwn?: boolean | undefined;
}

// The time after which a message that goes on its own goes, while its
// countdown does not wait: the duration of the animation of its line of the
// time left too (src/styles.css, --animate-countdown).
export const MESSAGE_TIMEOUT_MS = 10_000;

interface ShownMessage extends AreaMessage {
  id: number;
  // The screen on which the message appeared (screenOf): it goes when the
  // user opens another screen, not when another tab of the same screen opens.
  screen: string;
}

// A path without its trailing slashes, as a route matches it.
function withoutTrailingSlash(path: string): string {
  return path.replace(/\/+$/, "");
}

// The screen at a location, which tells one screen from another: the path of
// the route of the screen, under which the routes of its tabs are, such as
// /tickets/SNTL-12 for each tab of that Ticket (docs/screen-map.md, Areas and
// Screens; docs/design-system.md, Detail Screens), whatever the search
// parameters. A path that no route matches whole, such as an unknown tab of a
// Ticket or a path beyond a tab, shows Not found, a screen of its own at that
// path (src/router.ts).
function screenOf(
  router: ReturnType<typeof useRouter>,
  location: ParsedLocation,
): string {
  const matches = router.matchRoutes(location);
  const leaf = matches.at(-1);
  const screen = matches[1];
  return leaf !== undefined &&
    screen !== undefined &&
    withoutTrailingSlash(leaf.pathname) ===
      withoutTrailingSlash(location.pathname)
    ? screen.pathname
    : location.pathname;
}

// Whether the path is that of the screen of the record, or of one of its
// tabs, at paths under it.
function onScreenOf(path: string, screen: string): boolean {
  return path === screen || path.startsWith(`${screen}/`);
}

interface MessageAreaState {
  messages: readonly ShownMessage[];
  show: (message: AreaMessage) => void;
  dismiss: (id: number) => void;
  // Removes the messages of every screen other than the one given
  // (screenOf).
  keepScreen: (screen: string) => void;
}

const MessageAreaContext = createContext<MessageAreaState | null>(null);

interface MessageAreaProviderProps {
  children: ReactNode;
}

// Holds the messages of the message area for the screens inside it.
export function MessageAreaProvider({ children }: MessageAreaProviderProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<readonly ShownMessage[]>([]);
  const nextId = useRef(0);

  // A message appears on the screen that the user is on when it is shown,
  // also for a change that ends after the user left its screen, and then
  // names the record that it concerns, with a link to it.
  const show = useCallback(
    (message: AreaMessage) => {
      nextId.current += 1;
      const { location } = router.state;
      const path = location.pathname;
      const { record } = message;
      const shown = {
        ...message,
        record:
          record !== undefined &&
          !onScreenOf(
            path,
            router.buildLocation(screenOptions(record.href)).pathname,
          )
            ? record
            : undefined,
        id: nextId.current,
        screen: screenOf(router, location),
      };
      setMessages((current) => [shown, ...current]);
    },
    [router],
  );
  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);
  const keepScreen = useCallback((screen: string) => {
    setMessages((current) =>
      current.filter((message) => message.screen === screen),
    );
  }, []);

  const state = useMemo(
    () => ({ messages, show, dismiss, keepScreen }),
    [messages, show, dismiss, keepScreen],
  );
  return <MessageAreaContext value={state}>{children}</MessageAreaContext>;
}

function useMessageAreaState(): MessageAreaState {
  const state = use(MessageAreaContext);
  if (state === null) {
    throw new Error("The message area is used outside its provider");
  }
  return state;
}

// The identifier of the newest message of the area, which changes when a
// message appears, or undefined without one.
export function useNewestMessage(): number | undefined {
  return useMessageAreaState().messages[0]?.id;
}

// Shows a message in the message area of the screen.
export function useShowMessage(): (message: AreaMessage) => void {
  return useMessageAreaState().show;
}

// Whether the message goes on its own (AreaMessage).
function goesOnItsOwn(message: AreaMessage): boolean {
  return (
    message.goesOnItsOwn === true &&
    (message.tone === "success" || message.tone === "info")
  );
}

// Runs the countdown of a message that goes on its own while it does not
// wait, and then removes the message; once the wait ends, the countdown goes
// on from where it stopped (docs/behaviors.md, Outcome of a Change).
function useCountdown(active: boolean, waits: boolean, end: () => void) {
  const left = useRef(MESSAGE_TIMEOUT_MS);
  const ended = useRef(end);
  useLayoutEffect(() => {
    ended.current = end;
  }, [end]);
  useEffect(() => {
    if (!active || waits) {
      return undefined;
    }
    const started = Date.now();
    const timer = setTimeout(() => {
      ended.current();
    }, left.current);
    return () => {
      clearTimeout(timer);
      left.current -= Date.now() - started;
    };
  }, [active, waits]);
}

interface DismissibleMessageProps {
  message: ShownMessage;
  // Whether the countdown of the message waits.
  waits: boolean;
  onDismiss: (id: number) => void;
  // The message and its Dismiss, as they enter and leave the page.
  elements: Map<number, MessageElements>;
}

// The message itself and its Dismiss, which the focus can reach.
interface MessageElements {
  message: RefObject<HTMLDivElement | null>;
  dismiss: RefObject<HTMLButtonElement | null>;
}

// A message of the area, which ends with Dismiss, and starts with the record
// that it concerns, as a link to its screen, followed by a colon, when it
// names one, such as "SNTL-42: Priority changed to P2.". The announcer of the
// page announces its words as it appears (src/components/announcer.tsx). A
// success or an info message that goes on its own shows its line of the time
// left, which stops while the countdown waits, and goes once it has run out.
// It can take the focus itself, after F6.
function DismissibleMessage({
  message,
  waits,
  onDismiss,
  elements,
}: DismissibleMessageProps) {
  const goes = goesOnItsOwn(message);
  const dismiss = useCallback(() => {
    onDismiss(message.id);
  }, [onDismiss, message.id]);
  useCountdown(goes, waits, dismiss);
  const messageRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    elements.set(message.id, { message: messageRef, dismiss: dismissRef });
    return () => {
      elements.delete(message.id);
    };
  }, [elements, message.id]);
  const words =
    message.record === undefined
      ? message.text
      : `${message.record.name}: ${message.text}`;
  return (
    <div className="pointer-events-auto">
      <Announcement id={message.id}>
        {withReference(words, message.reference)}
      </Announcement>
      <Message
        ref={messageRef}
        dismissRef={dismissRef}
        floating
        focusable
        countdown={goes ? { paused: waits } : undefined}
        tone={message.tone}
        reference={message.reference}
        onDismiss={dismiss}
      >
        {message.record !== undefined && (
          <>
            <Link placement="message" href={message.record.href}>
              {message.record.name}
            </Link>
            :{" "}
          </>
        )}
        {message.text}
      </Message>
    </div>
  );
}

interface MessageAreaProps {
  // Whether the sidebar beside the main content is expanded, from which the
  // area starts 24 px after it.
  expanded: boolean;
}

// Whether the tab is hidden, as when the user is on another tab of the
// browser.
function useHiddenTab(): boolean {
  return useSyncExternalStore(
    (changed) => {
      document.addEventListener("visibilitychange", changed);
      return () => {
        document.removeEventListener("visibilitychange", changed);
      };
    },
    () => document.hidden,
  );
}

// Whether a popover, a menu, or a dialog, the sidebar opened over the content
// included, keeps the area out of reach, as it keeps the rest of the page:
// React Aria hides from assistive technologies, or makes inert, what lies
// outside an open modal overlay, the area with the content.
function outOfReach(element: Element): boolean {
  return element.closest('[aria-hidden="true"], [inert]') !== null;
}

function useOutOfReach(
  area: RefObject<HTMLElement | null>,
  shown: boolean,
): boolean {
  const [hidden, setHidden] = useState(false);
  useLayoutEffect(() => {
    const current = area.current;
    if (!shown || current === null) {
      return undefined;
    }
    const check = () => {
      setHidden(outOfReach(current));
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-hidden", "inert"],
    });
    check();
    return () => {
      observer.disconnect();
    };
  }, [area, shown]);
  return shown && hidden;
}

// The time after an input of the user, a key or a press of the pointer,
// within which the focus that moves follows that input; a focus that moves
// later, such as back to the button of a menu once its change has failed, is
// moved by the UI. And the time before a message appears within which the UI
// has moved the focus as the message appears.
const INPUT_FOCUS_MS = 100;
const FOCUS_AS_MESSAGE_APPEARS_MS = 1000;

// Gives the page the height that the area takes from the bottom of the
// window, with the 24 px below it, as its scroll padding at the bottom
// (src/styles.css), and returns it.
function recordAreaHeight(area: HTMLElement): number {
  const height = window.innerHeight - area.getBoundingClientRect().top;
  document.documentElement.style.setProperty(
    "--message-area-height",
    `${height}px`,
  );
  return height;
}

// Whether the boxes of two elements overlap.
function overlaps(element: Element, other: Element): boolean {
  const a = element.getBoundingClientRect();
  const b = other.getBoundingClientRect();
  return (
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  );
}

// Keeps the element of the content that holds keyboard focus clear of the
// area (docs/design-system.md, Main Content; docs/behaviors.md,
// Accessibility, Keyboard). The window scrolls an element that the keyboard
// focuses above the area by its scroll padding at the bottom
// (src/styles.css), but not one that the UI focuses without scrolling, as
// React Aria does as it returns the focus to the button of a menu: once the
// focus has moved, that element scrolls above the area when it lies under
// it. A focus that the UI moved as a message appears takes its element once
// the message shows, so that the element does not lie under it, while a
// message that appears over the element that the focus already had, which
// the user or the UI moved there earlier, leaves it there. Only the focus
// that the browser shows counts, and not the one that follows a press of
// the pointer, which focuses the control that it presses where it is, also
// a field, whose focus the browser shows.
function useFocusClearOfArea(
  area: RefObject<HTMLElement | null>,
  newest: number | undefined,
  room: number,
) {
  // The instants of the last input of the user, of the last press of the
  // pointer, and of the last focus that the UI moved, on the clock of the
  // events.
  const inputAt = useRef(Number.NEGATIVE_INFINITY);
  const pressedAt = useRef(Number.NEGATIVE_INFINITY);
  const movedAt = useRef(Number.NEGATIVE_INFINITY);

  const clear = useCallback(() => {
    const current = area.current;
    const element = document.activeElement;
    const main = current?.closest("main");
    if (
      current == null ||
      main == null ||
      outOfReach(current) ||
      !(element instanceof HTMLElement) ||
      !main.contains(element) ||
      current.contains(element) ||
      !element.matches(":focus-visible") ||
      !overlaps(element, current)
    ) {
      return;
    }
    // The scroll padding follows the area as it shows now, also when a
    // message has just appeared in it.
    recordAreaHeight(current);
    element.scrollIntoView({ block: "nearest" });
  }, [area]);

  useEffect(() => {
    const onInput = (event: Event) => {
      inputAt.current = event.timeStamp;
    };
    const onPress = (event: Event) => {
      inputAt.current = event.timeStamp;
      pressedAt.current = event.timeStamp;
    };
    let frame = 0;
    const onFocusIn = (event: FocusEvent) => {
      if (event.timeStamp - inputAt.current > INPUT_FOCUS_MS) {
        movedAt.current = event.timeStamp;
      }
      cancelAnimationFrame(frame);
      if (event.timeStamp - pressedAt.current <= INPUT_FOCUS_MS) {
        return;
      }
      frame = requestAnimationFrame(clear);
    };
    document.addEventListener("keydown", onInput, true);
    document.addEventListener("pointerdown", onPress, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onInput, true);
      document.removeEventListener("pointerdown", onPress, true);
      document.removeEventListener("focusin", onFocusIn, true);
      cancelAnimationFrame(frame);
    };
  }, [clear]);

  // Whether the UI moved the focus just before, without an input of the
  // user since.
  const movedJustBefore = useCallback(
    () =>
      performance.now() - movedAt.current < FOCUS_AS_MESSAGE_APPEARS_MS &&
      movedAt.current > inputAt.current,
    [],
  );

  // A message appeared, newer than the one before: the focus that the UI
  // moved just before takes its element, once the area and its scroll
  // padding show.
  const newestBefore = useRef(newest);
  useLayoutEffect(() => {
    // Identifiers grow with each message, so another newest one that is
    // lower is an older one that the newest left on its going.
    const appeared =
      newest !== undefined && newest > (newestBefore.current ?? 0);
    newestBefore.current = newest;
    if (appeared && movedJustBefore()) {
      clear();
    }
  }, [newest, clear, movedJustBefore]);

  // The room at the end of the content has grown with the area, after a
  // message appeared in it: an element at the end of the content can now
  // scroll above the area, which the page could not do before.
  useLayoutEffect(() => {
    if (room > 0 && movedJustBefore()) {
      clear();
    }
  }, [room, clear, movedJustBefore]);
}

// The message area: the messages of the screen, newest first, 8 px apart,
// floating over the content at the bottom of the window, 24 px above its
// bottom and 24 px from the start of the main content, at most 400 px wide,
// or as wide as the main content inside its space of 24 px, and at most a
// third of the window's height, beyond which its messages scroll within it,
// and scroll to its top for a new message, unless the pointer hovers over it
// or the focus is in it (docs/design-system.md, Main Content; Messages). It
// shows above the content and the compact heading of a detail screen, and
// below tooltips, popovers, menus, and dialogs, the sidebar opened over the
// content included. It comes last in the order of the page, named
// "Messages", and does not show without a message. Each message is
// announced without moving the focus, through the announcer of the page,
// also while a modal overlay is open (docs/behaviors.md, Accessibility,
// Announcements), and stays until the user dismisses it or opens another
// screen, unless it goes on its own: its countdown waits while a pointer
// that hovers is over the area, while the focus is in it, while the tab is
// hidden, and while an overlay keeps the area out of reach
// (docs/behaviors.md, Outcome of a Change).
//
// Once the area has shown a message, the main content keeps room at its end,
// until another screen opens, as high as the area with the 24 px below it
// has been at its highest, so that the end of the page can scroll above it,
// and the window scrolls the element with the focus above the area
// (src/styles.css). F6 and Shift+F6 move the focus from anywhere else in the
// page to the newest message, and from within the area back to the element
// that had it before it entered the area, or to the screen's heading; they
// keep the browser's own use while the area holds no message or is out of
// reach. A press of the pointer on Dismiss leaves the focus where it was;
// when a message goes while the focus is in it, the focus moves to the
// Dismiss of the newer message beside it, or of the older one where it was
// the newest, and after the last to where it was before it entered the area
// (docs/behaviors.md, Accessibility, Keyboard; Focus after an action).
export function MessageArea({ expanded }: MessageAreaProps) {
  const { messages, dismiss, keepScreen } = useMessageAreaState();
  const router = useRouter();
  const screen = useRouterState({
    select: (state) => screenOf(router, state.location),
  });
  const area = useRef<HTMLElement>(null);
  const shown = messages.length > 0;
  const room = useAreaHeight(area, shown, screen);
  const list = useRef<HTMLDivElement>(null);
  const scrolls = useScrolls(area, list, shown);
  const [elements] = useState(() => new Map<number, MessageElements>());
  // The element that had the focus before it entered the area, or null, and
  // whether the area holds the focus, also while a message that held it
  // leaves the page, which drops the focus without a focusout.
  const before = useRef<HTMLElement | null>(null);
  const holdsFocus = useRef(false);
  // Where the focus goes once a message that held it has gone.
  const focusAfter = useRef<number | "before">(undefined);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const hiddenTab = useHiddenTab();
  const unreachable = useOutOfReach(area, shown);
  const newest = messages[0]?.id;
  useFocusClearOfArea(area, newest, room);
  if (!shown && (hovered || focused)) {
    setHovered(false);
    setFocused(false);
  }
  const waits = hovered || focused || hiddenTab || unreachable;

  // Another screen opened: the messages of the previous ones go for good,
  // also if the user returns to them, before the screen shows. Another tab of
  // the same screen keeps them (docs/behaviors.md, Outcome of a Change).
  useLayoutEffect(() => {
    keepScreen(screen);
  }, [screen, keepScreen]);

  // The focus returns to where it was before it entered the area, or to the
  // screen's heading when that element is gone or no element had it.
  const returnFocus = useCallback(() => {
    const element = before.current;
    before.current = null;
    holdsFocus.current = false;
    setFocused(false);
    if (element?.isConnected === true) {
      element.focus();
    } else {
      focusScreenHeading();
    }
  }, []);

  // A message that held the focus has gone: its neighbor's Dismiss, or the
  // element before the area, takes it, in the commit that removes it.
  useLayoutEffect(() => {
    const target = focusAfter.current;
    if (target === undefined) {
      return;
    }
    focusAfter.current = undefined;
    const dismissButton =
      target === "before" ? undefined : elements.get(target)?.dismiss.current;
    if (dismissButton != null) {
      dismissButton.focus();
    } else {
      returnFocus();
    }
  });

  const dismissMessage = useCallback(
    (id: number) => {
      const element = elements.get(id)?.message.current;
      if (element?.contains(document.activeElement) === true) {
        const index = messages.findIndex((message) => message.id === id);
        focusAfter.current =
          (messages[index - 1] ?? messages[index + 1])?.id ?? "before";
      }
      dismiss(id);
    },
    [elements, messages, dismiss],
  );

  // A new message scrolls a full area to its top, so that it shows, unless
  // the pointer hovers over the area or the focus is in it.
  const keepScroll = useRef(false);
  useLayoutEffect(() => {
    keepScroll.current = hovered || focused;
  }, [hovered, focused]);
  useLayoutEffect(() => {
    if (newest !== undefined && !keepScroll.current && area.current) {
      area.current.scrollTop = 0;
    }
  }, [newest]);

  // The pointer that hovers over the area, not a touch, and the focus in it,
  // with the element that had the focus before it entered the area.
  useEffect(() => {
    const current = area.current;
    if (!shown || current === null) {
      return undefined;
    }
    const inArea = (node: EventTarget | null) =>
      node instanceof Node && current.contains(node);
    const onEnter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") {
        setHovered(true);
      }
    };
    const onLeave = () => {
      setHovered(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!holdsFocus.current && !inArea(event.relatedTarget)) {
        before.current =
          event.relatedTarget instanceof HTMLElement
            ? event.relatedTarget
            : null;
      }
      holdsFocus.current = true;
      setFocused(true);
    };
    // Chromium, unlike Firefox, sends a focusout as the message that holds
    // the focus leaves the page, after which the focus moves within the
    // area (focusAfter).
    const onFocusOut = (event: FocusEvent) => {
      if (focusAfter.current === undefined && !inArea(event.relatedTarget)) {
        holdsFocus.current = false;
        setFocused(false);
      }
    };
    current.addEventListener("pointerenter", onEnter);
    current.addEventListener("pointerleave", onLeave);
    current.addEventListener("focusin", onFocusIn);
    current.addEventListener("focusout", onFocusOut);
    return () => {
      holdsFocus.current = false;
      current.removeEventListener("pointerenter", onEnter);
      current.removeEventListener("pointerleave", onLeave);
      current.removeEventListener("focusin", onFocusIn);
      current.removeEventListener("focusout", onFocusOut);
    };
  }, [shown]);

  // F6 and Shift+F6.
  useEffect(() => {
    if (!shown || unreachable) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== "F6" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        area.current === null
      ) {
        return;
      }
      event.preventDefault();
      if (area.current.contains(document.activeElement)) {
        returnFocus();
        return;
      }
      if (newest !== undefined) {
        elements.get(newest)?.message.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [shown, unreachable, newest, elements, returnFocus]);

  return (
    <>
      <div
        aria-hidden
        // The page keeps the room of its scrollbar (src/styles.css).
        data-message-room=""
        // The room at the end of the content. A false positive: the style
        // sets neither a color nor a type size (docs/conventions.md,
        // Checks).
        // oxlint-disable-next-line react/forbid-dom-props
        style={{ height: room }}
      />
      {shown && (
        <section
          ref={area}
          aria-label="Messages"
          className={`fixed right-3 bottom-6 z-20 max-h-[calc(100dvh/3)] max-w-106 px-3 ${expanded ? "left-57" : "left-17"} ${scrolls ? "overflow-y-auto" : "pointer-events-none"}`}
        >
          <div ref={list} className="flex flex-col gap-2">
            {messages.map((message) => (
              <DismissibleMessage
                key={message.id}
                message={message}
                waits={waits}
                onDismiss={dismissMessage}
                elements={elements}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// The height that the area takes from the bottom of the window, with the
// 24 px below it, which the stylesheet gives the page as its scroll padding
// at the bottom while the area shows (src/styles.css); and the room at the
// end of the content, the highest that height has been on the screen
// (screenOf), on each of its tabs, which does not shrink when a message
// goes.
function useAreaHeight(
  area: RefObject<HTMLElement | null>,
  shown: boolean,
  screen: string,
): number {
  const [room, setRoom] = useState({ screen, height: 0 });
  if (room.screen !== screen) {
    setRoom({ screen, height: 0 });
  }
  useLayoutEffect(() => {
    const current = area.current;
    if (!shown || current === null) {
      return undefined;
    }
    const root = document.documentElement;
    const record = () => {
      const height = recordAreaHeight(current);
      setRoom((last) =>
        last.screen === screen && last.height >= height
          ? last
          : {
              screen,
              height: Math.max(
                height,
                last.screen === screen ? last.height : 0,
              ),
            },
      );
    };
    const observer = new ResizeObserver(record);
    observer.observe(current);
    window.addEventListener("resize", record);
    record();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", record);
      root.style.removeProperty("--message-area-height");
    };
  }, [area, shown, screen]);
  return room.screen === screen ? room.height : 0;
}

// Whether the messages are higher than the area, a third of the window's
// height, so that they scroll within it. Only then does the area clip what
// passes its edges, the shadows of the messages included, which otherwise
// show whole; it keeps 12 px at the sides of the messages, in which their
// shadows show, and only then takes the pointer, so that its scrollbar can
// be used, while otherwise the pointer reaches the content beside and
// between the messages.
function useScrolls(
  area: RefObject<HTMLElement | null>,
  list: RefObject<HTMLElement | null>,
  shown: boolean,
): boolean {
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const current = area.current;
    const messages = list.current;
    if (!shown || current === null || messages === null) {
      return undefined;
    }
    const measure = () => {
      setScrolls(current.scrollHeight > current.clientHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(current);
    observer.observe(messages);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [area, list, shown]);
  return shown && scrolls;
}
