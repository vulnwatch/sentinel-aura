import { TicketPriorityValue } from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useSetTicketPriority } from "../../api/generated/tickets";
import { useChangeOutcome } from "../../components/change-outcome";
import type { MessageRecord } from "../../components/message-area";
import { Priority, priorityName } from "../../components/priority";
import { PriorityBasis } from "../../components/priority-explanation";
import { ChoiceDialog } from "./choice-dialog";

// Override priority…, Set Priority Override,
// PATCH /api/v1/tickets/{ticket_id}/priority, from Actions
// (src/routes/ticket/actions.tsx): a dialog that sets, changes, or clears
// the override of the priority of the Ticket, beside its automatic priority
// and what that is based on (Sentinel docs/features/tickets/tickets.md, Set
// Priority Override; Sentinel docs/features/tickets/ticket-priority.md,
// Priority Levels; Automatic Priority Basis; Manual Override).

// The choice of the dialog: a level, which sets the override, or the
// automatic priority, which clears it.
type Choice = TicketPriorityValue | "automatic";

const AUTOMATIC = "automatic";

// The levels in their order, each with what it means, as Sentinel states it
// (Sentinel docs/features/tickets/ticket-priority.md, Priority Levels).
const LEVELS: readonly { value: TicketPriorityValue; meaning: string }[] = [
  { value: TicketPriorityValue.p1, meaning: "Remediate immediately." },
  { value: TicketPriorityValue.p2, meaning: "Remediate with high urgency." },
  { value: TicketPriorityValue.p3, meaning: "Remediate in the normal flow." },
  { value: TicketPriorityValue.p4, meaning: "Remediate when convenient." },
];

// The choice that an override gives: none for a level that the pinned
// contract does not list, which the dialog does not offer
// (docs/behaviors.md, Unknown Values).
function choiceOf(override: string | null): Choice | undefined {
  if (override === null) {
    return AUTOMATIC;
  }
  return LEVELS.find((level) => level.value === override)?.value;
}

// The outcome of a change of the override, as Sentinel returns the Ticket
// after it: "Priority overridden: P2.", or, once the override is cleared,
// the automatic priority that the Ticket then has, "Priority override
// cleared: P3, automatic.".
export function overriddenText({ data }: TicketDetailResponse): string {
  if (data.priority_override !== null) {
    return `Priority overridden: ${priorityName(data.priority_override)}.`;
  }
  return data.priority === null
    ? "Priority override cleared: not yet prioritizable."
    : `Priority override cleared: ${priorityName(data.priority)}, automatic.`;
}

interface OverridePriorityDialogProps {
  // The Ticket as the screen shows it, whose automatic priority and basis
  // the dialog shows as they change.
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

// The dialog of Override priority… (ChoiceDialog), titled such as "Override
// the priority of SNTL-12": what an override does; the automatic priority
// with its basis, in a frame, as the Ticket shows them (PriorityBasis); then
// Priority, with Automatic, which clears the override, and the levels, each
// with its meaning, its chosen option the override as the dialog opened;
// then Cancel and Save, a primary button. A field error of a
// VALIDATION_ERROR shows at Priority; every other failure at the top of the
// form, in the presentation of a change. Another change reverses it, so it
// asks for no confirmation (docs/behaviors.md, Confirmation); with another
// choice, leaving it asks "Discard changes?" first.
export function OverridePriorityDialog({
  ticket,
  record,
  readAgain,
  onClose,
  onDone,
}: OverridePriorityDialogProps) {
  const ticketId = ticket.ticket_id;
  const set = useSetTicketPriority({
    mutation: useChangeOutcome(
      record,
      overriddenText,
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(overriddenText(response));
      },
    ),
  });
  // The override as the dialog opens, which Save without another choice
  // keeps without a request: the dialog keeps the one of its first render.
  const openedWith = choiceOf(ticket.priority_override);
  const automatic = ticket.priority_automatic;
  return (
    <ChoiceDialog<Choice>
      title={`Override the priority of ${ticketId}`}
      intro={`An override replaces the automatic priority of ${ticketId} until it is cleared. Sentinel keeps calculating the automatic priority.`}
      beforeForm={
        <div className="mt-4 max-w-112 rounded-lg border border-border px-4 py-3 text-14">
          <PriorityBasis ticket={ticket} withAutomatic headingLevel={4} />
        </div>
      }
      label="Priority"
      name="priority"
      options={[
        {
          value: AUTOMATIC,
          label: "Automatic",
          description:
            automatic === null
              ? "The automatic priority, not yet prioritizable now."
              : `The automatic priority, now ${priorityName(automatic)}.`,
        },
        ...LEVELS.map(({ value, meaning }) => ({
          value,
          label: <Priority priority={value} />,
          description: meaning,
        })),
      ]}
      openedWith={openedWith}
      emptyMessage="Choose a priority."
      discardConsequence={`The priority of ${ticketId} isn't changed.`}
      action="Save"
      submit={(choice) =>
        set.mutateAsync({
          ticketId,
          data: { priority: choice === AUTOMATIC ? null : choice },
        })
      }
      onClose={onClose}
    />
  );
}
