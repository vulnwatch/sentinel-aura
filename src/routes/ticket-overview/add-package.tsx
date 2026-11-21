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
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  packageNameError,
  presentAddPackageFailure,
  presentLeftAddPackageFailure,
  validationErrorFields,
} from "../../api/errors";
import { useSearchMaintainedPackageNames } from "../../api/generated/maintained-packages";
import type {
  MaintainedPackageItem,
  PackageAdditionResponse,
} from "../../api/generated/model";
import { useAddTicketPackage } from "../../api/generated/ticket-packages";
import { Button } from "../../components/button";
import { useChangeOutcome } from "../../components/change-outcome";
import { useDiscardQuestion } from "../../components/discard-question";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import {
  characters,
  COUNT,
  FreeTextComboBox,
  useSearchTerm,
} from "../../components/search-combobox";
import { ticketRecord } from "../ticket";
import { useReadAfterTicketChange } from "./shared";

// Add package, Add Package to Ticket, POST /api/v1/tickets/{ticket_id}/packages,
// in the package tree (src/routes/ticket-overview/packages.tsx): a dialog
// whose content is a form alone, with the name of the package, which the
// names that SMELT maintains help to find (Sentinel
// docs/features/packages/package-model.md, Add Package to Ticket; Sentinel
// docs/features/packages/maintained-package-names.md, Search Maintained
// Packages).

// The name of a package as Add Package to Ticket takes it: 1 to 255
// characters, the first a letter or a digit, then letters, digits, ".", "_",
// "+", and "-", as the pinned OpenAPI document publishes it (Sentinel
// docs/api-spec.md, Published Input Constraints).
const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._+-]{0,254}$/;
const NAME_MAX_LENGTH = 255;

// The most names that the field suggests for a term, those that start with
// it first; a longer term narrows them.
const SUGGESTED_NAMES = 20;

// The check of a name, without its surrounding whitespace, before it is sent.
export function nameError(name: string): string | null {
  if (name === "") {
    return "Enter the package name.";
  }
  if (characters(name) > NAME_MAX_LENGTH) {
    return `Enter at most ${COUNT.format(NAME_MAX_LENGTH)} characters.`;
  }
  return NAME_PATTERN.test(name)
    ? null
    : "Enter only letters, digits, and . _ + -, starting with a letter or a digit.";
}

// What a count of the outcome says, such as "1 track" or "7 Products".
function counted(count: number, one: string, several: string): string {
  return `${COUNT.format(count)} ${count === 1 ? one : several}`;
}

// The outcome of an addition, from the counts that Sentinel returns, which
// say what it created and not whether the package is new: "Package
// fictional-openssl: 3 tracks and 7 Products added.", or, when it created
// nothing, that the package already has what Sentinel finds for it in SMELT,
// which skips the codestreams that it does not support and the Products that
// its catalog lacks (Sentinel docs/features/packages/package-model.md, SMELT
// Query for Package Resolution). Sentinel can add
// maintainers also then (Sentinel docs/features/packages/package-model.md,
// Adding Packages to a Ticket), so the outcome does not say that nothing
// changed.
export function addedText({ data }: PackageAdditionResponse): string {
  const created = [
    ...(data.tracks_created > 0
      ? [counted(data.tracks_created, "track", "tracks")]
      : []),
    ...(data.products_created > 0
      ? [counted(data.products_created, "Product", "Products")]
      : []),
  ];
  return created.length === 0
    ? `Package ${data.package_name} already has every track and Product that Sentinel finds for it in SMELT, so none was added.`
    : `Package ${data.package_name}: ${created.join(" and ")} added.`;
}

interface PackageNameFieldProps {
  value: string;
  onChange: (value: string) => void;
  // Whether the name is the one that the addition in progress sends, which
  // the field keeps, without taking input, so that an error of the addition
  // at the field concerns the name that it shows.
  isReadOnly: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  error: string | undefined;
}

// The name of the package, a combobox whose value is the text typed
// (FreeTextComboBox): once the user has typed at least 2 characters without
// their surrounding whitespace and has stopped typing, it reads the first 20
// maintained names that contain them, without regard to letter case, those
// that start with them first, and opens them below it; "Sentinel knows no
// maintained package that matches." when none does, or, below them, how
// many match when more do. Choosing one writes it in the field, with its
// letter case. The field takes a name that it does not suggest, since the
// names only help to find one (Sentinel
// docs/features/packages/maintained-package-names.md, Purpose).
function PackageNameField({
  value,
  onChange,
  isReadOnly,
  inputRef,
  error,
}: PackageNameFieldProps) {
  const search = useSearchTerm(value);
  const read = useSearchMaintainedPackageNames(
    { search: search.term, per_page: SUGGESTED_NAMES },
    { query: { enabled: search.searching } },
  );
  return (
    <FreeTextComboBox<MaintainedPackageItem>
      label="Package name"
      name="package_name"
      description="The source package as SMELT names it, such as fictional-openssl. Type part of it to find it."
      value={value}
      onChange={onChange}
      search={search}
      read={read}
      itemText={({ name }) => name}
      renderItem={({ name }) => name}
      noneText="Sentinel knows no maintained package that matches."
      plural="packages"
      isReadOnly={isReadOnly}
      inputRef={inputRef}
      error={error}
    />
  );
}

// What a submission that failed shows: the error of the field, and the error
// at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

interface AddPackageDialogProps {
  ticketId: string;
  onClose: () => void;
  // Tells that Sentinel confirmed the addition, with its response, while the
  // dialog is on the page, before the reads after it are sent
  // (useChangeOutcome).
  onDone: (response: PackageAdditionResponse) => void;
}

// The dialog of Add package (docs/design-system.md, Dialogs), titled "Add
// package", whose content is a form alone: the name of the package, which
// takes the focus as the dialog opens, then Cancel and Add package, a primary
// button. The form checks the name without its surrounding whitespace before
// it sends it so: required, at most 255 characters, and the pattern of the
// pinned OpenAPI document. A check, a field error of a VALIDATION_ERROR, and
// 422 PACKAGE_NOT_FOUND_IN_SMELT, 422 PACKAGE_TARGETS_UNRESOLVED, and 409
// PACKAGE_ALREADY_EXCLUDED show at the field, which takes the focus, until
// the name changes; every other failure at the top of the form, which takes
// it: 503 SMELT_UNAVAILABLE and 503 PRODUCT_CATALOG_NOT_READY as errors, since
// Sentinel returns them before any change, and the others in the
// presentation of a change, as a warning when Sentinel did not confirm it
// (docs/behaviors.md, Where Errors Appear; Retries and Unconfirmed Changes).
// With a name typed, Cancel, Escape, and every navigation of the UI ask
// "Discard changes?" first (docs/behaviors.md, Confirmation). While the
// addition is in progress, the dialog cannot be closed, and its input counts
// as submitted; the field keeps the name sent, read-only, and its focus.
// Whatever the outcome, the screen reads again what the
// addition affects; one that ends after the user left the screen shows its
// outcome in the message area there, naming the Ticket, and its failure in
// the presentation of the dialog (useChangeOutcome).
export function AddPackageDialog({
  ticketId,
  onClose,
  onDone,
}: AddPackageDialogProps) {
  const readAgain = useReadAfterTicketChange(ticketId);
  // The name that the addition in progress sends, which its failure after the
  // user left the screen names.
  const sent = useRef("");
  const add = useAddTicketPackage({
    mutation: useChangeOutcome(
      ticketRecord(ticketId),
      addedText,
      readAgain,
      onDone,
      (failure) => presentLeftAddPackageFailure(failure, sent.current),
    ),
  });
  const formId = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  // The errors of the field and of the form, a new object for each failure,
  // so that each shows again.
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const [inputRef] = useState(() => createRef<HTMLInputElement>());
  // After a failure with an error of the field alone, the field takes the
  // focus, or its error is announced when it holds the focus already; the
  // error of the form takes it itself (docs/behaviors.md, Accessibility,
  // Announcements).
  const { focusField, region } = useFieldErrorFocus();
  useEffect(() => {
    if (failure.form === undefined && failure.field !== undefined) {
      focusField(inputRef.current, failure.field);
    }
  }, [failure, inputRef, focusField]);
  const { close, question } = useDiscardQuestion({
    held: name.trim() !== "" && !busy,
    consequence: "The package that you entered isn't added.",
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
    const atField = packageNameError(error);
    if (atField !== undefined) {
      setFailure({ field: atField, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, [
      "package_name",
    ]);
    const presentation = unmatched
      ? presentAddPackageFailure(error)
      : undefined;
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form: presentation,
    });
  };

  const submit = async () => {
    if (busy) {
      return;
    }
    const packageName = name.trim();
    const error = nameError(packageName);
    setFailure(error === null ? NO_FAILURE : { field: error, form: undefined });
    if (error !== null) {
      return;
    }
    setBusy(true);
    sent.current = packageName;
    try {
      await add.mutateAsync({ ticketId, data: { package_name: packageName } });
    } catch (failed) {
      fail(failed);
    }
    setBusy(false);
  };

  return (
    <ModalDialog
      isOpen
      onClose={close}
      width="form-only"
      title="Add package"
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
            Add package
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
          className="flex flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <PackageNameField
            value={name}
            onChange={(value) => {
              if (value !== name && failure.field !== undefined) {
                setFailure((current) => ({ ...current, field: undefined }));
              }
              setName(value);
            }}
            isReadOnly={busy}
            inputRef={inputRef}
            error={failure.field}
          />
          {region}
        </Form>
      </FirstFieldFocus>
    </ModalDialog>
  );
}
