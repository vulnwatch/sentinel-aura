import type { UserReference } from "../../api/generated/model";
import { displayName } from "../../components/user";

// What the actions of Actions (src/routes/ticket/actions.tsx) and their
// dialogs share.

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
