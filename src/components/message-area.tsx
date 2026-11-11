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
} from "react";
import { useFixedTopHeight } from "./fixed-top";
import { Link } from "./link";
import { Message, type MessageTone } from "./message";
import { screenOptions, type ScreenHref } from "./router-links";
import { useFocusHeadingOnRemoval } from "./screen-heading";

// The message area at the top of the main content, which every screen with
// the sidebar shares (docs/behaviors.md, Outcome of a Change;
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
}

interface ShownMessage extends AreaMessage {
  id: number;
  // The path of the screen on which the message appeared: it goes when the
  // user opens another screen.
  path: string;
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
  // also for a change that ends after the user left its screen, and then
  // names the record that it concerns, with a link to it.
  const show = useCallback(
    (message: AreaMessage) => {
      nextId.current += 1;
      const path = router.state.location.pathname;
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
        path,
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

// The identifier of the newest message of the area, which changes when a
// message appears, or undefined without one.
export function useNewestMessage(): number | undefined {
  return useMessageAreaState().messages[0]?.id;
}

// Shows a message in the message area of the screen.
export function useShowMessage(): (message: AreaMessage) => void {
  return useMessageAreaState().show;
}

interface DismissibleMessageProps {
  message: ShownMessage;
  onDismiss: (id: number) => void;
}

// A message of the area, which ends with Dismiss, and starts with the record
// that it concerns, as a link to its screen, followed by a colon, when it
// names one, such as "SNTL-42: Priority changed to P2.". When Dismiss
// removes it, the focus moves to the screen's heading (docs/behaviors.md,
// Accessibility, Focus after an action).
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

// The message area: the messages of the screen, newest first, 8 px apart.
// Each stays until the user dismisses it or opens another screen, and is
// announced without moving the focus, through a live region that is there
// before it (docs/behaviors.md, Accessibility, Announcements). While the area
// holds a message, it stays at the top of the window when the content
// scrolls, and takes at most a third of the window's height, beyond which its
// messages scroll within it. Meanwhile the window scrolls an element into
// view below the area (src/components/fixed-top.ts).
export function MessageArea() {
  const { messages, dismiss, keepPath } = useMessageAreaState();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const area = useRef<HTMLDivElement>(null);
  useFixedTopHeight("--message-area-height", area, messages.length > 0);

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
