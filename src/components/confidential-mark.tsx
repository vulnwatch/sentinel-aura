import { Lock } from "lucide-react";
import { Label } from "./label";

// The mark of a confidential Ticket (docs/design-system.md, Confidential
// Tickets; Sentinel docs/features/tickets/tickets.md, Confidential Tickets),
// which follows its identifier directly: lock at 14 px in fg-muted, 4 px
// after the identifier, on its line. It carries a meaning that no text next
// to it states, so it is an image named "Confidential".
export function ConfidentialMark() {
  return (
    <Lock
      // A false positive: the icon is an inline svg element, which an img
      // element could show only from a URL (docs/design-system.md, Icon Set),
      // and the role names it as an image.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="img"
      aria-label="Confidential"
      className="ms-1 inline-block size-3.5 shrink-0 align-middle text-fg-muted"
    />
  );
}

// The mark of a confidential Ticket on its detail screen, which follows the
// lock with the label Confidential (docs/design-system.md, Confidential
// Tickets; Labels): lock at 14 px in fg-muted, then the label, 6 px later.
// Assistive technologies read the label, so the lock is hidden from them.
// What it follows sets it 4 px after the identifier.
export function ConfidentialLabel() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Lock aria-hidden className="size-3.5 shrink-0 text-fg-muted" />
      <Label>Confidential</Label>
    </span>
  );
}
