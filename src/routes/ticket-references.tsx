import { useQueryClient } from "@tanstack/react-query";
import { createRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash, X } from "lucide-react";
import {
  createRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Form } from "react-aria-components";
import { z } from "zod";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  referenceAddressError,
  validationErrorFields,
} from "../api/errors";
import {
  ReferenceTypeValue,
  type TicketReferenceCreate,
  type TicketReferenceDataResponse,
  type TicketReferenceResponse,
  type TicketReferenceUpdate,
} from "../api/generated/model";
import {
  getListTicketActorsQueryKey,
  getListTicketEventsQueryKey,
} from "../api/generated/ticket-audit-log";
import {
  getListReferencesQueryKey,
  useAddReference,
  useDeleteReference,
  useListReferences,
  useUpdateReference,
} from "../api/generated/ticket-references";
import { getGetTicketQueryKey, useGetTicket } from "../api/generated/tickets";
import { AbsentValue } from "../components/absent-value";
import { Button } from "../components/button";
import {
  useChangeOutcome,
  useMounted,
  useOutcomeAfterRead,
} from "../components/change-outcome";
import { ClampedText } from "../components/clamped-text";
import {
  EmptyState,
  FramedTable,
  type TableColumn,
} from "../components/data-table";
import { DateTime } from "../components/date-time";
import { useDiscardQuestion } from "../components/discard-question";
import {
  FilterGroup,
  Filters,
  FilterSelect,
  type FilterOption,
  type SelectOption,
} from "../components/filters";
import { IconButton } from "../components/icon-button";
import { Loading, UpdatingBar } from "../components/loading";
import {
  ConfirmationDialog,
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../components/modal-dialog";
import { OptionsStatus } from "../components/options";
import { dataPlace, placeMessage } from "../components/read-view";
import { useRowFocusAfterRemoval } from "../components/row-focus";
import { FocusHandOff } from "../components/screen-heading";
import { SelectField, type FieldOption } from "../components/select-field";
import { TextAreaField, TextField } from "../components/text-field";
import { addressText, WebAddress, WebLink } from "../components/web-link";
import { sameSearch, stringifySearch, valueListParam } from "../search-params";
import { useSignedInUser } from "../session-gate";
import { CVE_FETCHER_NAMES, ticketRecord, ticketRoute } from "./ticket";

// The tab References of the Ticket screen (docs/screens/ticket.md,
// References): the references of the Ticket, from List References, which a
// user who holds manage_references adds, edits, and deletes when they are
// manual (Sentinel docs/features/tickets/ticket-references.md, API Endpoints;
// Sentinel docs/features/identity/rbac.md, Endpoint Permission Map, Ticket
// References).

// The longest values that the contract accepts, in characters, as Sentinel
// counts them, by code point (Sentinel
// docs/features/tickets/ticket-references.md, API Schemas).
const ADDRESS_MAX_LENGTH = 2048;
const TITLE_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 2000;

// A count, its thousands grouped (docs/behaviors.md, Style).
const COUNT = new Intl.NumberFormat("en-US");

// The source of the references that users manage; any other is the name of
// the fetcher that owns an automatic reference, which no user changes (same
// document, Purpose).
const MANUAL = "manual";

// The names of the types of a reference (same document, ReferenceType). A
// Map, so that a type that a later Sentinel release returns is looked up only
// among them (docs/conventions.md, Data Read from the API).
const TYPE_NAMES = new Map<string, string>(
  Object.entries({
    advisory: "Advisory",
    patch: "Patch",
    issue: "Issue",
    article: "Article",
  } satisfies Record<ReferenceTypeValue, string>),
);

// The type of a reference by its name, Uncategorized without one, or as
// received when the pinned contract does not list it (docs/behaviors.md,
// Unknown Values).
function typeName(type: string | null): string {
  return type === null ? "Uncategorized" : (TYPE_NAMES.get(type) ?? type);
}

// The source of a reference: Manual, or the CVE source of the fetcher that
// owns an automatic reference, as Sentinel names it, or as received
// (CVE_FETCHER_NAMES).
function sourceName(source: string): string {
  return source === MANUAL
    ? "Manual"
    : (CVE_FETCHER_NAMES.get(source) ?? source);
}

// What names a reference in the actions on it and in their outcome: its
// title in quotation marks, as the audit log quotes it, or without one its
// address, which it does not (docs/screens/ticket.md, Audit log).
function referenceName(reference: TicketReferenceResponse): string {
  return reference.title === null
    ? addressText(reference.url)
    : `“${reference.title}”`;
}

// The names of Edit and Delete, before the name of their reference, by which
// the tab also finds them again in their row.
const EDIT = "Edit reference";
const DELETE = "Delete reference";

// The length of a text as Sentinel counts it, by code point.
function characters(value: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- the code points are what Sentinel counts, as Python's len does
  return [...value].length;
}

// ----------------------------------------------------------------------------
// The table

interface ReferenceCellProps {
  reference: TicketReferenceResponse;
}

// A reference: its title, a link to its address, at weight 500, or without a
// title its address as the link; below it, in text-13, fg-muted, the address
// that the link leads to; and below that its description, cut to its first
// four lines with Show more (docs/design-system.md, Main Content). An address
// breaks where it must (docs/behaviors.md, Links to Other Sites). It carries
// the identifier of the reference, by which the tab finds its row again.
function ReferenceCell({ reference }: ReferenceCellProps) {
  const address = addressText(reference.url);
  return (
    <div
      data-reference-id={reference.id}
      className="flex flex-col items-start gap-0.5"
    >
      <span className="font-medium wrap-anywhere">
        <WebLink address={reference.url}>{reference.title ?? address}</WebLink>
      </span>
      {reference.title !== null && (
        <span className="text-13 wrap-anywhere text-fg-muted">{address}</span>
      )}
      {reference.description !== null && (
        <div className="mt-1 max-w-full">
          <ClampedText>{reference.description}</ClampedText>
        </div>
      )}
    </div>
  );
}

interface RowActions {
  edit: (reference: TicketReferenceResponse) => void;
  remove: (reference: TicketReferenceResponse, index: number) => void;
}

// The columns of the table: the reference, which names its row; its type;
// its source; when it was added; and, for a user who holds
// manage_references, Edit and Delete at the end of the row of a manual
// reference (docs/design-system.md, Tables).
function columnsOf(
  rows: readonly TicketReferenceResponse[],
  actions: RowActions | undefined,
): TableColumn<TicketReferenceResponse>[] {
  const columns: TableColumn<TicketReferenceResponse>[] = [
    {
      id: "reference",
      name: "Reference",
      isRowHeader: true,
      grows: true,
      wraps: true,
      render: (reference) => <ReferenceCell reference={reference} />,
    },
    {
      id: "type",
      name: "Type",
      // Without a type, Uncategorized names the absence of one, which is not
      // another type (Sentinel docs/features/tickets/ticket-references.md,
      // ReferenceType; docs/behaviors.md, Absent Values).
      render: (reference) =>
        reference.type === null ? (
          <AbsentValue name={typeName(null)} />
        ) : (
          typeName(reference.type)
        ),
    },
    {
      id: "source",
      name: "Source",
      render: (reference) => sourceName(reference.source),
    },
    {
      id: "added",
      name: "Added",
      render: (reference) => <DateTime value={reference.created_at} />,
    },
  ];
  if (actions === undefined) {
    return columns;
  }
  return [
    ...columns,
    {
      id: "actions",
      name: "Actions",
      hidesName: true,
      // 14 px before the buttons, which with the padding of the cell leave it
      // 24 px of its own: once one of them has had the focus, React Aria's
      // table makes the cell its tab stop, and so a target of its own, which
      // needs that room beside them (WCAG 2.5.8, Target Size (Minimum)).
      render: (reference) =>
        reference.source === MANUAL ? (
          <div className="flex justify-end gap-1 ps-3.5 text-fg-muted">
            <IconButton
              size="small"
              icon={Pencil}
              label={`${EDIT} ${referenceName(reference)}`}
              tooltip="Edit"
              onPress={() => {
                actions.edit(reference);
              }}
            />
            <IconButton
              size="small"
              icon={Trash}
              label={`${DELETE} ${referenceName(reference)}`}
              tooltip="Delete"
              onPress={() => {
                actions.remove(
                  reference,
                  rows.findIndex((row) => row.id === reference.id),
                );
              }}
            />
          </div>
        ) : null,
    },
  ];
}

// ----------------------------------------------------------------------------
// Changes

// What a change of the references of a Ticket affects, which the screen
// reads again whatever its outcome (useChangeOutcome): the references, the
// audit log, the users who acted on the Ticket, and the Ticket
// (docs/behaviors.md, Outcome of a Change).
function useReadAgain(ticketId: string) {
  const client = useQueryClient();
  return useCallback(() => {
    for (const queryKey of [
      getListReferencesQueryKey(ticketId),
      getListTicketEventsQueryKey(ticketId),
      getListTicketActorsQueryKey(ticketId),
      getGetTicketQueryKey(ticketId),
    ]) {
      void client.invalidateQueries({ queryKey });
    }
  }, [client, ticketId]);
}

// The choice of the type in the form: a type of the contract;
// uncategorized, which sends null; detect, which Add alone offers and which
// leaves the type to Sentinel, which classifies the address (Sentinel
// docs/features/tickets/ticket-references.md, Type Auto-Classification); and
// received, which Edit offers for a type that the pinned contract does not
// list, which it keeps.
type TypeChoice = ReferenceTypeValue | "uncategorized" | "detect" | "received";

const TYPE_OPTIONS: readonly FieldOption<TypeChoice>[] = [
  ...Object.values(ReferenceTypeValue).map((value) => ({
    value,
    label: typeName(value),
  })),
  { value: "uncategorized", label: "Uncategorized" },
];

const DETECT_OPTION: FieldOption<TypeChoice> = {
  value: "detect",
  label: "Detect from the address",
};

// The input of the form, as the user types it.
interface ReferenceInput {
  url: string;
  title: string;
  type: TypeChoice;
  description: string;
}

const NEW_REFERENCE: ReferenceInput = {
  url: "",
  title: "",
  type: "detect",
  description: "",
};

const KNOWN_TYPES = new Set<string>(Object.values(ReferenceTypeValue));

function isKnownType(type: string): type is ReferenceTypeValue {
  return KNOWN_TYPES.has(type);
}

function inputOf(reference: TicketReferenceResponse): ReferenceInput {
  let type: TypeChoice = "uncategorized";
  if (reference.type !== null) {
    type = isKnownType(reference.type) ? reference.type : "received";
  }
  return {
    url: addressText(reference.url),
    title: reference.title ?? "",
    type,
    description: reference.description ?? "",
  };
}

// A text that may stay empty, which Sentinel stores without one, null, when
// it is empty or holds whitespace alone, which it does not accept (same
// document, URL Normalization); it sends any other text as the user typed
// it.
function optionalText(value: string): string | null {
  return value.trim() === "" ? null : value;
}

function typeOf(choice: TypeChoice): ReferenceTypeValue | null | undefined {
  if (choice === "uncategorized") {
    return null;
  }
  return choice === "detect" || choice === "received" ? undefined : choice;
}

// The body of Add Reference: the address without its surrounding
// whitespace, and the type only when the user chose one, so that Sentinel
// classifies the address otherwise.
function createBody(input: ReferenceInput): TicketReferenceCreate {
  const type = typeOf(input.type);
  return {
    url: input.url.trim(),
    title: optionalText(input.title),
    description: optionalText(input.description),
    ...(type === undefined ? {} : { type }),
  };
}

// The body of Update Reference: only the fields that the user changed, or
// undefined when they changed none, which needs no request (Sentinel
// docs/api-spec.md, Partial Update Semantics).
function updateBody(
  initial: ReferenceInput,
  input: ReferenceInput,
): TicketReferenceUpdate | undefined {
  const body: TicketReferenceUpdate = {};
  if (input.url.trim() !== initial.url) {
    body.url = input.url.trim();
  }
  if (optionalText(input.title) !== optionalText(initial.title)) {
    body.title = optionalText(input.title);
  }
  if (input.type !== initial.type) {
    const type = typeOf(input.type);
    if (type !== undefined) {
      body.type = type;
    }
  }
  if (optionalText(input.description) !== optionalText(initial.description)) {
    body.description = optionalText(input.description);
  }
  return Object.keys(body).length === 0 ? undefined : body;
}

function validateAddress(value: string): string | null {
  const address = value.trim();
  if (address === "") {
    return "Enter the address.";
  }
  if (characters(address) > ADDRESS_MAX_LENGTH) {
    return `Enter at most ${COUNT.format(ADDRESS_MAX_LENGTH)} characters.`;
  }
  return WebAddress.of(address) === undefined
    ? "Enter a web address that starts with https:// or http://."
    : null;
}

function validateLength(max: number) {
  return (value: string): string | null =>
    characters(value) > max
      ? `Enter at most ${COUNT.format(max)} characters.`
      : null;
}

// The announcements of a reference that Sentinel added or changed, named as
// its response gives it.
function addedText({ data }: TicketReferenceDataResponse): string {
  return `Reference ${referenceName(data)} added.`;
}

function changedText({ data }: TicketReferenceDataResponse): string {
  return `Reference ${referenceName(data)} changed.`;
}

const FIELDS = ["url", "title", "type", "description"] as const;
type Field = (typeof FIELDS)[number];

// What a submission that failed shows: the errors of its fields, and the
// error at the top of the form, or undefined.
interface FormFailure {
  fields: Partial<Record<Field, string>>;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { fields: {}, form: undefined };

// A reference that the dialog adds, or the one that it edits.
type DialogMode =
  { kind: "add" } | { kind: "edit"; reference: TicketReferenceResponse };

interface ReferenceDialogProps {
  ticketId: string;
  mode: DialogMode;
  onClose: () => void;
  // Tells that Sentinel confirmed the change, with its outcome and the
  // reference as Sentinel returns it.
  onDone: (text: string, reference: TicketReferenceResponse) => void;
}

// Add reference and Edit reference, Add Reference,
// POST /api/v1/tickets/{ticket_id}/references, and Update Reference,
// PATCH /api/v1/tickets/{ticket_id}/references/{reference_id}, in a dialog
// with a form (docs/design-system.md, Dialogs; Forms): Address, Title, Type,
// and Description, the first taking the focus as the dialog opens. The form
// checks before sending what the contract declares of its fields: the
// address, required, a web address of at most 2,048 characters, the title of
// at most 500, and the description of at most 2,000. Add sends the type only
// when the user chose one; Edit sends only the fields that the user changed,
// and closes without a request when they changed none. An address that
// another reference of the Ticket has, 409 RESOURCE_CONFLICT, and a field
// error of a VALIDATION_ERROR show at their field, which takes the focus;
// every other failure at the top of the form, which takes it, as a warning
// when Sentinel did not confirm the change (docs/behaviors.md, Where Errors
// Appear). With input that the user changed, Cancel, Escape, and every
// navigation of the UI, such as Back, ask "Discard changes?" first, and
// closing or reloading the page shows the browser's own prompt
// (docs/behaviors.md, Confirmation). While the change is in progress, the
// dialog cannot be closed, and its input counts as submitted: a navigation
// goes on without a question, and the outcome shows on the screen that the
// user is on (useChangeOutcome).
function ReferenceDialog({
  ticketId,
  mode,
  onClose,
  onDone,
}: ReferenceDialogProps) {
  // The outcome of a change that ends after the user left the tab names the
  // Ticket (useChangeOutcome).
  const record = ticketRecord(ticketId);
  const readAgain = useReadAgain(ticketId);
  const add = useAddReference({
    mutation: useChangeOutcome(record, addedText, readAgain),
  });
  const update = useUpdateReference({
    mutation: useChangeOutcome(record, changedText, readAgain),
  });
  const formId = useId();
  const [initial] = useState(() =>
    mode.kind === "add" ? NEW_REFERENCE : inputOf(mode.reference),
  );
  const [input, setInput] = useState(initial);
  const [busy, setBusy] = useState(false);
  // The errors of the fields and of the form, a new object for each
  // failure, so that each shows again.
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const [refs] = useState(() => ({
    url: createRef<HTMLInputElement>(),
    title: createRef<HTMLInputElement>(),
    type: createRef<HTMLButtonElement>(),
    description: createRef<HTMLTextAreaElement>(),
  }));
  // After a failure with errors of fields alone, the first of them takes the
  // focus; the error of the form takes it itself (docs/behaviors.md,
  // Accessibility, Announcements).
  useEffect(() => {
    if (failure.form !== undefined) {
      return;
    }
    const field = FIELDS.find((name) => failure.fields[name] !== undefined);
    if (field !== undefined) {
      refs[field].current?.focus();
    }
  }, [failure, refs]);
  const changed =
    input.url !== initial.url ||
    input.title !== initial.title ||
    input.type !== initial.type ||
    input.description !== initial.description;
  const { close, question } = useDiscardQuestion({
    held: changed && !busy,
    consequence:
      mode.kind === "add"
        ? "The reference that you entered isn't added."
        : "Your changes to this reference aren't saved.",
    onDiscard: onClose,
  });
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }

  const change = (field: keyof ReferenceInput) => (value: string) => {
    setInput((current) => ({ ...current, [field]: value }));
  };

  const fail = (error: unknown) => {
    if (!isRequestFailure(error)) {
      setUiFailure({ error });
      return;
    }
    const atAddress = referenceAddressError(error);
    if (atAddress !== undefined) {
      setFailure({ fields: { url: atAddress }, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, FIELDS);
    const presentation = unmatched ? presentChangeFailure(error) : undefined;
    setFailure({
      fields: Object.fromEntries(
        fields.map((field) => [field, MESSAGE_INVALID_VALUE]),
      ),
      form:
        presentation === undefined
          ? undefined
          : {
              message: presentation.message,
              reference: presentation.reference,
              unconfirmed: presentation.unconfirmed,
            },
    });
  };

  const submit = async () => {
    if (busy) {
      return;
    }
    setFailure(NO_FAILURE);
    let data: TicketReferenceUpdate | undefined;
    if (mode.kind === "edit") {
      data = updateBody(initial, input);
      if (data === undefined) {
        onClose();
        return;
      }
    }
    setBusy(true);
    try {
      if (mode.kind === "add") {
        const response = await add.mutateAsync({
          ticketId,
          data: createBody(input),
        });
        onDone(addedText(response), response.data);
      } else if (data !== undefined) {
        const response = await update.mutateAsync({
          ticketId,
          referenceId: mode.reference.id,
          data,
        });
        onDone(changedText(response), response.data);
      }
    } catch (error) {
      fail(error);
    }
    setBusy(false);
  };

  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="form-only"
      title={mode.kind === "add" ? "Add reference" : "Edit reference"}
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
            {mode.kind === "add" ? "Add reference" : "Save"}
          </Button>
          {question}
        </>
      }
    >
      <FirstFieldFocus>
        <Form
          id={formId}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void submit();
          }}
          validationErrors={failure.fields}
          className="flex flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <TextField
            label="Address"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="off"
            isRequired
            value={input.url}
            onChange={change("url")}
            validate={validateAddress}
            inputRef={refs.url}
          />
          <TextField
            label="Title"
            name="title"
            optional
            value={input.title}
            onChange={change("title")}
            validate={validateLength(TITLE_MAX_LENGTH)}
            inputRef={refs.title}
          />
          <SelectField
            label="Type"
            name="type"
            options={
              mode.kind === "add"
                ? [DETECT_OPTION, ...TYPE_OPTIONS]
                : [
                    ...TYPE_OPTIONS,
                    ...(initial.type === "received" &&
                    mode.reference.type !== null
                      ? [
                          {
                            value: "received" as const,
                            label: mode.reference.type,
                          },
                        ]
                      : []),
                  ]
            }
            value={input.type}
            onChange={(value) => {
              setInput((current) => ({ ...current, type: value }));
            }}
            buttonRef={refs.type}
          />
          <TextAreaField
            label="Description"
            name="description"
            optional
            value={input.description}
            onChange={change("description")}
            validate={validateLength(DESCRIPTION_MAX_LENGTH)}
            inputRef={refs.description}
          />
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}

interface DeleteDialogProps {
  ticketId: string;
  reference: TicketReferenceResponse;
  onClose: () => void;
  onDone: (text: string) => void;
}

// Delete, Delete Reference,
// DELETE /api/v1/tickets/{ticket_id}/references/{reference_id}, which asks
// for confirmation, since it cannot be undone in the UI (docs/behaviors.md,
// Confirmation): its question names the reference, and Delete reference, a
// danger button, deletes it. Its error shows at the top of the confirmation,
// which stays open; once Sentinel confirms it, the confirmation closes.
function DeleteDialog({
  ticketId,
  reference,
  onClose,
  onDone,
}: DeleteDialogProps) {
  const deleted = `Reference ${referenceName(reference)} deleted.`;
  const readAgain = useReadAgain(ticketId);
  const remove = useDeleteReference({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      () => deleted,
      readAgain,
    ),
  });
  const [error, setError] = useState<DialogError>();
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  if (uiFailure !== undefined) {
    throw uiFailure.error;
  }
  const confirm = async () => {
    setError(undefined);
    try {
      await remove.mutateAsync({ ticketId, referenceId: reference.id });
      onDone(deleted);
    } catch (failure) {
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
  return (
    <ConfirmationDialog
      isOpen
      onCancel={onClose}
      title={`${DELETE} ${referenceName(reference)}?`}
      action={DELETE}
      onConfirm={() => {
        void confirm();
      }}
      isBusy={remove.isPending}
      error={error}
    >
      {"The reference is removed from this Ticket. This can't be undone."}
    </ConfirmationDialog>
  );
}

// A reference that Delete deletes, with its place in the table, which the
// focus takes once a read no longer returns it (useRowFocusAfterRemoval).
interface Removed {
  reference: TicketReferenceResponse;
  index: number;
}

// The identifier of a reference, which identifies its row.
function referenceId(reference: TicketReferenceResponse): string {
  return reference.id;
}

// The Delete of the row of a reference, which takes the focus after Delete
// of the row before it, or null without one.
function deleteIn(row: HTMLElement): HTMLElement | null {
  return row.querySelector<HTMLElement>(`button[aria-label^="${DELETE}"]`);
}

// ----------------------------------------------------------------------------
// The filters

// The values of the type filter: the types of the contract, and
// uncategorized for a reference without a type. List References returns
// every reference of the Ticket at once, without pages (Sentinel
// docs/features/tickets/ticket-references.md, List References), so the tab
// filters the references that it shows itself, also by a set of types and by
// the absence of one, which the filters of List References do not take.
const TYPE_FILTERS = [
  "advisory",
  "patch",
  "issue",
  "article",
  "uncategorized",
] as const satisfies readonly (ReferenceTypeValue | "uncategorized")[];

const TYPE_FILTER_OPTIONS: readonly FilterOption<
  (typeof TYPE_FILTERS)[number]
>[] = TYPE_FILTERS.map((value) => ({
  value,
  label: value === "uncategorized" ? typeName(null) : typeName(value),
}));

// The source filter: one source, as Sentinel records it, at most as long as
// it records one (same document, TicketReference), without U+0000.
const sourceParam = z
  .string()
  .min(1)
  .max(100)
  .refine((source) => !source.includes("\u0000"))
  .optional()
  .catch(undefined);

const referencesSearch = z.object({
  type: valueListParam(TYPE_FILTERS),
  source: sourceParam,
});

type ReferencesSearch = z.output<typeof referencesSearch>;

// The number of the filters that apply.
function filtersApplied(search: ReferencesSearch): number {
  return [search.type, search.source].filter((value) => value !== undefined)
    .length;
}

// Whether a reference matches the filters: one of the types chosen, a
// reference without a type matching Uncategorized and one of a type that the
// pinned contract does not list matching none (docs/behaviors.md, Unknown
// Values); and the source chosen.
function matches(
  reference: TicketReferenceResponse,
  search: ReferencesSearch,
): boolean {
  const type = reference.type ?? "uncategorized";
  return (
    (search.type === undefined ||
      search.type.some((value) => value === type)) &&
    (search.source === undefined || reference.source === search.source)
  );
}

// The value of the source filter without one.
const ANY_SOURCE = "";

// The sources of the references of the Ticket, as options of the filter:
// Manual first, then the others by their name.
function sourceOptions(
  references: readonly TicketReferenceResponse[],
): SelectOption<string>[] {
  // Only the sources that the pinned contract lists (docs/behaviors.md,
  // Unknown Values); a reference of another source shows in the table, and
  // a URL can still name its source.
  const sources = [
    ...new Set(references.map((reference) => reference.source)),
  ].filter((source) => source === MANUAL || CVE_FETCHER_NAMES.has(source));
  return sources
    .map((source) => ({
      value: source,
      text: sourceName(source),
      label: sourceName(source),
    }))
    .toSorted((first, second) => {
      if (first.value === MANUAL || second.value === MANUAL) {
        return first.value === MANUAL ? -1 : 1;
      }
      return first.text.localeCompare(second.text, "en");
    });
}

// What the tab shows after a change of the filters, in words, which
// assistive technologies announce: the references that match, or the line
// in their place.
function resultText(shown: number, all: number): string {
  if (all === 0) {
    return NO_REFERENCES;
  }
  if (shown === 0) {
    return NO_MATCH;
  }
  return `${COUNT.format(shown)} ${shown === 1 ? "reference" : "references"}`;
}

const NO_MATCH = "No references match the filters.";
const NO_REFERENCES = "No references.";

// ----------------------------------------------------------------------------
// The tab

// The references of the Ticket, from List References,
// GET /api/v1/tickets/{ticket_id}/references, in the order of the API, by
// type, then by the time they were added (Sentinel
// docs/features/tickets/ticket-references.md, List References): at the end
// of the toolbar above them, Add reference for a user who holds
// manage_references, then Filters, by type and by source, and Clear filters
// while a filter applies, which comes last, so that it moves no other
// control to another row as it appears (docs/design-system.md, Lists);
// then the references that match the filters as a table across the width of
// the tab (docs/design-system.md, Tables; Lists), "No references match the
// filters." with Clear filters inside its frame when none matches, or "No
// references." without any. A change of the filters announces what the table
// shows. The read shows at once with the
// tabs, and its failure once the Ticket has arrived, so that a Ticket that
// the user cannot see shows Not found (docs/behaviors.md, Loading; Where
// Errors Appear). The outcome of a change is announced once a read of the
// references after it arrives, whatever its outcome. The focus follows
// docs/behaviors.md (Accessibility, Focus after an action): after Delete, it
// moves to the Delete of the row that takes its place, or to that row when
// it has none, or to Add reference when no row follows; and when a read
// removes the row that holds it, or an Edit takes that row out of the
// filters, it moves to the screen's heading. A row that a read moves, as
// after an Edit that changes the type, which orders the rows, keeps it.
function TicketReferences() {
  const { ticketId } = ticketReferencesRoute.useParams();
  const user = useSignedInUser();
  const manages = user?.capabilities.includes("manage_references") === true;
  const ticketShown =
    useGetTicket(ticketId, { query: { enabled: false } }).data !== undefined;
  const read = useListReferences(ticketId);
  const search = ticketReferencesRoute.useSearch();
  const navigate = useNavigate();
  // Whether the tab is still on the page as a change ends: once the user
  // has left it, the change shows its outcome itself (useChangeOutcome).
  const mounted = useMounted();
  const place = dataPlace(read);
  const all = place.data?.data;
  const rows = useMemo(
    () => all?.filter((reference) => matches(reference, search)),
    [all, search],
  );
  const applied = filtersApplied(search);
  const failure = ticketShown ? place.failure : null;
  const waiting = place.waiting || (place.failure !== null && !ticketShown);

  const [dialog, setDialog] = useState<DialogMode>();
  const [deleting, setDeleting] = useState<Removed>();
  const add = useRef<HTMLDivElement>(null);
  const references = useRef<HTMLDivElement>(null);
  // The outcome of a change, which the tab announces once a read of the
  // references after it arrives, or shows in the message area, naming the
  // Ticket once the user has left the tab (useOutcomeAfterRead).
  const record = useMemo(() => ticketRecord(ticketId), [ticketId]);
  const outcome = useOutcomeAfterRead(read, record);
  // The focus when the row that holds it leaves the table: after Delete, to
  // the Delete of the row that takes its place, or to that row without one,
  // or to Add reference when no row follows; otherwise, as when a read
  // removes it or an Edit takes it out of the filters, to the screen's
  // heading (useRowFocusAfterRemoval).
  const fallback = useCallback(() => add.current?.querySelector("button"), []);
  const rowFocus = useRowFocusAfterRemoval({
    container: references,
    rows,
    rowId: referenceId,
    attribute: "data-reference-id",
    control: deleteIn,
    fallback,
    read,
  });

  const actions = useMemo<RowActions | undefined>(
    () =>
      manages
        ? {
            edit: (reference) => {
              setDialog({ kind: "edit", reference });
            },
            remove: (reference, index) => {
              setDeleting({ reference, index });
            },
          }
        : undefined,
    [manages],
  );
  const columns = useMemo(
    () => columnsOf(rows ?? [], actions),
    [rows, actions],
  );

  const refine = (change: Partial<ReferencesSearch>) => {
    void navigate({
      to: "/tickets/$ticketId/references",
      params: { ticketId },
      search: (previous) => ({ ...previous, ...change }),
    });
  };
  const clearFilters = () => {
    void navigate({
      to: "/tickets/$ticketId/references",
      params: { ticketId },
      search: {},
    });
  };
  // A change of the filters announces what the table shows; the tab as it
  // opens does not (docs/behaviors.md, Accessibility, Focus after a
  // navigation).
  const key = stringifySearch(search);
  const [openedAt] = useState(key);
  const [changed, setChanged] = useState(false);
  if (!changed && key !== openedAt) {
    setChanged(true);
  }
  // What the tab shows after the change of the filters, as it shows it
  // then: a later change of the references, such as a Delete, announces its
  // own outcome, not the result of the filters again.
  const [result, setResult] = useState<{ key: string; text: string }>();
  if (
    changed &&
    rows !== undefined &&
    all !== undefined &&
    result?.key !== key
  ) {
    setResult({ key, text: resultText(rows.length, all.length) });
  }
  const filtered = result?.key === key ? result.text : "";
  const filtersStatus = read.status === "error" ? placeMessage(read) : filtered;
  const sources = sourceOptions(all ?? []);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {manages && (
          <div ref={add}>
            <Button
              size="small"
              icon={Plus}
              onPress={() => {
                setDialog({ kind: "add" });
              }}
            >
              Add reference
            </Button>
          </div>
        )}
        <Filters
          applied={applied}
          status={<span key={key}>{filtersStatus}</span>}
        >
          <FilterGroup
            label="Type"
            options={TYPE_FILTER_OPTIONS}
            selected={search.type ?? []}
            onChange={(values) => {
              refine({ type: values.length === 0 ? undefined : values });
            }}
          />
          <FilterSelect
            label="Source"
            groups={[
              [{ value: ANY_SOURCE, text: "Any source", label: "Any source" }],
              sources,
            ]}
            status={
              all === undefined ? (
                <OptionsStatus>
                  {read.status === "error" ? (
                    <p>{placeMessage(read)}</p>
                  ) : (
                    <Loading inValue />
                  )}
                </OptionsStatus>
              ) : null
            }
            selected={search.source ?? ANY_SOURCE}
            unlisted={sourceName(search.source ?? "")}
            onChange={(source) => {
              refine({ source: source === ANY_SOURCE ? undefined : source });
            }}
          />
        </Filters>
        {applied > 0 && (
          <FocusHandOff>
            <Button variant="quiet" size="small" onPress={clearFilters}>
              <X aria-hidden className="size-4" />
              Clear filters
            </Button>
          </FocusHandOff>
        )}
      </div>
      <div ref={references} className="relative">
        {place.updating && <UpdatingBar />}
        <output className="block">{failure ?? place.warning}</output>
        {all === undefined || rows === undefined ? (
          waiting && <Loading />
        ) : all.length === 0 ? (
          // A key of each place, so that the one that leaves the page hands
          // the focus off, rather than taking the content of the other.
          <FocusHandOff key="empty">
            <p className="text-fg-muted">No references.</p>
          </FocusHandOff>
        ) : (
          <FramedTable
            key="rows"
            label="References"
            columns={columns}
            rows={rows}
            rowId={referenceId}
            empty={
              <EmptyState
                message={NO_MATCH}
                action={
                  <Button onPress={clearFilters}>
                    <X aria-hidden className="size-4" />
                    Clear filters
                  </Button>
                }
              />
            }
          />
        )}
      </div>
      {/* What the tab shows after a change of the filters, also one that
          Clear filters or the browser history makes, outside the popover
          (docs/behaviors.md, Accessibility, Focus after a navigation); and
          the outcome of a change. */}
      <output className="sr-only">
        <span key={key}>{filtered}</span>
      </output>
      {outcome.region}
      {dialog !== undefined && (
        <ReferenceDialog
          ticketId={ticketId}
          mode={dialog}
          onClose={() => {
            setDialog(undefined);
          }}
          onDone={(text, reference) => {
            if (!mounted.current) {
              return;
            }
            setDialog(undefined);
            // The dialog returns the focus to the Edit that opened it as it
            // closes (docs/behaviors.md, Accessibility, Dialogs), so its row
            // holds the focus from now on, also before React Aria has
            // returned it: a read that takes the row away meanwhile moves the
            // focus to the screen's heading.
            if (dialog.kind === "edit") {
              rowFocus.holds(dialog.reference.id);
            }
            // A reference that the filters hide shows nowhere where the user
            // acted, so its outcome shows in the message area
            // (docs/behaviors.md, Outcome of a Change), also once the next
            // read has arrived, after the dialog has given the page back to
            // assistive technologies.
            outcome.after(text, !matches(reference, search));
          }}
        />
      )}
      {deleting !== undefined && (
        <DeleteDialog
          ticketId={ticketId}
          reference={deleting.reference}
          onClose={() => {
            setDeleting(undefined);
          }}
          onDone={(text) => {
            if (!mounted.current) {
              return;
            }
            rowFocus.deleted(deleting.reference.id, deleting.index);
            setDeleting(undefined);
            outcome.after(text);
          }}
        />
      )}
    </>
  );
}

// The tab References, at its path under the path of the Ticket. A URL with a
// search parameter that it does not accept, or with a value that it does not
// accept or gives in another form, leads to the URL that it gives that state,
// in place of the URL in the browser history (docs/behaviors.md, Invalid
// Search Parameters; docs/screen-map.md, Browser History).
export const ticketReferencesRoute = createRoute({
  getParentRoute: () => ticketRoute,
  path: "references",
  validateSearch: referencesSearch,
  beforeLoad: ({ location, params }) => {
    // The router's search of the route also passes on every parameter of the
    // URL that the schema does not declare, so the schema reads the URL
    // itself.
    const accepted = referencesSearch.parse(location.search);
    if (!sameSearch(location.search, accepted)) {
      throw redirect({
        to: "/tickets/$ticketId/references",
        params,
        search: accepted,
        hash: location.hash,
        replace: true,
      });
    }
  },
  component: TicketReferences,
});
