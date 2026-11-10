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

// The name and the tone of a value that the pinned contract lists.
export interface MarkedName {
  name: string;
  tone: Tone;
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

// A dot of 8 px in the icon color of its tone, then, 6 px later, the name of
// the value in the color of the text around it. The dot is hidden from
// assistive technologies, which read the name. A value that the pinned
// contract does not list shows as received after a hollow dot of 8 px with a
// 1 px edge in neutral-icon (docs/behaviors.md, Unknown Values).
export function MarkedValue({ value, known }: MarkedValueProps) {
  const marked = known.get(value);
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <svg aria-hidden viewBox="0 0 8 8" className="size-2 shrink-0">
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
      <span>{marked === undefined ? value : marked.name}</span>
    </span>
  );
}
