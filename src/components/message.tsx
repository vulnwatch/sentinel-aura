import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
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
  // The action that ends the message, such as Try again: a button 32 px
  // high, which goes below the text when the message is too narrow for both.
  action?: ReactNode;
}

// A message in the soft background of its tone, which starts with the icon of
// its tone (docs/design-system.md, Messages; Icons by Need).
export function Message({ tone, children, reference, action }: MessageProps) {
  const { Icon, classes } = TONES[tone];
  return (
    <div className={`flex gap-2 rounded-md px-3 py-2 text-15 ${classes}`}>
      <Icon aria-hidden className="mt-0.75 size-4.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p>{children}</p>
          {reference !== undefined && <Reference requestId={reference} />}
        </div>
        {/* Centered on the first line of the text, within the padding. */}
        {action !== undefined && <div className="-my-1">{action}</div>}
      </div>
    </div>
  );
}
