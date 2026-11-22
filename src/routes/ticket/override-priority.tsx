import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  validationErrorFields,
} from "../../api/errors";
import { TicketPriorityValue } from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useSetTicketPriority } from "../../api/generated/tickets";
import { Button } from "../../components/button";
import { useChangeOutcome, useMounted } from "../../components/change-outcome";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import type { MessageRecord } from "../../components/message-area";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { Priority, priorityName } from "../../components/priority";
import { PriorityBasis } from "../../components/priority-explanation";
import {
  chosenOrFirstRadio,
  RadioGroupField,
} from "../../components/radio-group";

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

// What a submission that failed shows: the error of the priority, and the
// error at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

const MESSAGE_NO_PRIORITY = "Choose a priority.";

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

// The dialog of Override priority… (docs/design-system.md, Dialogs), titled
// such as "Override the priority of SNTL-12", at most 560 px wide: what an
// override does; the automatic priority with its basis, in a frame, as the
// Ticket shows them (PriorityBasis); then Priority, a group of radio buttons
// with Automatic, which clears the override, and the levels, each with its
// meaning, its chosen option the override as the dialog opened, which takes
// the focus; then Cancel and Save, a primary button. Save without another
// choice closes it without a request. A field error of a VALIDATION_ERROR
// shows at Priority; every other failure at the top of the form, which takes
// the focus, in the presentation of a change, as a warning when Sentinel did
// not confirm it (docs/behaviors.md, Where Errors Appear; Retries and
// Unconfirmed Changes). Another change reverses it, so it asks for no
// confirmation (docs/behaviors.md, Confirmation); with another choice,
// Cancel, Escape, and every navigation of the UI ask "Discard changes?"
// first. While the change is in progress, the dialog cannot be closed, and
// the choice cannot change.
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
  const mounted = useMounted();
  const formId = useId();
  const group = useRef<HTMLDivElement>(null);
  // The override as the dialog opened, which Save without another choice
  // keeps without a request.
  const [opened] = useState(() => choiceOf(ticket.priority_override));
  const [choice, setChoice] = useState<Choice | undefined>(opened);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const submitting = useRef(false);
  const { focusField, region } = useFieldErrorFocus(
    failure.field !== undefined,
  );
  useEffect(() => {
    if (failure.form !== undefined || failure.field === undefined) {
      return;
    }
    focusField(chosenOrFirstRadio(group.current), failure.field);
  }, [failure, focusField]);
  const { close, question } = useDiscardQuestion({
    held: choice !== opened && !busy,
    consequence: `The priority of ${ticketId} isn't changed.`,
    onDiscard: onClose,
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const fail = (error: unknown) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, ["priority"]);
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form: unmatched ? presentChangeFailure(error) : undefined,
    });
  };

  const submit = async () => {
    if (submitting.current) {
      return;
    }
    if (choice === undefined) {
      setFailure({ field: MESSAGE_NO_PRIORITY, form: undefined });
      return;
    }
    if (choice === opened) {
      onClose();
      return;
    }
    setFailure(NO_FAILURE);
    submitting.current = true;
    setBusy(true);
    try {
      await set.mutateAsync({
        ticketId,
        data: { priority: choice === AUTOMATIC ? null : choice },
      });
    } catch (failed) {
      if (mounted.current) {
        fail(failed);
      }
    }
    submitting.current = false;
    setBusy(false);
  };

  const automatic = ticket.priority_automatic;
  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="form"
      title={`Override the priority of ${ticketId}`}
      closable={!busy}
      buttons={
        <>
          <Button size="large" isDisabled={busy} onPress={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="large"
            isBusy={busy}
          >
            Save
          </Button>
          {question}
        </>
      }
    >
      <p className="text-fg-muted">
        An override replaces the automatic priority of {ticketId} until it is
        cleared. Sentinel keeps calculating the automatic priority.
      </p>
      <div className="mt-4 max-w-112 rounded-lg border border-border px-4 py-3 text-14">
        <PriorityBasis ticket={ticket} withAutomatic headingLevel={4} />
      </div>
      <FirstFieldFocus>
        <Form
          id={formId}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void submit();
          }}
          validationErrors={
            failure.field === undefined
              ? undefined
              : { priority: failure.field }
          }
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <RadioGroupField<Choice>
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
            value={choice}
            onChange={(next) => {
              setChoice(next);
              if (failure.field !== undefined) {
                setFailure((current) => ({ ...current, field: undefined }));
              }
            }}
            isReadOnly={busy}
            groupRef={group}
          />
          {region}
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}
