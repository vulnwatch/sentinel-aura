import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Form } from "react-aria-components";
import {
  isRequestFailure,
  MESSAGE_INVALID_VALUE,
  presentChangeFailure,
  validationErrorFields,
  type RequestFailure,
} from "../../api/errors";
import { Button } from "../../components/button";
import { useMounted } from "../../components/change-outcome";
import { useDiscardQuestion } from "../../components/discard-question";
import { useFieldErrorFocus } from "../../components/field-error-focus";
import {
  DialogErrorMessage,
  FirstFieldFocus,
  ModalDialog,
  type DialogError,
} from "../../components/modal-dialog";
import {
  chosenOrFirstRadio,
  RadioGroupField,
  type RadioOption,
} from "../../components/radio-group";

// The dialog of a change of Actions (src/routes/ticket/actions.tsx) whose
// form is one group of radio buttons, which Ignore…, Override priority…, and
// Set severity… share (docs/screens/ticket.md, Actions; States): each keeps
// its texts, its options, its change, and the outcome of its change.

// What a submission that failed shows: the error of the group, and the error
// at the top of the form.
interface FormFailure {
  field: string | undefined;
  form: DialogError | undefined;
}

const NO_FAILURE: FormFailure = { field: undefined, form: undefined };

interface ChoiceDialogProps<T extends string> {
  // The title, which names the dialog, such as "Ignore SNTL-31".
  title: string;
  // What the change does, in fg-muted, above the form.
  intro: ReactNode;
  // What shows between that text and the form, such as the automatic
  // priority with its basis.
  beforeForm?: ReactNode;
  // The label of the group.
  label: string;
  // The name of the group, the member of the request body that sends the
  // choice, at which a field error of a VALIDATION_ERROR for that member
  // shows.
  name: string;
  options: readonly RadioOption<T>[];
  // The choice with which the dialog opens, or undefined for none, as in
  // Ignore… or for a value that the pinned contract does not list
  // (docs/behaviors.md, Unknown Values). The dialog keeps the one of its
  // first render until it closes, also when a read meanwhile shows another
  // value: its action with that choice closes it without a request.
  openedWith: T | undefined;
  // The error at the group when the form is submitted without a choice,
  // such as "Choose a reason.".
  emptyMessage: string;
  // The consequence that the question before discarding another choice
  // states, such as "SNTL-31 isn't ignored.".
  discardConsequence: string;
  // The label of the primary button, which submits the form.
  action: string;
  // Sends the choice: the change, whose hook gives the outcome of a change
  // that ends after the user left the screen (useChangeOutcome).
  submit: (choice: T) => Promise<unknown>;
  // The error at the group of a failure that its screen document handles
  // there, or undefined for every other failure.
  fieldError?: (failure: RequestFailure) => string | undefined;
  // The error at the top of the form of every other failure, by default in
  // the presentation of a change, or undefined for a failure that shows
  // nothing there, such as a 401.
  presentFailure?: (failure: RequestFailure) => DialogError | undefined;
  onClose: () => void;
}

// A dialog at most 560 px wide (docs/design-system.md, Dialogs): the title;
// what the change does, in fg-muted, and what follows it; then the group of
// radio buttons, in a form (docs/design-system.md, Forms), whose chosen
// option takes the focus as the dialog opens, or its first option without a
// choice; then Cancel and the action, a primary button. The form checks that
// a choice is made before it sends it, and the action with the choice with
// which the dialog opened closes it without a request (docs/screens/ticket.md,
// Actions, Forms). The errors at the group, of the check, of a code that the
// dialog handles there, and of a field error of a VALIDATION_ERROR for its
// member, show until another choice is made, and the chosen option, or the
// first one without a choice, takes the focus, or the error is announced
// when that option holds the focus already, as after Enter on it; every
// other failure shows at the top of the form, which takes the focus, as a
// warning when Sentinel did not confirm the change (docs/behaviors.md, Where
// Errors Appear; Retries and Unconfirmed Changes; Accessibility,
// Announcements). The change asks for no confirmation, since another change
// reverses it (docs/behaviors.md, Confirmation): with input, another choice
// than the one with which the dialog opened, Cancel, Escape, and every
// navigation of the UI ask "Discard changes?" first. While the change is in
// progress, the dialog cannot be closed, and the choice, read-only, keeps its
// look and the focus.
export function ChoiceDialog<T extends string>({
  title,
  intro,
  beforeForm,
  label,
  name,
  options,
  openedWith,
  emptyMessage,
  discardConsequence,
  action,
  submit,
  fieldError,
  presentFailure = presentChangeFailure,
  onClose,
}: ChoiceDialogProps<T>) {
  const mounted = useMounted();
  const formId = useId();
  const group = useRef<HTMLDivElement>(null);
  const [opened] = useState(openedWith);
  const [choice, setChoice] = useState<T | undefined>(opened);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<FormFailure>(NO_FAILURE);
  // A failure of the UI itself, which the router shows (src/router.ts).
  const [uiFailure, setUiFailure] = useState<{ error: unknown }>();
  const submitting = useRef(false);
  // With an error at the group alone, the chosen option takes the focus, or
  // the first one without a choice, once the error is on the page, so that
  // it is read with it, or the error is announced when that option holds the
  // focus already (useFieldErrorFocus).
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
    consequence: discardConsequence,
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
    const atField = fieldError?.(error);
    if (atField !== undefined) {
      setFailure({ field: atField, form: undefined });
      return;
    }
    const { fields, unmatched } = validationErrorFields(error, [name]);
    setFailure({
      field: fields.length > 0 ? MESSAGE_INVALID_VALUE : undefined,
      form: unmatched ? presentFailure(error) : undefined,
    });
  };

  const send = async () => {
    if (submitting.current) {
      return;
    }
    if (choice === undefined) {
      setFailure({ field: emptyMessage, form: undefined });
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
      await submit(choice);
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
      title={title}
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
            {action}
          </Button>
          {question}
        </>
      }
    >
      <p className="text-fg-muted">{intro}</p>
      {beforeForm}
      <FirstFieldFocus>
        <Form
          id={formId}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void send();
          }}
          validationErrors={
            failure.field === undefined ? undefined : { [name]: failure.field }
          }
          className="mt-4 flex max-w-112 flex-col gap-3"
        >
          {failure.form !== undefined && (
            <DialogErrorMessage error={failure.form} />
          )}
          <RadioGroupField<T>
            label={label}
            name={name}
            options={options}
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
