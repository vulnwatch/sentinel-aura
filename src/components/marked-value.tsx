import {
  Circle,
  CircleDashed,
  CircleQuestionMark,
  LoaderCircle,
} from "lucide-react";

// A value of a response enum that a screen document marks with a tone
// (docs/design-system.md, Other Values; Tones), such as the affectedness of a
// track.

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

// The class of the color of the dot of each tone, its {tone}-icon.
const DOTS = {
  neutral: "fill-neutral-icon",
  info: "fill-info-icon",
  success: "fill-success-icon",
  warning: "fill-warning-icon",
  danger: "fill-danger-icon",
} as const satisfies Record<Tone, string>;

// The name and the tone of a value that the pinned contract lists, and, for
// a value that the dot does not mark, its mark: progress for an operation in
// progress, which the screen follows by reading it again, such as the
// pending fetch of a source of a CVE, in the info tone; unobserved for an
// observation never made, such as a source that Sentinel has not attempted,
// in the neutral tone; empty for an attempt that found nothing, such as a
// source that does not have the CVE, in the neutral tone
// (docs/design-system.md, Other Values).
export interface MarkedName {
  name: string;
  tone: Tone;
  mark?: "progress" | "unobserved" | "empty";
}

interface MarkProps {
  marked: MarkedName | undefined;
  // Whether the mark shows without the name of its value, as the status of a
  // source of a CVE does.
  alone: boolean;
}

// The mark of a value, hidden from assistive technologies, which read the
// name: a dot in the icon color of its tone, of 8 px, or 10 px alone;
// loader-circle at 12 px in info-icon, turning, which stands still under
// reduced motion (docs/design-system.md, Focus and Motion); circle-dashed or
// circle at 12 px in neutral-icon; or, for a value that the pinned contract
// does not list, a hollow dot of 8 px with a 1 px edge in neutral-icon, or
// alone circle-question-mark at 12 px in neutral-icon, so that it is not
// taken for an attempt that found nothing (docs/behaviors.md, Unknown
// Values).
function Mark({ marked, alone }: MarkProps) {
  if (marked?.mark === "progress") {
    return (
      <LoaderCircle
        aria-hidden
        className="size-3 shrink-0 animate-spin text-info-icon motion-reduce:animate-none"
      />
    );
  }
  if (marked?.mark === "unobserved") {
    return (
      <CircleDashed aria-hidden className="size-3 shrink-0 text-neutral-icon" />
    );
  }
  if (marked?.mark === "empty") {
    return <Circle aria-hidden className="size-3 shrink-0 text-neutral-icon" />;
  }
  if (marked === undefined && alone) {
    return (
      <CircleQuestionMark
        aria-hidden
        className="size-3 shrink-0 text-neutral-icon"
      />
    );
  }
  return (
    <svg
      aria-hidden
      viewBox="0 0 8 8"
      className={`${alone ? "size-2.5" : "size-2"} shrink-0`}
    >
      {marked === undefined ? (
        <circle
          cx={4}
          cy={4}
          r={3.5}
          strokeWidth={1}
          className="fill-none stroke-neutral-icon"
        />
      ) : (
        <circle cx={4} cy={4} r={4} className={DOTS[marked.tone]} />
      )}
    </svg>
  );
}

interface MarkedValueProps {
  // The value as the API returns it: one that the pinned contract lists, or
  // another that a later Sentinel release returns.
  value: string;
  // The values that the pinned contract lists, by their value: a Map, so
  // that another value is looked up only among them, never among the members
  // of an object's prototype (docs/conventions.md, Data Read from the API).
  known: ReadonlyMap<string, MarkedName>;
}

// The mark of the value, then, 6 px later, the name of the value in the
// color of the text around it. A value that the pinned contract does not
// list shows as received.
export function MarkedValue({ value, known }: MarkedValueProps) {
  const marked = known.get(value);
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Mark marked={marked} alone={false} />
      <span>{marked === undefined ? value : marked.name}</span>
    </span>
  );
}

// The mark of the value alone, without its name, which the screen gives
// assistive technologies itself (docs/design-system.md, Other Values).
export function ValueMark({ value, known }: MarkedValueProps) {
  return <Mark marked={known.get(value)} alone />;
}
