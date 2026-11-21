// The reasons of an ignored Ticket by their names (docs/behaviors.md, Domain
// Terms; Sentinel docs/features/tickets/tickets.md, Ignore Reason), which the
// details, the dialog of Ignore…, and the audit log of a Ticket share.

const IGNORE_REASONS: Record<string, string> = {
  not_shipped: "Not shipped",
  cve_rejected: "CVE rejected",
  cna_policy: "CNA policy",
  other: "Other",
};

// The name of a reason, or the reason as received when the pinned contract
// does not list it (docs/behaviors.md, Unknown Values).
export function ignoreReasonName(reason: string): string {
  return Object.hasOwn(IGNORE_REASONS, reason)
    ? (IGNORE_REASONS[reason] ?? reason)
    : reason;
}
