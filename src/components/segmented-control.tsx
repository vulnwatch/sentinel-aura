import { ToggleButton, ToggleButtonGroup } from "react-aria-components";

export interface SegmentedOption<T extends string> {
  // The value that the control holds when the option is chosen.
  value: T;
  // Its label, which its segment shows.
  label: string;
}

interface SegmentedControlProps<T extends string> {
  // The element that names the control, such as the name of a metric beside
  // it.
  labelledBy: string;
  // The element that describes it, if any, such as a note below it.
  describedBy?: string | undefined;
  options: readonly SegmentedOption<T>[];
  // The option chosen, or undefined before the user chooses one.
  value: T | undefined;
  onChange: (value: T) => void;
}

// A choice of one value among a few, every value visible, as the calculator
// of FIRST shows the values of a metric (docs/design-system.md, Forms): its
// options are segments 32 px high in a row with a border-strong boundary
// and a 6 px radius, apart by border-strong lines, each its label in text-14
// with 12 px of side padding, surface-hover under the pointer; the chosen
// one has an accent fill, accent-hover under the pointer, with its label
// in on-accent at weight 500. The row
// is as wide as its options, and wraps where its place is narrower. Once an
// option is chosen, one always is. Assistive technologies read it as a
// group of radio buttons, which the arrow keys move between, and the focus
// ring is drawn inside the segment, in on-accent on the chosen one.
export function SegmentedControl<T extends string>({
  labelledBy,
  describedBy,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <ToggleButtonGroup
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={value === undefined ? [] : [value]}
      onSelectionChange={(keys) => {
        const option = options.find((item) => keys.has(item.value));
        if (option !== undefined) {
          onChange(option.value);
        }
      }}
      className="inline-flex w-fit max-w-full flex-wrap justify-self-start overflow-hidden rounded-md border border-border-strong"
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          className="h-8 cursor-default border-s border-border-strong bg-surface px-3 text-14 text-fg outline-none first:border-s-0 data-focus-visible:outline-2 data-focus-visible:-outline-offset-4 data-focus-visible:outline-solid data-focus-visible:outline-focus data-hovered:bg-surface-hover data-selected:bg-accent data-selected:font-medium data-selected:text-on-accent data-selected:data-hovered:bg-accent-hover data-selected:data-focus-visible:outline-on-accent"
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
