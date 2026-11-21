import type { TicketIgnoreReason } from "../api/generated/model";

// The reasons of an ignored Ticket by their names (docs/behaviors.md, Domain
// Terms; Sentinel docs/features/tickets/tickets.md, Ignore Reason), which the
// details, the dialog of Ignore…, and the audit log of a Ticket share. A Map,
// so that a reason that a later Sentinel release returns is looked up only
// among them (docs/conventions.md, Data Read from the API), and every reason
// of the pinned contract has its name.
const IGNORE_REASONS = new Map<string, string>(
  Object.entries({
    not_shipped: "Not shipped",
    cve_rejected: "CVE rejected",
    cna_policy: "CNA policy",
    other: "Other",
  } satisfies Record<TicketIgnoreReason, string>),
);

// The name of a reason, or the reason as received when the pinned contract
// does not list it (docs/behaviors.md, Unknown Values).
export function ignoreReasonName(reason: string): string {
  return IGNORE_REASONS.get(reason) ?? reason;
}
