import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { isRequestFailure, presentChangeFailure } from "../../api/errors";
import { TicketStatusValue } from "../../api/generated/model";
import type {
  CurrentUserData,
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import {
  getListTicketAccessGrantsQueryKey,
  useSetTicketConfidentiality,
} from "../../api/generated/tickets";
import { useChangeOutcome, useMounted } from "../../components/change-outcome";
import type { MessageRecord } from "../../components/message-area";
import {
  ConfirmationDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { displayName } from "../../components/user";
import { useReadAfterTicketChange } from "../ticket-overview/shared";

// Make confidential… and Make non-confidential…, Set Confidentiality, PATCH
// /api/v1/tickets/{ticket_id}/confidentiality, from Actions
// (src/routes/ticket/actions.tsx), for a user who holds
// manage_confidentiality (Sentinel docs/features/tickets/tickets.md,
// Confidential Tickets; Set Confidentiality).

// The statuses in which making a Ticket confidential unassigns an assignee
// who cannot be the assignee of a confidential Ticket; in the others Sentinel
// keeps the assignee (Sentinel docs/features/tickets/tickets.md, Set
// Confidentiality). A status that the pinned contract does not list is none
// of them (docs/behaviors.md, Unknown Values).
const UNASSIGNING_STATUSES = new Set<string>([
  TicketStatusValue.new,
  TicketStatusValue.analysis,
  TicketStatusValue.analyzed,
]);

// The outcome of a change of the confidentiality, as Sentinel returns the
// Ticket after it: "Made confidential.", "Made confidential, unassigned."
// when the change cleared the assignee that the screen showed, or "Made
// non-confidential.".
export function confidentialityText(
  { data }: TicketDetailResponse,
  assigneeBefore: string | undefined,
): string {
  if (!data.is_confidential) {
    return "Made non-confidential.";
  }
  return assigneeBefore !== undefined && data.assignee === null
    ? "Made confidential, unassigned."
    : "Made confidential.";
}

// Reads again what a change of the confidentiality affects: what a change of
// the Ticket affects, the Embargo view and its count among the reads of the
// Ticket list included; and its access grants, which making it
// non-confidential deletes, on their next read rather than at once, since
// Sentinel refuses the read of the grants of a Ticket that is not
// confidential: a Ticket made confidential reads them as the screen shows it
// so (docs/behaviors.md, Outcome of a Change; Sentinel
// docs/features/tickets/tickets.md, List Access Grants).
export function useReadAfterConfidentiality(ticketId: string) {
  const client = useQueryClient();
  const readAfterChange = useReadAfterTicketChange(ticketId);
  return useCallback(() => {
    readAfterChange();
    void client.invalidateQueries({
      queryKey: getListTicketAccessGrantsQueryKey(ticketId),
      refetchType: "none",
    });
  }, [client, readAfterChange, ticketId]);
}

interface ConsequencesProps {
  ticket: TicketDetail;
  confidential: boolean;
  user: CurrentUserData | undefined;
}

// What the change does, as the confirmation states it. Making the Ticket
// confidential leaves it to the users who see every Ticket and the
// maintainers of its packages that are not excluded, since a Ticket that is
// not confidential has no access grants: Sentinel deletes them as it makes a
// Ticket non-confidential (Sentinel docs/features/identity/rbac.md, Scope and
// Confidential Ticket Visibility); in New, Analysis, and Analyzed, it also
// unassigns an assignee who cannot be the assignee of a confidential Ticket,
// which the screen reads only of the signed-in user, from their assignment
// eligibility (docs/screen-map.md, Roles, Principles). Making it
// non-confidential discloses it to every user, deletes its access grants, and
// keeps its Coordinated Release Date, which still decides its deadlines
// while it has any (Sentinel docs/features/tickets/tickets.md, Set
// Confidentiality; Sentinel docs/features/tickets/ticket-deadlines.md, Null
// Due Dates).
function Consequences({ ticket, confidential, user }: ConsequencesProps) {
  const ticketId = ticket.ticket_id;
  if (!confidential) {
    return (
      <div className="flex flex-col gap-3">
        <p>
          Every user can then see {ticketId}. Making it confidential again
          doesn&apos;t undo that disclosure.
        </p>
        <p>
          Its access grants are deleted, and making it confidential again
          doesn&apos;t restore them.
        </p>
        {ticket.coordinated_release_at !== null && (
          <p>
            {ticket.release_due_at === null
              ? "Its Coordinated Release Date stays."
              : "Its Coordinated Release Date stays, and still decides its deadlines."}
          </p>
        )}
      </div>
    );
  }
  const assignee = ticket.assignee;
  let unassigned: string | undefined;
  if (assignee !== null && UNASSIGNING_STATUSES.has(ticket.status)) {
    if (assignee.id !== user?.id) {
      unassigned = `If ${displayName(assignee)}, the assignee, can't be the assignee of a confidential Ticket, ${ticketId} becomes unassigned.`;
    } else if (user?.assignment_eligibility !== "all") {
      unassigned = `You can't be the assignee of a confidential Ticket, so ${ticketId} becomes unassigned.`;
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <p>
        Only the users who see every Ticket and the maintainers of its packages
        that are not excluded keep seeing {ticketId}. Every other user loses
        access to it.
      </p>
      {unassigned !== undefined && <p>{unassigned}</p>}
    </div>
  );
}

interface ConfidentialityDialogProps {
  // The Ticket as the screen shows it, whose consequences the confirmation
  // states.
  ticket: TicketDetail;
  // Whether the confirmation makes the Ticket confidential, as its item of
  // Actions did as it opened.
  confidential: boolean;
  user: CurrentUserData | undefined;
  record: MessageRecord;
  // Reads again what the change affects, whatever its outcome.
  readAgain: () => void;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with the text of its outcome,
  // while the confirmation is on the page, before the reads after it are
  // sent (useChangeOutcome).
  onDone: (text: string) => void;
}

// The confirmation of Make confidential… or Make non-confidential…
// (docs/behaviors.md, Confirmation): "Make SNTL-12 confidential?" or "Make
// SNTL-18 non-confidential?", with the consequences, Cancel, which takes the
// focus, and the action, a danger button, which sends the confidentiality.
// While the change is in progress, the action is busy and the confirmation
// cannot be closed; once Sentinel confirms it, the confirmation closes and
// the focus returns to Actions. A failure shows at the top of the
// confirmation, which stays open, as a warning when Sentinel did not confirm
// the change (docs/behaviors.md, Where Errors Appear; Retries and Unconfirmed
// Changes); the screen handles no code of Set Confidentiality specifically.
export function ConfidentialityDialog({
  ticket,
  confidential,
  user,
  record,
  readAgain,
  onClose,
  onDone,
}: ConfidentialityDialogProps) {
  const ticketId = ticket.ticket_id;
  // The assignee that the screen shows as the confirmation opens, whose
  // clearing the outcome states.
  const [assigneeBefore] = useState(ticket.assignee?.id);
  const text = (response: TicketDetailResponse) =>
    confidentialityText(response, assigneeBefore);
  const change = useSetTicketConfidentiality({
    mutation: useChangeOutcome(
      record,
      text,
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(text(response));
      },
    ),
  });
  const mounted = useMounted();
  const [error, setError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const confirm = async () => {
    if (change.isPending) {
      return;
    }
    setError(undefined);
    try {
      await change.mutateAsync({
        ticketId,
        data: { is_confidential: confidential },
      });
    } catch (failure) {
      if (!mounted.current) {
        return;
      }
      if (!isRequestFailure(failure)) {
        setUiFailure({ error: failure });
        return;
      }
      const presentation = presentChangeFailure(failure);
      if (presentation !== undefined) {
        setError({
          message: presentation.message,
          reference: presentation.reference,
          unconfirmed: presentation.unconfirmed,
        });
      }
    }
  };

  const action = confidential ? "Make confidential" : "Make non-confidential";
  return (
    <ConfirmationDialog
      isOpen
      onCancel={onClose}
      title={
        confidential
          ? `Make ${ticketId} confidential?`
          : `Make ${ticketId} non-confidential?`
      }
      action={action}
      onConfirm={() => {
        void confirm();
      }}
      isBusy={change.isPending}
      error={error}
    >
      <Consequences ticket={ticket} confidential={confidential} user={user} />
    </ConfirmationDialog>
  );
}
