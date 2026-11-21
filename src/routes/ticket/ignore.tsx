import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import {
  ignoreReasonError,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  presentLeftIgnoreFailure,
  validationErrorFields,
} from "../../api/errors";
import {
  CveStateValue,
  UserTicketIgnoreReasonValue,
} from "../../api/generated/model";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import { useIgnoreTicket } from "../../api/generated/tickets";
import { Button } from "../../components/button";
import { useChangeOutcome, useMounted } from "../../components/change-outcome";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import { ignoreReasonName } from "../../components/ignore-reason";
import type { MessageRecord } from "../../components/message-area";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { RadioGroupField } from "../../components/radio-group";
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

// What a submission that failed shows: the error of the reason, and the
// error at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

const MESSAGE_NO_REASON = "Choose a reason.";

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

// The dialog of Ignore… (docs/design-system.md, Dialogs), titled such as
// "Ignore SNTL-31", at most 560 px wide: what the change does; then Reason,
// the reasons that the user can choose as the dialog opens, each with its
// meaning, none chosen, which takes the focus as the dialog opens; then
// Cancel and Ignore, a primary button. The form checks that a reason is
// chosen before it sends it. 409 TICKET_CVE_NOT_REJECTED and a field error of
// a VALIDATION_ERROR for reason show at the reason, which takes the focus,
// until another reason is chosen; every other failure at the top of the
// form, which takes it, in the presentation of a change, as a warning when
// Sentinel did not confirm it (docs/behaviors.md, Where Errors Appear;
// Retries and Unconfirmed Changes). Reopen reverses it, so it asks for no
// confirmation (docs/behaviors.md, Confirmation); with a reason chosen,
// Cancel, Escape, and every navigation of the UI ask "Discard changes?"
// first. While the change is in progress, the dialog cannot be closed, and
// the reason cannot change.
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
  const mounted = useMounted();
  const formId = useId();
  const group = useRef<HTMLDivElement>(null);
  const [reason, setReason] = useState<UserReason>();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const submitting = useRef(false);
  // With an error at Reason alone, the reason chosen takes the focus, or the
  // first one without a choice, once the error is on the page, so that it is
  // read with it, or the error is announced when that reason holds the focus
  // already, as after Enter on it (docs/behaviors.md, Accessibility,
  // Announcements).
  const { focusField, region } = useFieldErrorFocus();
  useEffect(() => {
    if (failure.form !== undefined || failure.field === undefined) {
      return;
    }
    const inputs = group.current;
    focusField(
      inputs?.querySelector<HTMLInputElement>("input:checked") ??
        inputs?.querySelector<HTMLInputElement>("input"),
      failure.field,
    );
  }, [failure, focusField]);
  const { close, question } = useDiscardQuestion({
    held: reason !== undefined && !busy,
    consequence: `${ticketId} isn't ignored.`,
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
    const atField = ignoreReasonError(error, cveId);
    if (atField !== undefined) {
      setFailure({ field: atField, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, ["reason"]);
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form: unmatched ? presentChangeFailure(error) : undefined,
    });
  };

  const submit = async () => {
    if (submitting.current) {
      return;
    }
    if (reason === undefined) {
      setFailure({ field: MESSAGE_NO_REASON, form: undefined });
      return;
    }
    setFailure(NO_FAILURE);
    submitting.current = true;
    setBusy(true);
    try {
      await ignore.mutateAsync({ ticketId, data: { reason } });
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
      title={`Ignore ${ticketId}`}
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
            Ignore
          </Button>
          {question}
        </>
      }
    >
      <p className="text-fg-muted">
        {ticketId} stops being worked, and accepts no change to its analysis
        until Reopen.
      </p>
      <FirstFieldFocus>
        <Form
          id={formId}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void submit();
          }}
          validationErrors={
            failure.field === undefined ? undefined : { reason: failure.field }
          }
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <RadioGroupField
            label="Reason"
            name="reason"
            options={reasonsOf(opened).map((item) => ({
              value: item,
              label: ignoreReasonName(item),
              description: DESCRIPTIONS[item](opened),
            }))}
            value={reason}
            onChange={(next) => {
              setReason(next);
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
