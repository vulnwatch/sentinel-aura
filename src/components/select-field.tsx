import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import {
  Button as AriaButton,
  Label,
  ListBox,
  Popover,
  Select,
  SelectValue,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { Option, OPTIONS_POPOVER } from "./options";
import { FieldErrorMessage } from "./text-field";

export interface FieldOption<T extends string> {
  // The value that the field holds when the option is chosen.
  value: T;
  // Its label, which the field shows once it is chosen.
  label: string;
}

interface SelectFieldProps<T extends string> {
  // The label above the field.
  label: string;
  // The name of the field in its form, by which an error of the form finds
  // it.
  name: string;
  options: readonly FieldOption<T>[];
  // The option chosen.
  value: T;
  onChange: (value: T) => void;
  // The button of the field, which a form focuses when the field has an
  // error.
  buttonRef?: Ref<HTMLButtonElement>;
}

// A select of a form (docs/design-system.md, Forms): its label above it, in
// text-15, weight 500, then a field-like button 40 px high that shows the
// option chosen and ends with chevron-down, which opens the options below it
// as a menu, at least as wide as the button, each 36 px high with check at
// its end when it is chosen; and its error after it, as the error of every
// field of a form.
export function SelectField<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  buttonRef,
}: SelectFieldProps<T>) {
  return (
    <Select
      name={name}
      value={value}
      onChange={(key) => {
        const option = options.find((item) => item.value === key);
        if (option !== undefined) {
          onChange(option.value);
        }
      }}
      className="group/select flex flex-col gap-1.5"
    >
      <Label className="text-15 font-medium">{label}</Label>
      <AriaButton
        ref={buttonRef}
        className={`flex h-10 items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-4 text-start text-15 text-fg group-data-invalid/select:border-2 group-data-invalid/select:border-danger-icon group-data-invalid/select:px-3.75 ${FOCUS_RING}`}
      >
        <SelectValue className="flex min-w-0 items-center">
          {({ selectedText }) => (
            <span className="truncate">{selectedText}</span>
          )}
        </SelectValue>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-muted" />
      </AriaButton>
      <FieldErrorMessage />
      <Popover offset={4} className={OPTIONS_POPOVER}>
        <ListBox className="outline-none">
          {options.map((option) => (
            <Option
              key={option.value}
              id={option.value}
              textValue={option.label}
            >
              {option.label}
            </Option>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
