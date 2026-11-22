import { CircleAlert } from "lucide-react";
import type { ReactNode, Ref } from "react";
import {
  FieldError,
  Input,
  Label,
  Text,
  TextArea,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

type FieldProps = Omit<
  AriaTextFieldProps,
  "className" | "style" | "children"
> & {
  // The label above the field.
  label: string;
  // Whether the field may stay empty, which its label states.
  optional?: boolean;
  // What the field takes, which follows the control (docs/design-system.md,
  // Forms).
  description?: string;
};

export type TextFieldProps = FieldProps & {
  // The input element, which a form focuses when the field has an error.
  inputRef?: Ref<HTMLInputElement>;
  // Whether the value is one that users copy character by character, such
  // as a CVSS vector, which shows in monospace (docs/design-system.md,
  // Font).
  monospace?: boolean;
  // The error of the field, which the form holds, or undefined. A field with
  // one shows it until the form takes it away, as once the input changes,
  // whatever the focus does: React Aria clears an error that a form gives a
  // field by its name once the field commits its value, which a text field
  // does on its change event, as it loses the focus after its value changed.
  // A field whose form gives none takes its errors from the form and from
  // its own checks, as React Aria shows them. An error can hold a link, such
  // as to the record that it names.
  error?: ReactNode;
};

export type TextAreaFieldProps = FieldProps & {
  // The text area, which a form focuses when the field has an error.
  inputRef?: Ref<HTMLTextAreaElement>;
};

// The control of a field: 40 px high, or at least 88 px for three lines of
// text, on surface, with a border-strong boundary, a 6 px radius, and 16 px
// of side padding; with an error, a 2 px boundary in danger-icon.
const CONTROL = `rounded-md border border-border-strong bg-surface px-4 text-15 text-fg data-invalid:border-2 data-invalid:border-danger-icon data-invalid:px-3.75 ${FOCUS_RING}`;

interface FieldLabelProps {
  label: string;
  optional: boolean;
}

// The label of a field, in text-15, weight 500, followed by " (optional)" in
// fg-muted, at weight 400, for a field that may stay empty.
function FieldLabel({ label, optional }: FieldLabelProps) {
  return (
    <Label className="text-15 font-medium">
      {label}
      {optional && (
        <span className="font-normal text-fg-muted"> (optional)</span>
      )}
    </Label>
  );
}

// The description of a field, in text-13, fg-muted, after the control, which
// assistive technologies read with it.
function FieldDescription({ text }: { text: string | undefined }) {
  return text === undefined ? null : (
    <Text slot="description" className="text-13 text-fg-muted">
      {text}
    </Text>
  );
}

// The error of a field, after circle-alert at 14 px, in text-13, weight 500,
// danger-on-soft, which assistive technologies read with the control: the
// error that the form holds, which can hold a link, or otherwise the errors
// that React Aria shows.
export function FieldErrorMessage({ error }: { error?: ReactNode }) {
  return (
    <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
      {({ validationErrors }) => (
        <>
          <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
          <span>{error ?? validationErrors.join(" ")}</span>
        </>
      )}
    </FieldError>
  );
}

// What a field with the error that its form holds gives React Aria: the
// error alone decides whether the field is invalid, and leaves the
// browser's own checks of the form untouched.
function heldError(error: ReactNode) {
  return error === undefined
    ? {}
    : { isInvalid: true, validationBehavior: "aria" as const };
}

// A single-line field of a form (docs/design-system.md, Forms): its label
// above it, the control, its description and its error after it, which
// assistive technologies read with the control. A form that its fields validate checks them when the
// user submits it.
export function TextField({
  label,
  optional = false,
  description,
  inputRef,
  monospace = false,
  error,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField
      {...props}
      {...heldError(error)}
      className="flex flex-col gap-1.5"
    >
      <FieldLabel label={label} optional={optional} />
      <Input
        ref={inputRef}
        className={`h-10 ${monospace ? "font-mono" : ""} ${CONTROL}`}
      />
      <FieldDescription text={description} />
      <FieldErrorMessage error={error} />
    </AriaTextField>
  );
}

// A multi-line field of a form, at least 88 px high, three lines of text,
// which the user can make taller (docs/design-system.md, Forms), with its
// label and its error as a single-line field has them.
export function TextAreaField({
  label,
  optional = false,
  description,
  inputRef,
  ...props
}: TextAreaFieldProps) {
  return (
    <AriaTextField {...props} className="flex flex-col gap-1.5">
      <FieldLabel label={label} optional={optional} />
      <TextArea
        ref={inputRef}
        rows={3}
        className={`min-h-22 resize-y py-2 data-invalid:py-1.75 ${CONTROL}`}
      />
      <FieldDescription text={description} />
      <FieldErrorMessage />
    </AriaTextField>
  );
}
