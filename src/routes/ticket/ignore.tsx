import { useState } from "react";
import { ignoreReasonError, presentLeftIgnoreFailure } from "../../api/errors";
import {
  CveStateValue,
  UserTicketIgnoreReasonValue,
} from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useIgnoreTicket } from "../../api/generated/tickets";
import { useChangeOutcome } from "../../components/change-outcome";
import { ignoreReasonName } from "../../components/ignore-reason";
import type { MessageRecord } from "../../components/message-area";
import { ChoiceDialog } from "./choice-dialog";
import { assigneeOutcome } from "./shared";

// Ignore…, Ignore Ticket, POST /api/v1/tickets/{ticket_id}/ignore, from
// Actions (src/routes/ticket/actions.tsx): a dialog with the reason why the
// Ticket is ignored, among those that a user can choose (Sentinel
// docs/features/tickets/tickets.md, Ignore Reason; Ignore Ticket).

type UserReason = UserTicketIgnoreReasonValue;

// The reasons that the dialog offers, in the order of the contract:
// cve_rejected only while the CVE of the Ticket is rejected, since Sentinel
// refuses it otherwise; a CVE state that the pinned contract does not list
// is not rejected (docs/behaviors.md, Unknown Values).
function reasonsOf(ticket: TicketDetail): readonly UserReason[] {
  return ticket.cve?.cve_state === CveStateValue.rejected
    ? [
        UserTicketIgnoreReasonValue.not_shipped,
        UserTicketIgnoreReasonValue.cve_rejected,
        UserTicketIgnoreReasonValue.other,
      ]
    : [
        UserTicketIgnoreReasonValue.not_shipped,
        UserTicketIgnoreReasonValue.other,
      ];
}

// What each reason means, below its label: not_shipped only when SUSE ships
// none of the affected software, whose tracks are Not affected otherwise;
// cve_rejected, the one reason after which the Ticket reopens by itself, as
// the rejection is reverted (Sentinel docs/features/tickets/tickets.md,
// Ignore Reason).
const DESCRIPTIONS: Record<UserReason, (ticket: TicketDetail) => string> = {
  not_shipped: () =>
    "SUSE ships none of the affected software. If SUSE ships it but the issue doesn't affect it, set its tracks to Not affected instead.",
  cve_rejected: ({ cve, ticket_id: id }) =>
    `${cve?.cve_id ?? "Its CVE"} is rejected. If the rejection is reverted, ${id} reopens by itself.`,
  other: ({ ticket_id: id }) =>
    `Another reason. ${id} stays ignored until someone reopens it.`,
};

// The outcome of an ignore, as Sentinel returns the Ticket after it, with the
// assignee that it now has, since an unassigned Ticket is assigned to its
// user (Sentinel docs/features/tickets/tickets.md, Auto-Assignment on
// Unassigned Tickets): such as "Ignored as Not shipped, assigned to you.".
export function ignoredText(
  { data }: TicketDetailResponse,
  signedInUser: string | undefined,
): string {
  const done =
    data.ignore_reason === null
      ? "Ignored"
      : `Ignored as ${ignoreReasonName(data.ignore_reason)}`;
  return `${done}, ${assigneeOutcome(data.assignee, signedInUser)}.`;
}

interface IgnoreDialogProps {
  ticket: TicketDetail;
  record: MessageRecord;
  // The id of the signed-in user, whom the outcome names as "you".
  signedInUser: string | undefined;
  // Reads again what the change affects, whatever its outcome.
  readAgain: () => void;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with the text of its outcome,
  // while the dialog is on the page, before the reads after it are sent
  // (useChangeOutcome).
  onDone: (text: string) => void;
}

// The dialog of Ignore… (ChoiceDialog), titled such as "Ignore SNTL-31":
// what the change does; then Reason, the reasons that the user can choose as
// the dialog opens, each with its meaning, none chosen; then Cancel and
// Ignore, a primary button. 409 TICKET_CVE_NOT_REJECTED shows at Reason, as a
// field error of a VALIDATION_ERROR for reason does; every other failure at
// the top of the form, in the presentation of a change. Reopen reverses it,
// so it asks for no confirmation (docs/behaviors.md, Confirmation); with a
// reason chosen, leaving it asks "Discard changes?" first.
export function IgnoreDialog({
  ticket,
  record,
  signedInUser,
  readAgain,
  onClose,
  onDone,
}: IgnoreDialogProps) {
  const ticketId = ticket.ticket_id;
  // The Ticket as the dialog opened, whose reasons it offers until it closes,
  // so that a read does not change the choices under the user; Sentinel
  // decides the reason sent (409 TICKET_CVE_NOT_REJECTED).
  const [opened] = useState(ticket);
  const cveId = opened.cve?.cve_id ?? "Its CVE";
  const text = (response: TicketDetailResponse) =>
    ignoredText(response, signedInUser);
  const ignore = useIgnoreTicket({
    mutation: useChangeOutcome(
      record,
      text,
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(text(response));
      },
      (failure) => presentLeftIgnoreFailure(failure, cveId),
    ),
  });
  return (
    <ChoiceDialog<UserReason>
      title={`Ignore ${ticketId}`}
      intro={`${ticketId} stops being worked, and accepts no change to its analysis until Reopen.`}
      label="Reason"
      name="reason"
      options={reasonsOf(opened).map((item) => ({
        value: item,
        label: ignoreReasonName(item),
        description: DESCRIPTIONS[item](opened),
      }))}
      openedWith={undefined}
      emptyMessage="Choose a reason."
      discardConsequence={`${ticketId} isn't ignored.`}
      action="Ignore"
      submit={(reason) => ignore.mutateAsync({ ticketId, data: { reason } })}
      fieldError={(failure) => ignoreReasonError(failure, cveId)}
      onClose={onClose}
    />
  );
}
