import {
  CalendarDate,
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
  toCalendarDateTime,
  toZoned,
  type CalendarDateTime,
} from "@internationalized/date";
import { Pencil } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Form } from "react-aria-components";
import {
  isCoordinatedReleaseBeforeCreation,
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentCoordinatedReleaseFailure,
  validationErrorFields,
  type RequestFailure,
} from "../../api/errors";
import type {
  TicketDetail,
  TicketDetailResponse,
} from "../../api/generated/model";
import {
  useGetTicket,
  useSetTicketCoordinatedReleaseDate,
} from "../../api/generated/tickets";
import { AbsentValue } from "../../components/absent-value";
import { Button } from "../../components/button";
import {
  useChangeOutcome,
  useMounted,
  useOutcomeAfterRead,
} from "../../components/change-outcome";
import {
  DateField,
  firstPart,
  UNTYPED,
  type Typed,
} from "../../components/date-field";
import {
  DateTime,
  formatDateTime,
  formatUtcDateTime,
  timeZoneName,
} from "../../components/date-time";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import { IconButton } from "../../components/icon-button";
import type { MessageRecord } from "../../components/message-area";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { FocusHandOff } from "../../components/screen-heading";
import { useSignedInUser } from "../../session-gate";
import { ticketRecord, useLayoutHold } from "../ticket";
import { useReadAfterTicketChange } from "./shared";

// The Coordinated Release Date of the Ticket in its details
// (src/routes/ticket-overview/details.tsx), with its change from them, Set
// Coordinated Release Date, PATCH
// /api/v1/tickets/{ticket_id}/coordinated-release-date, for a user who holds
// manage_confidentiality (Sentinel docs/features/tickets/tickets.md,
// Coordinated Release Date; Set Coordinated Release Date).

// The last day that the field takes, the day before the last that Sentinel
// accepts, 31 Dec 9999 in UTC, so that every time of the day, in every time
// zone of a browser, is an instant that Sentinel accepts (Sentinel
// docs/features/tickets/tickets.md, Set Coordinated Release Date), as the
// period of the audit log takes its last day.
const LAST_DAY = new CalendarDate(9999, 12, 30);

const MINUTE = 60_000;

// The instant of a date and time of the field, in the time zone of the
// browser, in milliseconds since the epoch.
function instantOf(value: CalendarDateTime): number {
  return toZoned(value, getLocalTimeZone()).toDate().getTime();
}

// The date and time of an instant in the time zone of the browser, to the
// minute, as the field shows it.
function fieldValueOf(instant: number): CalendarDateTime {
  return toCalendarDateTime(
    fromDate(new Date(instant), getLocalTimeZone()),
  ).set({ second: 0, millisecond: 0 });
}

// The first instant that the field takes: the creation of the Ticket, or the
// next whole minute after it, since the field takes whole minutes and
// Sentinel refuses an instant before the creation (Sentinel
// docs/features/tickets/tickets.md, Coordinated Release Date).
function firstInstant(ticket: TicketDetail): number {
  return Math.ceil(Date.parse(ticket.created_at) / MINUTE) * MINUTE;
}

// The error of a date and time outside those that the field takes, such as
// "Enter a date and time from 3 Nov 2026, 09:13 to 30 Dec 9999, 23:59.".
function outsideMessage(first: number): string {
  return `Enter a date and time from ${formatDateTime(new Date(first).toISOString())} to 30 Dec 9999, 23:59.`;
}

const MESSAGE_INCOMPLETE = "Enter the day, the month, the year, and the time.";

// The outcome of a change of the Coordinated Release Date, as Sentinel
// returns the Ticket after it, such as "Coordinated Release Date set to 25
// Nov 2026, 14:00.", or "Coordinated Release Date removed.".
function changedText({ data }: TicketDetailResponse): string {
  return data.coordinated_release_at === null
    ? "Coordinated Release Date removed."
    : `Coordinated Release Date set to ${formatDateTime(data.coordinated_release_at)}.`;
}

// The value of a complete date and time of the field.
function dateTimeOf(typed: Typed): CalendarDateTime | undefined {
  return typed.kind === "complete"
    ? toCalendarDateTime(typed.value)
    : undefined;
}

interface ZoneDescriptionProps {
  value: CalendarDateTime | undefined;
  // The instant at which the dialog opened, in milliseconds since the epoch.
  now: number;
}

// The description of the field: the time zone of the browser, in which the
// user enters the date and time, named for the date entered, or for the
// present instant without one; once the date and the time are complete, the
// same instant in UTC, as the other parties to an embargo often state it;
// and that the instant has already passed, which Sentinel accepts, so that a
// mistyped year shows (docs/behaviors.md, Dates and Times, Input).
function ZoneDescription({ value, now }: ZoneDescriptionProps) {
  if (value === undefined) {
    return <>In your time zone, {timeZoneName(now)}.</>;
  }
  const instant = instantOf(value);
  return (
    <>
      In your time zone, {timeZoneName(instant)}: {formatUtcDateTime(instant)}{" "}
      UTC.{instant < now && " It has already passed."}
    </>
  );
}

// What a submission that failed shows: the error of the field, and the error
// at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

interface CoordinatedReleaseDialogProps {
  ticket: TicketDetail;
  record: MessageRecord;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with the text of its outcome,
  // while the dialog is on the page, before the reads after it are sent
  // (useChangeOutcome).
  onDone: (text: string) => void;
}

// The dialog of the Coordinated Release Date (docs/design-system.md,
// Dialogs), at most 560 px wide, titled such as "Edit the Coordinated
// Release Date of SNTL-18": what the date decides, in fg-muted; then the date
// and time field, Coordinated Release Date, which takes the focus as the
// dialog opens; then, while the Ticket had a date as the dialog opened,
// Remove date, a secondary button at the start of the buttons, and Cancel
// and Save, a primary button. Save checks before sending that the date and
// the time are complete, and that they lie between the creation of the
// Ticket and the last day that the field takes; a date and time unchanged
// closes the dialog without a request. Remove date sends null at once on a
// confidential Ticket, and asks for confirmation on one that is no longer
// confidential, which cannot receive a date again (docs/behaviors.md,
// Confirmation). A check, a field error of a VALIDATION_ERROR, and 422
// TICKET_COORDINATED_RELEASE_BEFORE_CREATION show at the field, which takes
// the focus, until the input changes; every other failure at the top of the
// form, which takes the focus, 409 TICKET_NOT_CONFIDENTIAL as an error and
// the others in the presentation of a change, as a warning when Sentinel did
// not confirm it, or at the top of the confirmation, which stays open
// (docs/behaviors.md, Where Errors Appear; Retries and Unconfirmed Changes).
// With another date and time than the one with which the dialog opened,
// Cancel, Escape, and every navigation of the UI ask "Discard changes?"
// first. While the change is in progress, the dialog cannot be closed and
// the field is read-only.
function CoordinatedReleaseDialog({
  ticket,
  record,
  onClose,
  onDone,
}: CoordinatedReleaseDialogProps) {
  const ticketId = ticket.ticket_id;
  const readAgain = useReadAfterTicketChange(ticketId);
  const first = firstInstant(ticket);
  const outside = outsideMessage(first);
  const present = (failure: RequestFailure) =>
    isCoordinatedReleaseBeforeCreation(failure)
      ? { message: outside, reference: undefined, unconfirmed: false }
      : presentCoordinatedReleaseFailure(failure, ticketId);
  const change = useSetTicketCoordinatedReleaseDate({
    mutation: useChangeOutcome(
      record,
      changedText,
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(changedText(response));
      },
      present,
    ),
  });
  const mounted = useMounted();
  const formId = useId();
  const group = useRef<HTMLDivElement>(null);
  // The date and time with which the dialog opened, to the minute.
  const [opened] = useState(() =>
    ticket.coordinated_release_at === null
      ? null
      : fieldValueOf(Date.parse(ticket.coordinated_release_at)),
  );
  // What the field holds, as it last reported it, and as its description
  // and the question before discarding it show it.
  const [now] = useState(() => Date.now());
  const [initial] = useState<Typed>(() =>
    opened === null
      ? UNTYPED
      : { kind: "complete", value: opened, edited: false },
  );
  const typedRef = useRef(initial);
  const [typed, setTyped] = useState(initial);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeError, setRemoveError] = useState<DialogError>();
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const busy = change.isPending;
  // What the change in progress sends: a date and time, or null.
  const removing =
    busy && change.variables?.data.coordinated_release_at === null;
  const { focusField, region } = useFieldErrorFocus(
    failure.field !== undefined,
  );
  useEffect(() => {
    if (failure.form === undefined && failure.field !== undefined) {
      focusField(firstPart(group.current), failure.field);
    }
  }, [failure, focusField]);
  const value = dateTimeOf(typed);
  const unchanged =
    (typed.kind === "empty" && opened === null) ||
    (value !== undefined && opened !== null && value.compare(opened) === 0);
  const { close, question } = useDiscardQuestion({
    held: typed.edited && !unchanged && !busy,
    consequence: `The Coordinated Release Date of ${ticketId} isn't changed.`,
    onDiscard: onClose,
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const fail = (error: unknown, inConfirmation: boolean) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    if (isCoordinatedReleaseBeforeCreation(error)) {
      setFailure({ field: outside, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, [
      "coordinated_release_at",
    ]);
    const presentation = unmatched
      ? presentCoordinatedReleaseFailure(error, ticketId)
      : undefined;
    const form =
      presentation === undefined
        ? undefined
        : {
            message: presentation.message,
            reference: presentation.reference,
            unconfirmed: presentation.unconfirmed,
          };
    if (inConfirmation && fields.length === 0) {
      setRemoveError(form);
      return;
    }
    setConfirmingRemove(false);
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form,
    });
  };

  const send = async (
    coordinatedReleaseAt: string | null,
    inConfirmation = false,
  ) => {
    if (change.isPending) {
      return;
    }
    setFailure(NO_FAILURE);
    setRemoveError(undefined);
    try {
      await change.mutateAsync({
        ticketId,
        data: { coordinated_release_at: coordinatedReleaseAt },
      });
    } catch (failed) {
      if (mounted.current) {
        fail(failed, inConfirmation);
      }
    }
  };

  const save = () => {
    if (change.isPending) {
      return;
    }
    const current = typedRef.current;
    const shown = dateTimeOf(current);
    if (
      (current.kind === "empty" && opened === null) ||
      (shown !== undefined && opened !== null && shown.compare(opened) === 0)
    ) {
      onClose();
      return;
    }
    if (shown === undefined) {
      setFailure({ field: MESSAGE_INCOMPLETE, form: undefined });
      return;
    }
    const instant = instantOf(shown);
    if (instant < first || toCalendarDate(shown).compare(LAST_DAY) > 0) {
      setFailure({ field: outside, form: undefined });
      return;
    }
    void send(new Date(instant).toISOString());
  };

  const remove = () => {
    if (change.isPending) {
      return;
    }
    if (ticket.is_confidential) {
      void send(null);
    } else {
      setRemoveError(undefined);
      setConfirmingRemove(true);
    }
  };

  const intro = ticket.is_confidential ? (
    <>
      The date and time agreed with the other parties at which the embargo of{" "}
      {ticketId} ends. Its deadlines divide the time from its creation to it,
      and follow the SLA without it.
    </>
  ) : (
    <>
      {ticketId} is no longer confidential, but its Coordinated Release Date
      still decides its deadlines: they divide the time from its creation to it,
      and follow the SLA without it. Once removed, it can&apos;t be set again.
    </>
  );

  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="form"
      title={`Edit the Coordinated Release Date of ${ticketId}`}
      closable={!busy}
      buttons={
        <>
          {opened !== null && (
            <div className="me-auto flex">
              <Button
                size="large"
                isBusy={removing && !confirmingRemove}
                isDisabled={busy && !removing}
                onPress={remove}
              >
                Remove date
              </Button>
            </div>
          )}
          <Button size="large" isDisabled={busy} onPress={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            size="large"
            isBusy={busy && !removing}
            isDisabled={removing}
          >
            Save
          </Button>
          {confirmingRemove && (
            <ConfirmationDialog
              isOpen
              onCancel={() => {
                setConfirmingRemove(false);
              }}
              title={`Remove the Coordinated Release Date of ${ticketId}?`}
              action="Remove date"
              onConfirm={() => {
                void send(null, true);
              }}
              isBusy={busy}
              error={removeError}
            >
              {ticketId} is no longer confidential, so it can&apos;t receive a
              Coordinated Release Date again, and its deadlines then follow the
              SLA. This can&apos;t be undone.
            </ConfirmationDialog>
          )}
          {question}
        </>
      }
    >
      <p className="text-fg-muted">{intro}</p>
      <FirstFieldFocus>
        <Form
          id={formId}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            save();
          }}
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <DateField
            label="Coordinated Release Date"
            look="form"
            granularity="minute"
            initial={opened}
            description={<ZoneDescription value={value} now={now} />}
            error={failure.field}
            first={toCalendarDate(fieldValueOf(first))}
            last={LAST_DAY}
            isReadOnly={busy}
            groupRef={group}
            onTyped={(next) => {
              typedRef.current = next;
            }}
            onEdit={() => {
              setTyped(typedRef.current);
              if (failure.field !== undefined) {
                setFailure((current) => ({ ...current, field: undefined }));
              }
            }}
            onEnter={save}
          />
          {region}
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}

// The Coordinated Release Date of the Ticket and its change from its details
// (docs/design-system.md, Detail Screens): the state of its dialog, which
// the screen keeps outside the details, so that the dialog and the
// announcement of its outcome stay when the details move or lose the field.
// While the dialog is open, the layout of the screen waits until it closes
// (useLayoutHold). Once Sentinel confirms the change, the dialog closes, the
// focus returns to the pencil, and the outcome is announced once the read of
// the Ticket after it arrives, or shows in the message area when that read
// fails (useOutcomeAfterRead); the outcome of a change that ends after the
// user left the tab shows there too, naming the Ticket (docs/behaviors.md,
// Outcome of a Change). Whatever the outcome, the screen then reads again
// what the change affects: the Ticket, whose deadlines it moves, the users
// who acted on it, its audit log, and the reads of the Ticket list.
export function useCoordinatedReleaseDate(ticket: TicketDetail) {
  const ticketId = ticket.ticket_id;
  const user = useSignedInUser();
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const ticketRead = useGetTicket(ticketId, { query: { enabled: false } });
  const outcome = useOutcomeAfterRead(ticketRead, record);
  const [open, setOpen] = useState(false);
  useLayoutHold(open);
  const capable =
    user?.capabilities.includes("manage_confidentiality") === true;
  return {
    // Whether the details show the pencil: to a user who holds
    // manage_confidentiality, in every status, since Sentinel accepts the
    // change also on an Ignored or Duplicated Ticket, and while the dialog
    // is open, which keeps it as it opened (docs/behaviors.md, The Signed-in
    // User).
    offered: capable || open,
    open: () => {
      setOpen(true);
    },
    dialog: open && (
      <CoordinatedReleaseDialog
        ticket={ticket}
        record={record}
        onClose={() => {
          setOpen(false);
        }}
        onDone={(text) => {
          setOpen(false);
          outcome.after(text);
        }}
      />
    ),
    region: outcome.region,
  };
}

export type CoordinatedReleaseDate = ReturnType<
  typeof useCoordinatedReleaseDate
>;

interface CoordinatedReleaseFieldProps {
  ticket: TicketDetail;
  release: CoordinatedReleaseDate;
}

// The Coordinated Release Date, a date and time, or an absent value, and,
// for a user who can change it, at the end of its line, the pencil, an icon
// button of 24 px with pencil at 14 px, named "Edit Coordinated Release
// Date", which its tooltip shows (docs/design-system.md, Detail Screens).
// When the field leaves the details while the pencil holds the focus, as
// after the removal of the date of a Ticket that is no longer confidential,
// the focus moves to the screen's heading (docs/behaviors.md, Accessibility,
// Focus after an action).
export function CoordinatedReleaseField({
  ticket,
  release,
}: CoordinatedReleaseFieldProps): ReactNode {
  const value =
    ticket.coordinated_release_at === null ? (
      <AbsentValue />
    ) : (
      <DateTime value={ticket.coordinated_release_at} />
    );
  if (!release.offered) {
    return value;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{value}</div>
      <FocusHandOff>
        <IconButton
          label="Edit Coordinated Release Date"
          icon={Pencil}
          size="inline"
          onPress={release.open}
        />
      </FocusHandOff>
    </div>
  );
}
