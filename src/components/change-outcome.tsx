import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  isRequestFailure,
  presentChangeFailure,
  type ChangeFailurePresentation,
  type RequestFailure,
} from "../api/errors";
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
// what it changed. confirmed, when given, receives the response of a change
// that ends while the component is on the page, before the reads after it
// are sent, so that what waits for those reads, such as the announcement of
// the outcome (useOutcomeAfterRead), waits also for a read that ends at
// once. present, when given, presents a failure that ends after the user
// left the screen, for a change whose screen document handles codes of it
// specifically; otherwise it has the presentation of a change.
export function useChangeOutcome<TData>(
  record: MessageRecord,
  success: (data: TData) => string,
  readAgain: () => void,
  confirmed?: (data: TData) => void,
  present: (
    failure: RequestFailure,
  ) => ChangeFailurePresentation | undefined = presentChangeFailure,
) {
  const mounted = useMounted();
  const showMessage = useShowMessage();
  return {
    gcTime: 0,
    onSuccess: (data: TData) => {
      if (!mounted.current) {
        showMessage({ tone: "success", text: success(data), record });
      } else {
        confirmed?.(data);
      }
    },
    onError: (failure: unknown) => {
      if (mounted.current || !isRequestFailure(failure)) {
        return;
      }
      const presentation = present(failure);
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
  // The text, or what gives it once the read has arrived, such as a text
  // that depends on the data of that read.
  text: string | (() => string);
  at: number;
  message: boolean;
}

// The text of an outcome that waits.
function textOf(outcome: WaitingOutcome): string {
  return typeof outcome.text === "function" ? outcome.text() : outcome.text;
}

// The outcome of a change that ends while the user is on the screen, which
// waits for the first read after it of what the component shows, whatever
// the outcome of that read (docs/behaviors.md, Outcome of a Change;
// Accessibility, Announcements): after records it once Sentinel has
// confirmed the change, and region, a status region hidden from view,
// announces it once that read has arrived; with inMessageArea, for an
// outcome that shows nowhere where the user acted, the message area shows it
// then instead. A text given as a function is taken as the outcome shows, so
// that it can state what that read shows. The outcomes of several changes that wait at once, as when
// the user starts a change before the read after the one before it has
// arrived, each wait for their read, and those that one read releases are
// announced together, in their order. The record keeps its identity while it
// names the same record, as from useMemo: another record shows at once in
// the message area what waits.
export function useOutcomeAfterRead(
  read: { dataUpdatedAt: number; errorUpdatedAt: number },
  record: MessageRecord,
): {
  after: (text: string | (() => string), inMessageArea?: boolean) => void;
  region: ReactNode;
} {
  const showMessage = useShowMessage();
  const [announcement, setAnnouncement] = useState<Announcement>();
  const waiting = useRef<WaitingOutcome[]>([]);

  // The outcomes that still wait for their read as the component leaves the
  // page, as when the user leaves it or when that read replaces it, such as
  // with a 404 after a change that ended the user's access, show at once in
  // the message area, naming the record, as the outcome of a change that
  // ends after the user left does (useChangeOutcome).
  useEffect(
    () => () => {
      const done = waiting.current;
      waiting.current = [];
      for (const outcome of done) {
        showMessage({ tone: "success", text: textOf(outcome), record });
      }
    },
    [showMessage, record],
  );

  const readAt = read.dataUpdatedAt;
  const failedAt = read.errorUpdatedAt;
  // Each outcome waits for the first read after its change.
  const release = useCallback(
    (done: readonly WaitingOutcome[]) => {
      waiting.current = waiting.current.filter(
        (outcome) => !done.includes(outcome),
      );
      for (const outcome of done) {
        if (outcome.message) {
          showMessage({ tone: "success", text: textOf(outcome) });
        }
      }
      const announced = done.filter((outcome) => !outcome.message).map(textOf);
      if (announced.length > 0) {
        setAnnouncement((current) => ({
          key: (current?.key ?? 0) + 1,
          text: announced.join(" "),
        }));
      }
    },
    [showMessage],
  );
  useLayoutEffect(() => {
    const done = waiting.current.filter(
      (outcome) => readAt >= outcome.at || failedAt >= outcome.at,
    );
    if (done.length === 0) {
      return;
    }
    // A read that fails can replace the component in the next render, as a
    // 404 of the record of a screen does, which would take its announcement
    // away: the outcomes that only a failure releases wait for the next
    // frame, by which the cleanup above has shown them in the message area
    // if the component has left the page.
    const failed = done.filter((outcome) => readAt < outcome.at);
    release(done.filter((outcome) => readAt >= outcome.at));
    if (failed.length > 0) {
      requestAnimationFrame(() => {
        release(failed.filter((outcome) => waiting.current.includes(outcome)));
      });
    }
  }, [readAt, failedAt, release]);

  const after = useCallback(
    (text: string | (() => string), inMessageArea = false) => {
      waiting.current = [
        ...waiting.current,
        { text, at: Date.now(), message: inMessageArea },
      ];
    },
    [],
  );
  return {
    after,
    region: (
      <output className="sr-only">
        <span key={announcement?.key}>{announcement?.text}</span>
      </output>
    ),
  };
}
