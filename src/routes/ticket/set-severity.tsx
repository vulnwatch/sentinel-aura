import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentSetSeverityFailure,
  validationErrorFields,
} from "../../api/errors";
import { SeverityValue, TicketStatusValue } from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useSetTicketSeverity } from "../../api/generated/tickets";
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
import {
  chosenOrFirstRadio,
  RadioGroupField,
} from "../../components/radio-group";
import { Severity, severityName } from "../../components/severity";

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
// after it: "Severity set to High.", or "Severity cleared.".
export function severityText({ data }: TicketDetailResponse): string {
  return data.severity === null
    ? "Severity cleared."
    : `Severity set to ${severityName(data.severity)}.`;
}

// What a submission that failed shows: the error of the severity, and the
// error at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

const MESSAGE_NO_SEVERITY = "Choose a severity.";

interface SetSeverityDialogProps {
  // The Ticket as the screen shows it, whose status the meaning of Not set
  // follows.
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

// The dialog of Set severity… (docs/design-system.md, Dialogs), titled such
// as "Set the severity of SNTL-21", at most 560 px wide: what the severity
// of a Ticket without a CVE decides; then Severity, a group of radio buttons
// with the severities, each with its mark, None with its meaning, and Not
// set, which clears it, with what that means for the Ticket as the screen
// shows it, its chosen option the severity as the dialog opened,
// which takes the focus; then Cancel and Save, a primary button. Save
// without another choice closes it without a request. A field error of a
// VALIDATION_ERROR shows at Severity; 409 TICKET_SEVERITY_DERIVED, for a
// Ticket that another user associated with a CVE meanwhile, and every other
// failure at the top of the form, which takes the focus, the others in the
// presentation of a change, as a warning when Sentinel did not confirm it
// (docs/behaviors.md, Where Errors Appear; Retries and Unconfirmed Changes).
// Another change reverses it, so it asks for no confirmation
// (docs/behaviors.md, Confirmation); with another choice, Cancel, Escape,
// and every navigation of the UI ask "Discard changes?" first. While the
// change is in progress, the dialog cannot be closed, and the choice cannot
// change.
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
  const mounted = useMounted();
  const formId = useId();
  const group = useRef<HTMLDivElement>(null);
  // The severity as the dialog opened, which Save without another choice
  // keeps without a request. Without a CVE, the resolved severity is the
  // one set by hand (Sentinel docs/features/tickets/tickets.md, Resolution
  // Rules).
  const [opened] = useState(() => choiceOf(ticket.severity));
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
    consequence: `The severity of ${ticketId} isn't changed.`,
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
    const { fields, unmatched } = validationErrorFields(error, ["severity"]);
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form: unmatched ? presentSetSeverityFailure(error, ticketId) : undefined,
    });
  };

  const submit = async () => {
    if (submitting.current) {
      return;
    }
    if (choice === undefined) {
      setFailure({ field: MESSAGE_NO_SEVERITY, form: undefined });
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
        data: { severity: choice === UNSET ? null : choice },
      });
    } catch (failed) {
      if (mounted.current) {
        fail(failed);
      }
    }
    submitting.current = false;
    setBusy(false);
  };

  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="form"
      title={`Set the severity of ${ticketId}`}
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
        Without a CVE, {ticketId} has the severity that you set here. It decides
        the deadlines and the automatic priority of {ticketId}.
      </p>
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
              : { severity: failure.field }
          }
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <RadioGroupField<Choice>
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
