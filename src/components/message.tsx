import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useId, type ReactNode, type Ref } from "react";
import { IconButton } from "./icon-button";
import { INSIDE_FOCUS_RING } from "./focus-ring";
import { Reference } from "./reference";

// The tone of a message (docs/design-system.md, Messages): success for a
// change that succeeded, info for an operation that started and for
// information, warning for a change that Sentinel did not confirm and for
// data that could not be updated, and danger for an error.
export type MessageTone = "success" | "info" | "warning" | "danger";

// The classes of each tone: the soft background, the text and the icon in
// the on-soft color, and the line of the time left in the same color.
const TONES = {
  success: {
    Icon: CircleCheck,
    classes: "bg-success-soft text-success-on-soft",
    line: "bg-success-on-soft",
  },
  info: {
    Icon: Info,
    classes: "bg-info-soft text-info-on-soft",
    line: "bg-info-on-soft",
  },
  warning: {
    Icon: TriangleAlert,
    classes: "bg-warning-soft text-warning-on-soft",
    line: "bg-warning-on-soft",
  },
  danger: {
    Icon: CircleAlert,
    classes: "bg-danger-soft text-danger-on-soft",
    line: "bg-danger-on-soft",
  },
} as const;

// The countdown of a message that goes on its own (docs/behaviors.md,
// Outcome of a Change), which its line of the time left shows.
export interface MessageCountdown {
  // Whether the countdown waits, which stops the line where it is.
  paused: boolean;
}

interface MessageProps {
  tone: MessageTone;
  children: ReactNode;
  // The request identifier of an error, which follows on its own line.
  reference?: string | undefined;
  // Removes the message, in the message area, which then ends it with
  // Dismiss.
  onDismiss?: (() => void) | undefined;
  // Whether the message floats over the content, in the message area, with
  // a border line and a shadow.
  floating?: boolean;
  // The countdown of a floating message that goes on its own, or undefined
  // for one that stays until it is dismissed, which has no line.
  countdown?: MessageCountdown | undefined;
  // Whether the message can take the focus itself, as in the message area
  // after F6, named by its words, so that assistive technologies read it; it
  // then draws its focus ring inside it (docs/design-system.md, Focus and
  // Motion).
  focusable?: boolean;
  ref?: Ref<HTMLDivElement> | undefined;
  // The Dismiss of the message.
  dismissRef?: Ref<HTMLButtonElement> | undefined;
}

// A message in the soft background of its tone, which starts with the icon of
// its tone (docs/design-system.md, Messages; Icons by Need). In the message
// area, it floats over the content with a border line and shadow-lg, and one
// that goes on its own shows the time left as a line of 2 px in its on-soft
// color along its top edge, inside its radius, which shortens toward the
// start, stops while the countdown waits, and stays across the whole width
// under reduced motion (docs/design-system.md, Focus and Motion). A press of
// the pointer on its Dismiss leaves the focus where it was
// (docs/behaviors.md, Accessibility, Focus after an action).
export function Message({
  tone,
  children,
  reference,
  onDismiss,
  floating = false,
  countdown,
  focusable = false,
  ref,
  dismissRef,
}: MessageProps) {
  const { Icon, classes, line } = TONES[tone];
  const wordsId = useId();
  const frame = floating
    ? `relative overflow-hidden border border-border shadow-lg ${INSIDE_FOCUS_RING}`
    : "";
  return (
    <div
      ref={ref}
      role={focusable ? "group" : undefined}
      aria-labelledby={focusable ? wordsId : undefined}
      tabIndex={focusable ? -1 : undefined}
      className={`flex gap-2 rounded-md px-3 py-2 text-15 ${classes} ${frame}`}
    >
      {floating && countdown !== undefined && (
        <div
          aria-hidden
          className={`absolute inset-x-0 top-0 h-0.5 origin-left animate-countdown motion-reduce:animate-none ${line} ${countdown.paused ? "[animation-play-state:paused]" : ""}`}
        />
      )}
      <Icon aria-hidden className="mt-0.75 size-4.5 shrink-0" />
      <div id={wordsId} className="min-w-0 flex-1">
        <p>{children}</p>
        {reference !== undefined && <Reference requestId={reference} />}
      </div>
      {onDismiss !== undefined && (
        <IconButton
          ref={dismissRef}
          label="Dismiss"
          icon={X}
          size="small"
          preventFocusOnPress
          onPress={onDismiss}
        />
      )}
    </div>
  );
}
