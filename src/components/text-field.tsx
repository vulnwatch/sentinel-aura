import { CircleAlert } from "lucide-react";
import type { Ref } from "react";
import {
  FieldError,
  Input,
  Label,
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
};

export type TextFieldProps = FieldProps & {
  // The input element, which a form focuses when the field has an error.
  inputRef?: Ref<HTMLInputElement>;
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

// The error of a field, after circle-alert at 14 px, in text-13, weight 500,
// danger-on-soft, which assistive technologies read with the control.
export function FieldErrorMessage() {
  return (
    <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
      {({ validationErrors }) => (
        <>
          <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
          <span>{validationErrors.join(" ")}</span>
        </>
      )}
    </FieldError>
  );
}

// A single-line field of a form (docs/design-system.md, Forms): its label
// above it, the control, and its error after it, which assistive technologies
// read with the control. A form that its fields validate checks them when the
// user submits it.
export function TextField({
  label,
  optional = false,
  inputRef,
  ...props
}: TextFieldProps) {
  return (
    <AriaTextField {...props} className="flex flex-col gap-1.5">
      <FieldLabel label={label} optional={optional} />
      <Input ref={inputRef} className={`h-10 ${CONTROL}`} />
      <FieldErrorMessage />
    </AriaTextField>
  );
}

// A multi-line field of a form, at least 88 px high, three lines of text,
// which the user can make taller (docs/design-system.md, Forms), with its
// label and its error as a single-line field has them.
export function TextAreaField({
  label,
  optional = false,
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
      <FieldErrorMessage />
    </AriaTextField>
  );
}
