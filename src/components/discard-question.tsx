import { useBlocker } from "@tanstack/react-router";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmationDialog } from "./modal-dialog";

interface DiscardQuestionOptions {
  // Whether the dialog holds input not yet submitted, which leaving it
  // discards: not the input of a change in progress, which counts as
  // submitted (docs/behaviors.md, Confirmation).
  held: boolean;
  // The consequence that the question states, such as "The reference that
  // you entered isn't added.".
  consequence: string;
  // Closes the dialog, which drops its input.
  onDiscard: () => void;
}

export interface DiscardQuestion {
  // Closes the dialog, as Cancel, Close, and Escape do: at once without
  // input, otherwise once the user discards it.
  close: () => void;
  // The question, which the dialog holds among its buttons.
  question: ReactNode;
}

// The question before input not yet submitted is discarded
// (docs/behaviors.md, Confirmation): "Discard changes?", with the
// consequence, Keep editing, and Discard. It asks when the dialog closes, and
// before every navigation of the UI while the dialog holds the input, such as
// Back or Forward, also one that stays on the screen, such as another anchor:
// Keep editing keeps the screen, the dialog, its input, and the URL, and
// Discard closes the dialog and lets the navigation go on. Closing or
// reloading the page, or following a link that the browser loads, leaves the
// question to the browser's own prompt. The navigations that the session
// forces skip it (src/session-gate.tsx); one that the session forces while
// the question waits takes its place, and the question leaves with the
// dialog.
export function useDiscardQuestion({
  held,
  consequence,
  onDiscard,
}: DiscardQuestionOptions): DiscardQuestion {
  // Discard closes the dialog, which no longer holds the input once React has
  // rendered the press, before the navigation goes on and leads to a
  // redirect.
  const holds = useRef(held);
  useLayoutEffect(() => {
    holds.current = held;
  }, [held]);
  // A dialog that leaves the page holds nothing from the commit in which it
  // leaves, before the router drops its blocker after that commit: the screen
  // that takes its place can navigate at once, as the landing does.
  useLayoutEffect(
    () => () => {
      holds.current = false;
    },
    [],
  );
  const blocks = useCallback(() => holds.current, []);
  const navigation = useBlocker({
    shouldBlockFn: blocks,
    enableBeforeUnload: blocks,
    withResolver: true,
  });
  const [closing, setClosing] = useState(false);

  const discard = () => {
    setClosing(false);
    navigation.proceed?.();
    onDiscard();
  };
  return {
    close: () => {
      if (blocks()) {
        setClosing(true);
      } else {
        onDiscard();
      }
    },
    question: (
      <ConfirmationDialog
        isOpen={closing || navigation.status === "blocked"}
        onCancel={() => {
          setClosing(false);
          navigation.reset?.();
        }}
        title="Discard changes?"
        action="Discard"
        cancelLabel="Keep editing"
        onConfirm={discard}
        isBusy={false}
        error={undefined}
      >
        {consequence}
      </ConfirmationDialog>
    ),
  };
}
