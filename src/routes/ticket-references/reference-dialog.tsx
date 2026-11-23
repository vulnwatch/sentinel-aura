import { createRef, useEffect, useId, useState, type FormEvent } from "react";
import { Form } from "react-aria-components";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  referenceAddressError,
  validationErrorFields,
} from "../../api/errors";
import {
  ReferenceTypeValue,
  type TicketReferenceCreate,
  type TicketReferenceDataResponse,
  type TicketReferenceResponse,
  type TicketReferenceUpdate,
} from "../../api/generated/model";
import {
  useAddReference,
  useUpdateReference,
} from "../../api/generated/ticket-references";
import { Button } from "../../components/button";
import { useChangeOutcome } from "../../components/change-outcome";
import { COUNT } from "../../components/count";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { SelectField, type FieldOption } from "../../components/select-field";
import { TextAreaField, TextField } from "../../components/text-field";
import { addressText, WebAddress } from "../../components/web-link";
import { ticketRecord } from "../ticket";
import { referenceName, typeName, useReadAgain } from "./shared";

// The dialog of Add reference and Edit reference of the tab References
// (src/routes/ticket-references.tsx), with its input, its checks, and the
// outcomes of its changes.

// The longest values that the contract accepts, in characters, as Sentinel
// counts them, by code point (Sentinel
// docs/features/tickets/ticket-references.md, API Schemas).
const ADDRESS_MAX_LENGTH = 2048;
const TITLE_MAX_LENGTH = 500;
const DESCRIPTION_MAX_LENGTH = 2000;

// The length of a text as Sentinel counts it, by code point.
function characters(value: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- the code points are what Sentinel counts, as Python's len does
  return [...value].length;
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
export type DialogMode =
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
export function ReferenceDialog({
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
  // focus, or its error is announced when it holds the focus already, as
  // after Enter in it, also when the checks of the form stop it; the error
  // of the form takes it itself (docs/behaviors.md, Accessibility,
  // Announcements).
  const { focusField, formRef, region } = useFieldErrorFocus();
  useEffect(() => {
    if (failure.form !== undefined) {
      return;
    }
    const field = FIELDS.find((name) => failure.fields[name] !== undefined);
    const error = field === undefined ? undefined : failure.fields[field];
    if (field !== undefined && error !== undefined) {
      focusField(refs[field].current, error);
    }
  }, [failure, refs, focusField]);
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
          ref={formRef}
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
          {region}
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}
