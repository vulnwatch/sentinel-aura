import { linkOptions } from "@tanstack/react-router";
import {
  createRef,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Form } from "react-aria-components";
import {
  cveIdError,
  isRequestFailure,
  MESSAGE_CVE_ID_FORMAT,
  MESSAGE_INVALID_VALUE,
  presentAssociateCveFailure,
  presentLeftAssociateCveFailure,
  validationErrorFields,
  type CveIdError,
} from "../../api/errors";
import { TicketStatusValue } from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useAssociateTicketCve } from "../../api/generated/tickets";
import { Button } from "../../components/button";
import { useChangeOutcome, useMounted } from "../../components/change-outcome";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import { Link } from "../../components/link";
import type { MessageRecord } from "../../components/message-area";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { characters } from "../../components/search-combobox";
import { severityName } from "../../components/severity";
import { TextField } from "../../components/text-field";

// Associate CVE…, Associate CVE, POST /api/v1/tickets/{ticket_id}/associate-cve,
// from Actions (src/routes/ticket/actions.tsx), on a Ticket without a CVE: a
// dialog with the CVE ID, then a confirmation, since no operation removes a
// CVE from a Ticket (Sentinel docs/features/tickets/tickets.md, CVE
// Association; Associating a CVE Later; CVE Resolution Behavior; Associate
// CVE; docs/behaviors.md, Confirmation).

// A CVE ID as the contract declares it, with at most 20 characters (Sentinel
// docs/features/tickets/tickets.md, Associate CVE).
const CVE_ID = /^CVE-[0-9]{4}-[0-9]{4,}$/;
const LONGEST_CVE_ID = 20;

// The CVE ID that the user typed, without its surrounding whitespace, and
// with its prefix in capitals, as the contract writes it: "cve-2099-1234"
// gives CVE-2099-1234.
export function typedCveId(text: string): string {
  const typed = text.trim();
  return /^cve-/i.test(typed) ? `CVE-${typed.slice("CVE-".length)}` : typed;
}

// The check of the CVE ID before it is sent, as the pinned OpenAPI document
// publishes it (Sentinel docs/api-spec.md, Published Input Constraints): its
// length counts its characters as Sentinel does, by code point
// (docs/behaviors.md, Where Errors Appear).
function cveIdCheck(cveId: string): string | undefined {
  if (cveId === "") {
    return "Enter the CVE ID.";
  }
  if (characters(cveId) > LONGEST_CVE_ID) {
    return `Enter at most ${LONGEST_CVE_ID} characters.`;
  }
  return CVE_ID.test(cveId) ? undefined : MESSAGE_CVE_ID_FORMAT;
}

// The outcome of an association, as Sentinel returns the Ticket after it,
// such as "CVE-2099-1234 associated.".
function associatedText({ data }: TicketDetailResponse, sent: string): string {
  return `${data.cve?.cve_id ?? sent} associated.`;
}

// The error of the CVE ID at its field: a check, a field error of a
// VALIDATION_ERROR, or an error that Sentinel returns, which can name the
// Ticket that holds the CVE.
type FieldFailure = CveIdError;

// What a submission that failed shows: the error of the field, and the
// error at the top of the form.
interface FormFailure {
  field: FieldFailure | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

function atField(message: string): FormFailure {
  return { field: { message, holder: undefined }, form: undefined };
}

interface FieldErrorTextProps {
  error: FieldFailure;
}

// The text of the error of the field, whose Ticket that holds the CVE, which
// it names last, is a link to its screen, in the color of the text of the
// error (docs/design-system.md, Forms; Messages).
function FieldErrorText({ error }: FieldErrorTextProps) {
  const holder = error.holder;
  if (holder === undefined) {
    return error.message;
  }
  const at = error.message.lastIndexOf(holder);
  return (
    <>
      {error.message.slice(0, at)}
      <Link
        placement="message"
        href={linkOptions({
          to: "/tickets/$ticketId",
          params: { ticketId: holder },
        })}
      >
        {holder}
      </Link>
      {error.message.slice(at + holder.length)}
    </>
  );
}

interface ConsequencesProps {
  ticket: TicketDetail;
  cveId: string;
}

// What the association does, as the confirmation states it: the severity
// comes from the CVSS assessments of the CVE, in place of the one set by
// hand, and Sentinel fetches the CVE; an Analyzed Ticket can return to
// Analysis, since it needs a SUSE assessment of the CVE, and a Resolved one
// also to Analyzed, since its fixed tracks then wait for the release of
// their eligible Products (Sentinel docs/features/tickets/tickets.md,
// Associating a CVE Later; Gate: Analysis → Analyzed; Gate: Analyzed →
// Resolved); a status that the pinned contract does not list is neither
// (docs/behaviors.md, Unknown Values); and no operation removes the CVE
// again.
function Consequences({ ticket, cveId }: ConsequencesProps) {
  const ticketId = ticket.ticket_id;
  const manual =
    ticket.severity === null
      ? ""
      : `, in place of the severity ${severityName(ticket.severity)} set by hand`;
  return (
    <div className="flex flex-col gap-3">
      <p>
        {ticketId} takes its severity from the CVSS assessments of {cveId}
        {manual}, and Sentinel fetches the CVE from its sources.
      </p>
      {ticket.status === TicketStatusValue.analyzed && (
        <p>
          {ticketId} can also return to Analysis until {cveId} has a SUSE
          assessment.
        </p>
      )}
      {ticket.status === TicketStatusValue.resolved && (
        <p>
          {ticketId} can also return to Analysis until {cveId} has a SUSE
          assessment, and to Analyzed until its eligible Products are released.
        </p>
      )}
      <p>No action removes a CVE from a Ticket, so this can't be undone.</p>
    </div>
  );
}

interface AssociateCveDialogProps {
  // The Ticket as the screen shows it, whose severity and status the
  // confirmation states.
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

// The dialog of Associate CVE… (docs/design-system.md, Dialogs), titled such
// as "Associate a CVE with SNTL-21", at most 560 px wide: what the CVE
// brings; then CVE ID, which takes the focus as the dialog opens; then
// Cancel and Associate CVE, a primary button. The form checks the CVE ID
// before it asks for confirmation: "Associate CVE-2099-1234 with SNTL-21?",
// with the consequences, Cancel, and Associate CVE, a danger button, which
// sends it. A check, a field error of a VALIDATION_ERROR, 422
// CVE_INVALID_FORMAT, and 409 TICKET_CVE_CONFLICT, which names the Ticket
// that holds the CVE as a link, show at the field, which takes the focus,
// until the input changes; every other failure at the top of the form,
// which takes the focus, 400 TICKET_CVE_ALREADY_SET, for a Ticket that has
// a CVE since the dialog opened, as an error and the others in the
// presentation of a change, as a warning when Sentinel did not confirm it
// (docs/behaviors.md, Where Errors Appear; Retries and Unconfirmed
// Changes). A failure closes the confirmation, so that the form,
// which keeps the CVE ID, shows it. With input, Cancel, Escape, and every
// navigation of the UI ask "Discard changes?" first. While the change is in
// progress, neither the confirmation nor the dialog can be closed.
export function AssociateCveDialog({
  ticket,
  record,
  readAgain,
  onClose,
  onDone,
}: AssociateCveDialogProps) {
  const ticketId = ticket.ticket_id;
  // The CVE ID that the change in progress sends, which its outcome and its
  // failure name, also after the user left the screen.
  const sent = useRef("");
  const associate = useAssociateTicketCve({
    mutation: useChangeOutcome(
      record,
      (response: TicketDetailResponse) =>
        associatedText(response, sent.current),
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(associatedText(response, sent.current));
      },
      (failure) =>
        presentLeftAssociateCveFailure(failure, sent.current, ticketId),
    ),
  });
  const mounted = useMounted();
  const formId = useId();
  const [text, setText] = useState("");
  // The CVE ID that the confirmation asks about, while it is open.
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const [inputRef] = useState(() => createRef<HTMLInputElement>());
  const submitting = useRef(false);
  // After a failure with an error of the field alone, the field takes the
  // focus, or its error is announced when it holds the focus already; the
  // error of the form takes it itself (docs/behaviors.md, Accessibility,
  // Announcements).
  const { focusField, region } = useFieldErrorFocus(
    failure.field !== undefined,
  );
  useEffect(() => {
    if (failure.form === undefined && failure.field !== undefined) {
      focusField(inputRef.current, failure.field.message);
    }
  }, [failure, inputRef, focusField]);
  const { close, question } = useDiscardQuestion({
    held: text.trim() !== "" && !busy,
    consequence: `No CVE is associated with ${ticketId}.`,
    onDiscard: onClose,
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const fail = (error: unknown, cveId: string) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    const field = cveIdError(error, cveId);
    if (field !== undefined) {
      setFailure({ field, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, ["cve_id"]);
    setFailure({
      field:
        fields.length > 0
          ? { message: MESSAGE_INVALID_VALUE, holder: undefined }
          : undefined,
      form: unmatched ? presentAssociateCveFailure(error, ticketId) : undefined,
    });
  };

  // The submission of the form checks the CVE ID, then asks for
  // confirmation.
  const submit = () => {
    if (submitting.current) {
      return;
    }
    const cveId = typedCveId(text);
    const error = cveIdCheck(cveId);
    if (error !== undefined) {
      setFailure(atField(error));
      return;
    }
    setFailure(NO_FAILURE);
    setConfirming(cveId);
  };

  const confirm = async (cveId: string) => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    sent.current = cveId;
    setBusy(true);
    try {
      await associate.mutateAsync({ ticketId, data: { cve_id: cveId } });
    } catch (failed) {
      if (mounted.current) {
        setConfirming(undefined);
        fail(failed, cveId);
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
      title={`Associate a CVE with ${ticketId}`}
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
            Associate CVE
          </Button>
          {confirming !== undefined && (
            <ConfirmationDialog
              isOpen
              onCancel={() => {
                setConfirming(undefined);
              }}
              title={`Associate ${confirming} with ${ticketId}?`}
              action="Associate CVE"
              onConfirm={() => {
                void confirm(confirming);
              }}
              isBusy={busy}
              error={undefined}
            >
              <Consequences ticket={ticket} cveId={confirming} />
            </ConfirmationDialog>
          )}
          {question}
        </>
      }
    >
      <p className="text-fg-muted">
        {ticketId} takes the severity, the CVSS assessments, the sources, and
        the affected versions of the CVE that you enter. Sentinel creates a CVE
        that it doesn't know yet, so check its ID.
      </p>
      <FirstFieldFocus>
        <Form
          id={formId}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            submit();
          }}
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <TextField
            label="CVE ID"
            name="cve_id"
            description="Such as CVE-2099-1234."
            value={text}
            onChange={(value) => {
              if (value !== text && failure.field !== undefined) {
                setFailure((current) => ({ ...current, field: undefined }));
              }
              setText(value);
            }}
            isReadOnly={busy}
            inputRef={inputRef}
            error={
              failure.field === undefined ? undefined : (
                <FieldErrorText error={failure.field} />
              )
            }
          />
          {region}
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}
