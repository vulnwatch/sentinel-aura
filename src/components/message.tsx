import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "./icon-button";
import { Reference } from "./reference";

// The tone of a message (docs/design-system.md, Messages): success for a
// change that succeeded, info for an operation that started and for
// information, warning for a change that Sentinel did not confirm and for
// data that could not be updated, and danger for an error.
export type MessageTone = "success" | "info" | "warning" | "danger";

const TONES = {
  success: {
    Icon: CircleCheck,
    classes: "bg-success-soft text-success-on-soft",
  },
  info: { Icon: Info, classes: "bg-info-soft text-info-on-soft" },
  warning: {
    Icon: TriangleAlert,
    classes: "bg-warning-soft text-warning-on-soft",
  },
  danger: { Icon: CircleAlert, classes: "bg-danger-soft text-danger-on-soft" },
} as const;

interface MessageProps {
  tone: MessageTone;
  children: ReactNode;
  // The request identifier of an error, which follows on its own line.
  reference?: string | undefined;
  // Removes the message, in the message area, which then ends it with
  // Dismiss.
  onDismiss?: (() => void) | undefined;
}

// A message in the soft background of its tone, which starts with the icon of
// its tone (docs/design-system.md, Messages; Icons by Need).
export function Message({
  tone,
  children,
  reference,
  onDismiss,
}: MessageProps) {
  const { Icon, classes } = TONES[tone];
  return (
    <div className={`flex gap-2 rounded-md px-3 py-2 text-15 ${classes}`}>
      <Icon aria-hidden className="mt-0.75 size-4.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p>{children}</p>
        {reference !== undefined && <Reference requestId={reference} />}
      </div>
      {onDismiss !== undefined && (
        <IconButton label="Dismiss" icon={X} size="small" onPress={onDismiss} />
      )}
    </div>
  );
}
