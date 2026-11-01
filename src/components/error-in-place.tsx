import { useLayoutEffect, useRef, type ReactNode } from "react";
import { isRequestFailure, presentFailure } from "../api/errors";
import { Button } from "./button";
import { Link } from "./link";
import { Reference } from "./reference";
import { focusScreenHeading, ScreenHeading } from "./screen-heading";

interface ErrorContentProps {
  // The level-one heading that names the error, in place of the content of a
  // screen; an error in place of a part has none.
  heading?: string | undefined;
  message: string;
  reference?: string | undefined;
  action?: ReactNode;
}

// An error in place of content: its heading, its message, its reference,
// and its action, aligned to the start and at most 560 px wide
// (docs/design-system.md, Errors in Place of Content).
export function ErrorContent({
  heading,
  message,
  reference,
  action,
}: ErrorContentProps) {
  return (
    <div className="flex max-w-140 flex-col items-start gap-4">
      {heading !== undefined && <ScreenHeading>{heading}</ScreenHeading>}
      <div className="text-fg-muted">
        <p>{message}</p>
        {reference !== undefined && <Reference requestId={reference} />}
      </div>
      {action}
    </div>
  );
}

interface ErrorInPlaceProps {
  // The failure of a read.
  error: unknown;
  // In place of the content of a screen, under a heading that names the
  // error, or in place of a part of a screen or of its data
  // (docs/behaviors.md, Where Errors Appear).
  placement: "screen" | "part";
  // Sends the read again.
  onRetry: () => void;
}

// The failure of a read in place of what it would show, with Try again after
// a network failure, a 429, or a 5xx, and otherwise, in place of the content
// of a screen, a link to the landing. A 401 shows nothing, because the
// session has ended (docs/behaviors.md, Session State). Any other error is a
// failure of the UI itself, which the router shows (src/router.ts).
export function ErrorInPlace({ error, placement, onRetry }: ErrorInPlaceProps) {
  const ref = useRef<HTMLDivElement>(null);
  // When the element with the focus disappears with the error, such as Try
  // again, the focus moves to the screen's heading once the screen shows
  // what replaces the error (docs/behaviors.md, Accessibility, Focus after
  // an action).
  useLayoutEffect(() => {
    const element = ref.current;
    return () => {
      if (element?.contains(document.activeElement)) {
        queueMicrotask(focusScreenHeading);
      }
    };
  }, []);
  if (!isRequestFailure(error)) {
    throw error;
  }
  const presentation = presentFailure(error, placement);
  if (presentation === undefined) {
    return null;
  }
  let action: ReactNode;
  if (presentation.retry) {
    action = <Button onPress={onRetry}>Try again</Button>;
  } else if (placement === "screen") {
    action = <Link href="/">Go to the start page</Link>;
  }
  return (
    <div ref={ref}>
      <ErrorContent
        heading={placement === "screen" ? presentation.heading : undefined}
        message={presentation.message}
        reference={presentation.reference}
        action={action}
      />
    </div>
  );
}
