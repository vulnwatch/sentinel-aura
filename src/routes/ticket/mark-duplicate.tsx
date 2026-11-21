import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  createRef,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Form } from "react-aria-components";
import {
  duplicateOriginalError,
  isRequestFailure,
  MESSAGE_DUPLICATE_OF_ITSELF,
  MESSAGE_INVALID_VALUE,
  presentLeftMarkDuplicateFailure,
  presentMarkDuplicateFailure,
  validationErrorFields,
} from "../../api/errors";
import { TicketStatusValue } from "../../api/generated/model";
import type {
  TicketDetailResponse,
  TicketListResponse,
  TicketSummary,
} from "../../api/generated/model";
import {
  getListTicketsQueryKey,
  useListTickets,
  useMarkTicketAsDuplicate,
} from "../../api/generated/tickets";
import { Button } from "../../components/button";
import { ConfidentialMark } from "../../components/confidential-mark";
import { useChangeOutcome, useMounted } from "../../components/change-outcome";
import { useDiscardQuestion } from "../../components/discard-question";
import { Label } from "../../components/label";
import type { MessageRecord } from "../../components/message-area";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { placeMessage } from "../../components/read-view";
import {
  characters,
  COUNT,
  SearchComboBox,
  SEARCH_MIN_LENGTH,
  useSettledTerm,
} from "../../components/search-combobox";
import { TicketStatus } from "../../components/ticket-status";
import { duplicatesOf } from "../ticket-overview/shared";

// Mark as duplicate…, Mark Ticket as Duplicate,
// POST /api/v1/tickets/{ticket_id}/duplicate, from Actions
// (src/routes/ticket/actions.tsx): a dialog with the original Ticket, which
// the Tickets that the user can see help to find (Sentinel
// docs/features/tickets/tickets.md, Mark Ticket as Duplicate; Duplicate
// Handling; List Tickets).

// The most Tickets that the field suggests for a term; a longer term narrows
// them.
const SUGGESTED_TICKETS = 20;

// The parameters of the read of the Tickets that the field suggests for a
// term: those that match it, by identifier (Sentinel
// docs/features/tickets/tickets.md, Search; List Tickets).
function suggestionsOf(term: string) {
  return {
    search: term,
    sort_by: "ticket_id",
    sort_order: "asc",
    per_page: SUGGESTED_TICKETS,
  } as const;
}

// A Ticket identifier as the user can type it: SNTL- in any letter case, or
// the number alone, which the field writes in the canonical form SNTL-{n},
// with n at most the largest positive INTEGER of PostgreSQL (Sentinel
// docs/api-spec.md, Ticket Identifier Resolution).
const TYPED_ID = /^(?:sntl-)?([1-9][0-9]*)$/i;
const LARGEST_TICKET_NUMBER = 2_147_483_647;

// The identifier that the user typed, in its canonical form, or undefined
// for another text.
export function typedTicketId(text: string): string | undefined {
  const number = TYPED_ID.exec(text)?.[1];
  return number === undefined || Number(number) > LARGEST_TICKET_NUMBER
    ? undefined
    : `SNTL-${number}`;
}

// The check of the original before it is sent: the Ticket that the user
// chose, or the identifier that they typed, without its surrounding
// whitespace.
function originalError(original: string | undefined, text: string) {
  if (text === "") {
    return "Choose the original Ticket.";
  }
  return original === undefined
    ? "Choose a Ticket, or enter its identifier, such as SNTL-42."
    : null;
}

// Why the field lists a Ticket without offering it: the Ticket itself, and a
// duplicate, whose original the user chooses instead, as the label of the
// option says, or which is reverted first when it is a duplicate of the
// Ticket itself (Sentinel docs/features/tickets/tickets.md, Duplicate
// Handling, Invariant).
function notOffered(ticket: TicketSummary, ticketId: string): string | null {
  if (ticket.ticket_id === ticketId) {
    return "This Ticket";
  }
  if (ticket.status === TicketStatusValue.duplicated) {
    if (ticket.duplicate_of_ticket_id === null) {
      return "Duplicate";
    }
    return ticket.duplicate_of_ticket_id === ticketId
      ? "Duplicate of this Ticket"
      : `Duplicate of ${ticket.duplicate_of_ticket_id}`;
  }
  return null;
}

interface TicketOptionProps {
  ticket: TicketSummary;
  label: string | null;
}

// A Ticket as an option: its identifier at weight 500, the lock of a
// confidential one, its status, and the label of a Ticket that the field
// does not offer; below them, in text-13, fg-muted, on one line that ends
// with an ellipsis, its CVE ID, followed by the title of the CVE when it has
// one, or, for a Ticket without a CVE, "No CVE", followed by its packages
// when it has any, so that every option has the same two lines.
function TicketOption({ ticket, label }: TicketOptionProps) {
  const cve = ticket.cve;
  const about = (
    cve === null
      ? ["No CVE", ticket.package_names.join(", ")]
      : [cve.cve_id, cve.title ?? ""]
  )
    .filter((part) => part !== "")
    .join(" · ");
  return (
    <span className="flex min-w-0 flex-col py-1.5">
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        <span className="font-medium">
          {ticket.ticket_id}
          {ticket.is_confidential && <ConfidentialMark />}
        </span>
        <TicketStatus status={ticket.status} />
        {label !== null && <Label>{label}</Label>}
      </span>
      <span className="truncate text-13 text-fg-muted">{about}</span>
    </span>
  );
}

interface OriginalFieldProps {
  ticketId: string;
  value: string;
  onChange: (value: string) => void;
  isReadOnly: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
}

// The original, a combobox that searches the Tickets that the user can see
// as the user types (docs/design-system.md, Forms): once the user has typed
// at least 2 characters without their surrounding whitespace and has stopped
// typing, it reads the first 20 Tickets that match them by identifier, CVE
// ID, package name, or external identifier, by identifier (Sentinel
// docs/features/tickets/tickets.md, Search), and opens them; "No
// Tickets match." when none does, or, below them, how many match when more
// do; the loading indicator while they load, and the message of the failure
// of their read in their place. The Ticket itself and a duplicate show with
// the label that says why and are disabled. Choosing a Ticket writes its
// identifier in the field. The field also takes an identifier that the user
// types, such as SNTL-42 or 42.
function OriginalField({
  ticketId,
  value,
  onChange,
  isReadOnly,
  inputRef,
}: OriginalFieldProps) {
  // The identifier of the option that the user chose, while the field holds
  // it: the value of the field is the text typed, which the options only help
  // to find, and React Aria closes the menu when the option chosen changes,
  // which would otherwise close it as the Tickets of a term that equals an
  // identifier arrive (src/routes/ticket-overview/add-package.tsx).
  const [chosen, setChosen] = useState<string | null>(null);
  const typed = value.trim();
  const term = useSettledTerm(typed);
  const searching = characters(term) >= SEARCH_MIN_LENGTH;
  const read = useListTickets(suggestionsOf(term), {
    query: { enabled: searching },
  });
  const tickets = searching ? (read.data?.data ?? []) : [];
  const total = read.data?.meta.total ?? 0;
  const long = characters(typed) >= SEARCH_MIN_LENGTH;
  let status: string | null = null;
  if (long && searching && read.status === "error") {
    status = placeMessage(read);
  } else if (long && searching && read.status === "success") {
    if (tickets.length === 0) {
      status = "No Tickets match.";
    } else if (total > tickets.length) {
      status = `The first ${COUNT.format(tickets.length)} of ${COUNT.format(total)} Tickets that match. Type more to narrow them.`;
    }
  }
  const waiting =
    long && (term !== typed || (searching && read.status === "pending"));
  return (
    <SearchComboBox<TicketSummary>
      label="Original"
      name="duplicate_of_ticket_id"
      description="Type its identifier, its CVE ID, or the name of one of its packages to find it."
      items={tickets}
      itemKey={({ ticket_id: id }) => id}
      itemText={({ ticket_id: id }) => id}
      renderItem={(ticket) => (
        <TicketOption ticket={ticket} label={notOffered(ticket, ticketId)} />
      )}
      value={chosen !== null && chosen === value ? chosen : null}
      onChange={(key) => {
        if (typeof key === "string") {
          setChosen(key);
          onChange(key);
        }
      }}
      inputValue={value}
      onInputChange={(text) => {
        if (text !== chosen) {
          setChosen(null);
        }
        onChange(text);
      }}
      status={status}
      waiting={waiting}
      opensEmpty={long}
      allowsCustomValue
      disabledKeys={tickets
        .filter((ticket) => notOffered(ticket, ticketId) !== null)
        .map((ticket) => ticket.ticket_id)}
      isReadOnly={isReadOnly}
      inputRef={inputRef}
    />
  );
}

// The identifiers of a list in words, such as "SNTL-22 and SNTL-32" or
// "SNTL-22, SNTL-32, and 3 more".
function listed(ids: readonly string[], more: number): string {
  const items = more > 0 ? [...ids, `${COUNT.format(more)} more`] : [...ids];
  if (items.length <= 2) {
    return items.join(" and ");
  }
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1) ?? ""}`;
}

interface DuplicatesMovedProps {
  ticketId: string;
}

// What the repoint of Mark as duplicate does to the duplicates of the Ticket,
// which become duplicates of the original too (Sentinel
// docs/features/tickets/tickets.md, Mark-as-Duplicate Operation): their
// identifiers, from the read of the duplicates that the details show, the
// visible ones only, as Sentinel requires (same document, List Tickets,
// Duplicate filter), and nothing without any; until that read arrives, and
// when it fails, the sentence without them.
function DuplicatesMoved({ ticketId }: DuplicatesMovedProps) {
  const read = useListTickets(duplicatesOf(ticketId));
  if (read.data === undefined) {
    return (
      <p>
        Its duplicates, if it has any, become duplicates of that Ticket too.
      </p>
    );
  }
  const ids = read.data.data.map((ticket) => ticket.ticket_id);
  if (ids.length === 0) {
    return null;
  }
  const more = read.data.meta.total - ids.length;
  const several = ids.length + more > 1;
  return (
    <p>
      {listed(ids, more)},{" "}
      {several ? "its duplicates, become" : "its duplicate, becomes"}{" "}
      {several ? "duplicates" : "a duplicate"} of that Ticket too.
    </p>
  );
}

// The original of the Ticket sent, when a read of the dialog shows it as a
// duplicate, or undefined: the Tickets that the field suggested for the text
// sent, or the duplicates of the Ticket itself, never a read of another
// screen, which can be older. It is what the error of a Duplicated original
// names (duplicateOriginalError).
function knownOriginalOf(
  client: QueryClient,
  ticketId: string,
  sent: { original: string; typed: string },
): string | undefined {
  for (const params of [suggestionsOf(sent.typed), duplicatesOf(ticketId)]) {
    const found = client
      .getQueryData<TicketListResponse>(getListTicketsQueryKey(params))
      ?.data.find(
        (ticket) =>
          ticket.ticket_id === sent.original &&
          ticket.status === TicketStatusValue.duplicated,
      );
    const original = found?.duplicate_of_ticket_id ?? null;
    if (original !== null) {
      return original;
    }
  }
  return undefined;
}

// What a submission that failed shows: the error of the field, and the error
// at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

// The outcome of Mark as duplicate, as Sentinel returns the Ticket after it.
function markedText({ data }: TicketDetailResponse): string {
  return data.duplicate_of_ticket_id === null
    ? "Marked as a duplicate."
    : `Marked as a duplicate of ${data.duplicate_of_ticket_id}.`;
}

interface MarkDuplicateDialogProps {
  ticketId: string;
  record: MessageRecord;
  // Reads again what the change affects, whatever its outcome.
  readAgain: () => void;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with the text of its outcome,
  // while the dialog is on the page, before the reads after it are sent
  // (useChangeOutcome).
  onDone: (text: string) => void;
}

// The dialog of Mark as duplicate… (docs/design-system.md, Dialogs), titled
// such as "Mark SNTL-21 as a duplicate", at most 560 px wide: what the change
// does, and what it does to the duplicates of the Ticket (DuplicatesMoved);
// then the original (OriginalField), which takes the focus as the dialog
// opens; then Cancel and Mark as duplicate, a primary button. The form
// checks the original before it sends it. A check, a field error of a
// VALIDATION_ERROR, and 400 TICKET_SELF_DUPLICATE, 404 TICKET_NOT_FOUND, and
// 409 TICKET_DUPLICATE_TARGET_DUPLICATED show at the field, which takes the
// focus, until the input changes; every other failure at the top of the
// form, which takes it, 409 TICKET_DUPLICATE_CONCURRENT_MODIFICATION as an
// error and the others in the presentation of a change, as a warning when
// Sentinel did not confirm it (docs/behaviors.md, Where Errors Appear;
// Retries and Unconfirmed Changes). It asks for no confirmation: Revert
// duplicate reverses it (docs/behaviors.md, Confirmation). With input,
// Cancel, Escape, and every navigation of the UI ask "Discard changes?"
// first. While the change is in progress, the dialog cannot be closed, and
// the field keeps the original sent, read-only, and its focus.
export function MarkDuplicateDialog({
  ticketId,
  record,
  readAgain,
  onClose,
  onDone,
}: MarkDuplicateDialogProps) {
  // The original that the change in progress sends, which its failure names,
  // also after the user left the screen, with the text typed for it, for
  // which the field suggested its Tickets.
  const sent = useRef({ original: "", typed: "" });
  const mark = useMarkTicketAsDuplicate({
    mutation: useChangeOutcome(
      record,
      markedText,
      readAgain,
      (response: TicketDetailResponse) => {
        onDone(markedText(response));
      },
      (failure) =>
        presentLeftMarkDuplicateFailure(failure, sent.current.original),
    ),
  });
  const mounted = useMounted();
  const client = useQueryClient();
  const formId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const [inputRef] = useState(() => createRef<HTMLInputElement>());
  const submitting = useRef(false);
  useEffect(() => {
    if (failure.form === undefined && failure.field !== undefined) {
      inputRef.current?.focus();
    }
  }, [failure, inputRef]);
  const { close, question } = useDiscardQuestion({
    held: text.trim() !== "" && !busy,
    consequence: `${ticketId} isn't marked as a duplicate.`,
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
    const atField = duplicateOriginalError(error, {
      original: sent.current.original,
      duplicateOf: knownOriginalOf(client, ticketId, sent.current),
      ticketId,
    });
    if (atField !== undefined) {
      setFailure({ field: atField, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, [
      "duplicate_of_ticket_id",
    ]);
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form: unmatched ? presentMarkDuplicateFailure(error) : undefined,
    });
  };

  const submit = async () => {
    if (submitting.current) {
      return;
    }
    const typed = text.trim();
    const original = typedTicketId(typed);
    let error = originalError(original, typed);
    if (error === null && original === ticketId) {
      error = MESSAGE_DUPLICATE_OF_ITSELF;
    }
    setFailure(error === null ? NO_FAILURE : { field: error, form: undefined });
    if (error !== null || original === undefined) {
      return;
    }
    submitting.current = true;
    sent.current = { original, typed };
    setBusy(true);
    try {
      await mark.mutateAsync({
        ticketId,
        data: { duplicate_of_ticket_id: original },
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
      title={`Mark ${ticketId} as a duplicate`}
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
            Mark as duplicate
          </Button>
          {question}
        </>
      }
    >
      <div className="flex flex-col gap-3 text-fg-muted">
        <p>
          {ticketId} becomes a duplicate of the Ticket that you choose, and
          accepts no other change until Revert duplicate.
        </p>
        <DuplicatesMoved ticketId={ticketId} />
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
              : { duplicate_of_ticket_id: failure.field }
          }
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <OriginalField
            ticketId={ticketId}
            value={text}
            onChange={(value) => {
              if (value !== text && failure.field !== undefined) {
                setFailure((current) => ({ ...current, field: undefined }));
              }
              setText(value);
            }}
            isReadOnly={busy}
            inputRef={inputRef}
          />
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}
