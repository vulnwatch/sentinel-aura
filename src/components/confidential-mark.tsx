import { Lock } from "lucide-react";

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
