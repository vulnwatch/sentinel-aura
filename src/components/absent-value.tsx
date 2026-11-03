interface AbsentValueProps {
  // The word that the screen document gives the absence, such as
  // "Unassigned" for a Ticket without an assignee, which shows in place of the
  // dash.
  name?: string;
}

// A field without a value, null or omitted (docs/behaviors.md, Absent
// Values; docs/design-system.md, Other Values): an en dash in fg-muted, which
// assistive technologies read as "Not set", or the word that names the
// absence precisely, also in fg-muted.
export function AbsentValue({ name }: AbsentValueProps) {
  if (name !== undefined) {
    return <span className="text-fg-muted">{name}</span>;
  }
  return (
    <span className="text-fg-muted">
      <span aria-hidden>–</span>
      <span className="sr-only">Not set</span>
    </span>
  );
}
