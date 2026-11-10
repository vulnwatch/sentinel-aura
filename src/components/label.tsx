interface LabelProps {
  children: string;
}

// A label that names a short state or kind beside a value or a name, such as
// Bot or Inactive after the name of a user (docs/design-system.md, Labels):
// in text-12, weight 500, fg-muted, with a 1 px border-strong boundary, a
// 4 px radius, and 4 px of side padding. Its text carries its meaning, and
// assistive technologies read it as text. What it follows sets it 6 px apart.
export function Label({ children }: LabelProps) {
  return (
    <span className="shrink-0 rounded border border-border-strong px-1 text-12 font-medium text-fg-muted">
      {children}
    </span>
  );
}
