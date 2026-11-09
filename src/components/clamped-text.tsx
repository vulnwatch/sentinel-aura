import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

interface ClampedTextProps {
  // The text, such as the description of a CVE.
  children: string;
}

// The description of a record on its detail screen, cut to its first four
// lines, the last ending with an ellipsis, when it is longer, with Show more
// below it, a button in link, text-14, weight 500, that shows the text whole
// and becomes Show less (docs/design-system.md, Main Content). The text is
// running text, at most 720 px wide. It is cut on the screen only, so
// assistive technologies read it whole, and the button states whether the
// text is expanded. Whether the text is longer than four lines follows its
// width, as the window and the text size change, and is measured again for
// another text, which starts cut.
export function ClampedText({ children }: ClampedTextProps) {
  return <Clamped key={children}>{children}</Clamped>;
}

function Clamped({ children }: ClampedTextProps) {
  const id = useId();
  const text = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [longer, setLonger] = useState(false);
  useLayoutEffect(() => {
    const element = text.current;
    if (element === null || expanded) {
      return undefined;
    }
    const measure = () => {
      setLonger(element.scrollHeight > element.clientHeight);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [expanded]);
  return (
    <div className="flex max-w-180 flex-col items-start gap-1">
      <p
        ref={text}
        id={id}
        className={`whitespace-pre-line wrap-break-word ${expanded ? "" : "line-clamp-4"}`}
      >
        {children}
      </p>
      {(longer || expanded) && (
        <AriaButton
          aria-expanded={expanded}
          aria-controls={id}
          onPress={() => {
            setExpanded(!expanded);
          }}
          className={`inline-flex h-6 items-center rounded text-14 font-medium text-link data-hovered:underline ${FOCUS_RING}`}
        >
          {expanded ? "Show less" : "Show more"}
        </AriaButton>
      )}
    </div>
  );
}
