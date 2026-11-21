import { useId, type Ref } from "react";
import { Label, Radio, RadioGroup } from "react-aria-components";
import { FieldErrorMessage } from "./text-field";

export interface RadioOption<T extends string> {
  // The value that the group holds when the option is chosen.
  value: T;
  // Its label, which follows its button.
  label: string;
  // What the option means, below its label.
  description: string;
}

interface RadioGroupFieldProps<T extends string> {
  // The label above the group.
  label: string;
  // The name of the field, by which a form gives it its error.
  name: string;
  options: readonly RadioOption<T>[];
  // The option chosen, or undefined before the user chooses one.
  value: T | undefined;
  onChange: (value: T) => void;
  // Whether the choice cannot change, as while the change that sends it is
  // in progress: the options keep their look and the focus.
  isReadOnly?: boolean | undefined;
  // The element of the group, which a form searches for the button that
  // takes the focus with an error.
  groupRef?: Ref<HTMLDivElement> | undefined;
}

// A field of a form that chooses one value among a few whose meanings the
// user reads before choosing, such as the reason of an ignored Ticket
// (docs/design-system.md, Forms): its label above it, in text-15, weight
// 500; then its options, 12 px apart, each a radio button of 16 px, round,
// with a border-strong boundary, and when chosen an accent fill with a dot
// of 6 px in on-accent; 8 px after it its label in text-15, and below the
// label its meaning in text-13, fg-muted. The button, its label, and its
// meaning are one target, and the focus ring goes around the button on
// keyboard focus. Assistive technologies read the label as the name of the
// option and its meaning as its description; the arrow keys move between
// the options. Its error follows the options, as a field's does, and gives
// each button a 2 px boundary in danger-icon. Read-only, it keeps its look.
export function RadioGroupField<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  isReadOnly = false,
  groupRef,
}: RadioGroupFieldProps<T>) {
  const id = useId();
  return (
    <RadioGroup
      ref={groupRef}
      name={name}
      value={value ?? null}
      onChange={(next) => {
        const option = options.find((item) => item.value === next);
        if (option !== undefined) {
          onChange(option.value);
        }
      }}
      isReadOnly={isReadOnly}
      className="flex flex-col gap-1.5"
    >
      <Label className="text-15 font-medium">{label}</Label>
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <Radio
            key={option.value}
            value={option.value}
            aria-labelledby={`${id}-${option.value}-label`}
            aria-describedby={`${id}-${option.value}-description`}
            className="group flex cursor-default items-start gap-2"
          >
            <span
              aria-hidden
              className="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-focus group-data-invalid:border-2 group-data-invalid:border-danger-icon group-data-selected:border-accent group-data-selected:bg-accent"
            >
              <span className="hidden size-1.5 rounded-full bg-on-accent group-data-selected:block" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span id={`${id}-${option.value}-label`} className="text-15">
                {option.label}
              </span>
              <span
                id={`${id}-${option.value}-description`}
                className="text-13 text-fg-muted"
              >
                {option.description}
              </span>
            </span>
          </Radio>
        ))}
      </div>
      <FieldErrorMessage />
    </RadioGroup>
  );
}
