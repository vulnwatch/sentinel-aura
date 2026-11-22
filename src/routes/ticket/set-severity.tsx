import { presentSetSeverityFailure } from "../../api/errors";
import { SeverityValue, TicketStatusValue } from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useSetTicketSeverity } from "../../api/generated/tickets";
import { useChangeOutcome } from "../../components/change-outcome";
import type { MessageRecord } from "../../components/message-area";
import { Severity, severityName } from "../../components/severity";
import { ChoiceDialog } from "./choice-dialog";

// Set severity…, Set Severity Manual,
// PATCH /api/v1/tickets/{ticket_id}/severity, from Actions
// (src/routes/ticket/actions.tsx), on a Ticket without a CVE: a dialog that
// sets or clears the severity of the Ticket, which Sentinel does not derive
// from CVSS without a CVE (Sentinel docs/features/tickets/tickets.md,
// Severity Resolution; Tickets Without CVE: Behavioral Differences; Set
// Severity Manual).

// The choice of the dialog: a severity, or none, which clears it.
type Choice = SeverityValue | "unset";

const UNSET = "unset";

// The severities in the order of the contract.
const SEVERITIES: readonly SeverityValue[] = [
  SeverityValue.critical,
  SeverityValue.high,
  SeverityValue.medium,
  SeverityValue.low,
  SeverityValue.none,
];

// The choice that a severity gives: none for a severity that the pinned
// contract does not list, which the dialog does not offer
// (docs/behaviors.md, Unknown Values).
function choiceOf(severity: string | null): Choice | undefined {
  if (severity === null) {
    return UNSET;
  }
  return SEVERITIES.find((value) => value === severity);
}

// What Not set means for the Ticket as the screen shows it: an Analyzed or
// Resolved Ticket returns to Analysis without a severity, and every other
// Ticket cannot become Analyzed without one (Sentinel
// docs/features/tickets/tickets.md, Gate: Analysis → Analyzed). A status
// that the pinned contract does not list is neither (docs/behaviors.md,
// Unknown Values).
function unsetMeaning({ ticket_id: id, status }: TicketDetail): string {
  return status === TicketStatusValue.analyzed ||
    status === TicketStatusValue.resolved
    ? `${id} returns to Analysis without a severity.`
    : `${id} can't become Analyzed without a severity.`;
}

// The outcome of a change of the severity, as Sentinel returns the Ticket
// after it: "Severity set to High.", or "Severity removed.".
export function severityText({ data }: TicketDetailResponse): string {
  return data.severity === null
    ? "Severity removed."
    : `Severity set to ${severityName(data.severity)}.`;
}

interface SetSeverityDialogProps {
  // The Ticket as the screen shows it, whose status the meaning of Not set
  // follows, and whose CVE, once a read shows one, ends the input.
  ticket: TicketDetail;
  record: MessageRecord;
  // Reads again what the change affects, whatever its outcome.
  readAgain: () => void;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with the text of its outcome,
  // while the dialog is on the page, before the reads after it are sent
  // (useChangeOutcome).
  onDone: (text: string) => void;
}

// The dialog of Set severity… (ChoiceDialog), titled such as "Set the
// severity of SNTL-21": what the severity of a Ticket without a CVE decides;
// then Severity, with the severities, each with its mark, None with its
// meaning, and Not set, which clears it, with what that means for the Ticket
// as the screen shows it, its chosen option the severity as the dialog
// opened; then Cancel and Save, a primary button. A field error of a
// VALIDATION_ERROR shows at Severity; 409 TICKET_SEVERITY_DERIVED, for a
// Ticket that another user associated with a CVE meanwhile, at the top of
// the form as an error, and every other failure there in the presentation of
// a change. Another change reverses it, so it asks for no confirmation
// (docs/behaviors.md, Confirmation); with another choice, leaving it asks
// "Discard changes?" first, until a read shows the Ticket with a CVE, whose
// severity Sentinel then derives, so that the choice no longer holds input.
export function SetSeverityDialog({
  ticket,
  record,
  readAgain,
  onClose,
  onDone,
}: SetSeverityDialogProps) {
  const ticketId = ticket.ticket_id;
  const set = useSetTicketSeverity({
    mutation: useChangeOutcome(
      record,
      severityText,
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(severityText(response));
      },
      (failure) => presentSetSeverityFailure(failure, ticketId),
    ),
  });
  // The severity as the dialog opens, which Save without another choice
  // keeps without a request: the dialog keeps the one of its first render.
  // Without a CVE, the resolved severity is the one set by hand (Sentinel
  // docs/features/tickets/tickets.md, Resolution Rules).
  const openedWith = choiceOf(ticket.severity);
  return (
    <ChoiceDialog<Choice>
      title={`Set the severity of ${ticketId}`}
      intro={`Without a CVE, ${ticketId} has the severity that you set here. It decides the deadlines and the automatic priority of ${ticketId}.`}
      label="Severity"
      name="severity"
      options={[
        ...SEVERITIES.map((value) => ({
          value,
          label: <Severity severity={value} />,
          description:
            value === SeverityValue.none
              ? "Informational: no deadline applies."
              : undefined,
        })),
        {
          value: UNSET,
          label: "Not set",
          description: unsetMeaning(ticket),
        },
      ]}
      openedWith={openedWith}
      emptyMessage="Choose a severity."
      discardConsequence={`The severity of ${ticketId} isn't changed.`}
      action="Save"
      submit={(choice) =>
        set.mutateAsync({
          ticketId,
          data: { severity: choice === UNSET ? null : choice },
        })
      }
      presentFailure={(failure) => presentSetSeverityFailure(failure, ticketId)}
      inputHeld={ticket.cve === null}
      onClose={onClose}
    />
  );
}
