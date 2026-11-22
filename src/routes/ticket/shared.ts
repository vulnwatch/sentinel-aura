import { TicketStatusValue } from "../../api/generated/model";
import type { UserReference } from "../../api/generated/model";
import { displayName } from "../../components/user";

// What the actions of Actions (src/routes/ticket/actions.tsx) and their
// dialogs share, and the statuses that the actions of every part of the
// Ticket screen depend on.

// The operable statuses of a Ticket, in which Sentinel accepts a change that
// its manual-zone guard covers, such as an assignment, a change of the SUSE
// assessment, an edit of the package tree, or a mark as a duplicate: Ignored
// and Duplicated refuse it with 409 TICKET_NOT_MUTABLE, and a status that the
// pinned contract does not list offers no such action (Sentinel
// docs/features/tickets/tickets.md, Mutability Guard; Mark-as-Duplicate
// Operation; Sentinel docs/api-spec.md, Manual-Zone Mutability Guard;
// docs/screens/ticket.md, Actions, Statuses; docs/behaviors.md, Unknown
// Values).
export const OPERABLE_STATUSES: ReadonlySet<string> = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
  TicketStatusValue.resolved,
]);

// The assignee that the Ticket has after a change of its status, as the
// outcome of the change states it: "unassigned", "assigned to you", or
// "assigned to Bob Wilson" (docs/screens/ticket.md, Actions).
export function assigneeOutcome(
  assignee: UserReference | null,
  signedInUser: string | undefined,
): string {
  if (assignee === null) {
    return "unassigned";
  }
  return assignee.id === signedInUser
    ? "assigned to you"
    : `assigned to ${displayName(assignee)}`;
}
