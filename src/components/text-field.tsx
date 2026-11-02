import { CircleAlert } from "lucide-react";
import type { Ref } from "react";
import {
  FieldError,
  Input,
  Label,
  TextField as AriaTextField,
  type TextFieldProps as AriaTextFieldProps,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";

export type TextFieldProps = Omit<
  AriaTextFieldProps,
  "className" | "style" | "children"
> & {
  // The label above the field.
  label: string;
  // The input element, which a form focuses when the field has an error.
  inputRef?: Ref<HTMLInputElement>;
};

// A single-line field of a form (docs/design-system.md, Forms): its label
// above it, the control, and its error after it, which assistive technologies
// read with the control. A form that its fields validate checks them when the
// user submits it.
export function TextField({ label, inputRef, ...props }: TextFieldProps) {
  return (
    <AriaTextField {...props} className="flex flex-col gap-1.5">
      <Label className="text-15 font-medium">{label}</Label>
      <Input
        ref={inputRef}
        className={`h-10 rounded-md border border-border-strong bg-surface px-4 text-15 text-fg data-invalid:border-2 data-invalid:border-danger-icon data-invalid:px-3.75 ${FOCUS_RING}`}
      />
      <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
        {({ validationErrors }) => (
          <>
            <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
            <span>{validationErrors.join(" ")}</span>
          </>
        )}
      </FieldError>
    </AriaTextField>
  );
}
