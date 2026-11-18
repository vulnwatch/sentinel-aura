import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { isRequestFailure, presentChangeFailure } from "../api/errors";
import { useShowMessage, type MessageRecord } from "./message-area";

// The outcome of a change that a screen makes (docs/behaviors.md, Outcome of
// a Change): what shows of it once Sentinel has answered, also after the user
// has left the screen, and its announcement once a read after it arrives.

// Whether the component is still on the page, so that the outcome of a
// change that ends after the user left the screen shows in the message area
// instead (docs/behaviors.md, Outcome of a Change).
export function useMounted(): RefObject<boolean> {
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

// The callbacks of a change, which apply also once the component that
// started it has left the page: readAgain reads again what the change
// affects, whatever its outcome, and the outcome of a change that ends after
// the user left the screen shows in the message area, naming the record that
// the change concerns with a link to it (docs/behaviors.md, Outcome of a
// Change). The text of a success, given the response of the change, names
// what it changed.
export function useChangeOutcome<TData>(
  record: MessageRecord,
  success: (data: TData) => string,
  readAgain: () => void,
) {
  const mounted = useMounted();
  const showMessage = useShowMessage();
  return {
    gcTime: 0,
    onSuccess: (data: TData) => {
      if (!mounted.current) {
        showMessage({ tone: "success", text: success(data), record });
      }
    },
    onError: (failure: unknown) => {
      if (mounted.current || !isRequestFailure(failure)) {
        return;
      }
      const presentation = presentChangeFailure(failure);
      if (presentation !== undefined) {
        showMessage({
          tone: presentation.unconfirmed ? "warning" : "danger",
          text: presentation.message,
          reference: presentation.reference,
          record,
        });
      }
    },
    onSettled: () => {
      readAgain();
    },
  };
}

// The announcement of the outcome of a change, with a key that changes with
// each, so that the same text is announced again.
interface Announcement {
  key: number;
  text: string;
}

// The outcome of a change, which waits for the first read after it, from the
// instant at which Sentinel confirmed the change, and whether it shows in the
// message area.
interface WaitingOutcome {
  text: string;
  at: number;
  message: boolean;
}

// The outcome of a change that ends while the user is on the screen, which
// waits for the first read after it of what the component shows, whatever
// the outcome of that read (docs/behaviors.md, Outcome of a Change;
// Accessibility, Announcements): after records it once Sentinel has
// confirmed the change, and region, a status region hidden from view,
// announces it once that read has arrived; with inMessageArea, for an
// outcome that shows nowhere where the user acted, the message area shows it
// then instead. The record keeps its identity while it names the same
// record, as from useMemo: another record shows at once what waits for the
// message area.
export function useOutcomeAfterRead(
  read: { dataUpdatedAt: number; errorUpdatedAt: number },
  record: MessageRecord,
): {
  after: (text: string, inMessageArea?: boolean) => void;
  region: ReactNode;
} {
  const showMessage = useShowMessage();
  const [announcement, setAnnouncement] = useState<Announcement>();
  const waiting = useRef<WaitingOutcome>(undefined);

  // An outcome for the message area that still waits for its read as the
  // user leaves the component shows at once, naming the record, as the
  // outcome of a change that ends after the user left does
  // (useChangeOutcome).
  useEffect(
    () => () => {
      const done = waiting.current;
      if (done?.message === true) {
        waiting.current = undefined;
        showMessage({ tone: "success", text: done.text, record });
      }
    },
    [showMessage, record],
  );

  const readAt = read.dataUpdatedAt;
  const failedAt = read.errorUpdatedAt;
  // The outcome waits for the first read after the change.
  useLayoutEffect(() => {
    const done = waiting.current;
    if (done !== undefined && (readAt >= done.at || failedAt >= done.at)) {
      waiting.current = undefined;
      if (done.message) {
        showMessage({ tone: "success", text: done.text });
      } else {
        setAnnouncement((current) => ({
          key: (current?.key ?? 0) + 1,
          text: done.text,
        }));
      }
    }
  }, [readAt, failedAt, showMessage]);

  const after = useCallback((text: string, inMessageArea = false) => {
    waiting.current = { text, at: Date.now(), message: inMessageArea };
  }, []);
  return {
    after,
    region: (
      <output className="sr-only">
        <span key={announcement?.key}>{announcement?.text}</span>
      </output>
    ),
  };
}
