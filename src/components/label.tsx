// The look of a label (docs/design-system.md, Labels): text-12, weight 500,
// fg-muted, with a 1 px border-strong boundary, a 4 px radius, and 4 px of
// side padding.
const LABEL =
  "rounded border border-border-strong px-1 text-12 font-medium text-fg-muted";

interface LabelProps {
  children: string;
}

// A label that names a short state or kind beside a value or a name, such as
// Bot or Inactive after the name of a user (docs/design-system.md, Labels).
// Its text carries its meaning, and assistive technologies read it as text.
// What it follows sets it 6 px apart.
export function Label({ children }: LabelProps) {
  return <span className={`shrink-0 ${LABEL}`}>{children}</span>;
}

interface LabelListProps {
  // The texts of the labels, in their order, each once.
  labels: readonly string[];
}

// A value made of labels alone, such as the types of a CNA, as a list, so
// that assistive technologies tell one label from the next: the labels 6 px
// apart, wrapping to the next line, 4 px below, and a label wider than the
// value wrapping its text within its boundary.
export function LabelList({ labels }: LabelListProps) {
  return (
    <ul className="flex flex-wrap gap-x-1.5 gap-y-1">
      {labels.map((label) => (
        <li key={label} className={`max-w-full wrap-break-word ${LABEL}`}>
          {label}
        </li>
      ))}
    </ul>
  );
}
