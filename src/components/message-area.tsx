import { useRouter, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  use,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Message, type MessageTone } from "./message";
import { useFocusHeadingOnRemoval } from "./screen-heading";

// The message area at the top of the main content, which every screen with
// the sidebar shares (docs/behaviors.md, Outcome of a Change;
// docs/design-system.md, Main Content; Messages).

// A message to show in the message area.
export interface AreaMessage {
  tone: MessageTone;
  text: string;
  // The request identifier of an error.
  reference?: string | undefined;
}

interface ShownMessage extends AreaMessage {
  id: number;
  // The path of the screen on which the message appeared: it goes when the
  // user opens another screen.
  path: string;
}

interface MessageAreaState {
  messages: readonly ShownMessage[];
  show: (message: AreaMessage) => void;
  dismiss: (id: number) => void;
  // Removes the messages of every screen other than the one at the path.
  keepPath: (path: string) => void;
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
  // also for a change that ends after the user left its screen.
  const show = useCallback(
    (message: AreaMessage) => {
      nextId.current += 1;
      const shown = {
        ...message,
        id: nextId.current,
        path: router.state.location.pathname,
      };
      setMessages((current) => [shown, ...current]);
    },
    [router],
  );
  const dismiss = useCallback((id: number) => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, []);
  const keepPath = useCallback((path: string) => {
    setMessages((current) =>
      current.filter((message) => message.path === path),
    );
  }, []);

  const state = useMemo(
    () => ({ messages, show, dismiss, keepPath }),
    [messages, show, dismiss, keepPath],
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

// Shows a message in the message area of the screen.
export function useShowMessage(): (message: AreaMessage) => void {
  return useMessageAreaState().show;
}

interface DismissibleMessageProps {
  message: ShownMessage;
  onDismiss: (id: number) => void;
}

// A message of the area, which ends with Dismiss. When Dismiss removes it,
// the focus moves to the screen's heading (docs/behaviors.md, Accessibility,
// Focus after an action).
function DismissibleMessage({ message, onDismiss }: DismissibleMessageProps) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusHeadingOnRemoval(ref);
  return (
    <div ref={ref}>
      <Message
        tone={message.tone}
        reference={message.reference}
        onDismiss={() => {
          onDismiss(message.id);
        }}
      >
        {message.text}
      </Message>
    </div>
  );
}

// Keeps the element with the focus out from under the area while the area
// stays at the top of the window: the window scrolls an element into view
// below the height of the area.
function useScrollPaddingBelow(
  area: RefObject<HTMLElement | null>,
  holdsMessages: boolean,
) {
  useLayoutEffect(() => {
    const element = area.current;
    if (!holdsMessages || element === null) {
      return undefined;
    }
    const root = document.documentElement;
    const observer = new ResizeObserver(() => {
      root.style.scrollPaddingTop = `${element.offsetHeight}px`;
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty("scroll-padding-top");
    };
  }, [area, holdsMessages]);
}

// The message area: the messages of the screen, newest first, 8 px apart.
// Each stays until the user dismisses it or opens another screen, and is
// announced without moving the focus, through a live region that is there
// before it (docs/behaviors.md, Accessibility, Announcements). While the area
// holds a message, it stays at the top of the window when the content
// scrolls, and takes at most a third of the window's height, beyond which its
// messages scroll within it.
export function MessageArea() {
  const { messages, dismiss, keepPath } = useMessageAreaState();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const area = useRef<HTMLDivElement>(null);
  useScrollPaddingBelow(area, messages.length > 0);

  // Another screen opened: the messages of the previous ones go for good,
  // also if the user returns to them, before the screen shows.
  useLayoutEffect(() => {
    keepPath(path);
  }, [path, keepPath]);

  return (
    <div
      ref={area}
      aria-live="polite"
      aria-relevant="additions"
      className={
        messages.length > 0
          ? "sticky top-0 z-10 -mt-2 mb-2 flex max-h-[33dvh] flex-col gap-2 overflow-y-auto bg-canvas py-2"
          : undefined
      }
    >
      {messages.map((message) => (
        <DismissibleMessage
          key={message.id}
          message={message}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}
