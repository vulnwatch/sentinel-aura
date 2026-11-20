import { CircleAlert } from "lucide-react";
import { useEffect, useId, useState, type ReactNode, type Ref } from "react";
import {
  ComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  Popover,
  Text,
  type Key,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { Loading } from "./loading";
import { Option, OPTIONS_POPOVER, OptionsStatus } from "./options";

// A combobox that searches as the user types (docs/design-system.md, Forms):
// a field whose term, once the user has stopped typing, reads the matching
// options, which open below it, such as the combobox of users or the name of
// a package.

// The shortest term that the combobox searches, and the longest that the
// field takes, the length of a query parameter (Sentinel docs/api-spec.md,
// Query Parameter Length Limit).
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 500;

// How long the field waits after the user stops typing before it reads the
// options of the term, so that it does not read them for every character.
export const SEARCH_DELAY_MS = 250;

export const COUNT = new Intl.NumberFormat("en-US");

// The length of a term as Sentinel counts it, in characters, rather than in
// the UTF-16 code units of a string of JavaScript (Sentinel docs/api-spec.md,
// Query Parameter Length Limit).
export function characters(term: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- the code points are what Sentinel counts, as Python's len does
  return [...term].length;
}

// The term of the field once the user has stopped typing for SEARCH_DELAY_MS.
export function useSettledTerm(input: string): string {
  const [term, setTerm] = useState(input);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(input);
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [input]);
  return term;
}

interface SearchComboBoxProps<TItem extends object> {
  // The label above the field.
  label: string;
  // The name of the field in its form, by which the form shows its errors.
  name: string;
  // What the field takes, which follows the control.
  description?: string;
  // The options that the field lists, in their order.
  items: readonly TItem[];
  // The key of an option, and its text, which the field shows once it is
  // chosen.
  itemKey: (item: TItem) => string;
  itemText: (item: TItem) => string;
  // The label of an option.
  renderItem: (item: TItem) => ReactNode;
  // The key of the option that the field holds, or null.
  value: string | null;
  // Applies the option that the user chooses, by its key.
  onChange: (key: Key | null) => void;
  // What the user typed, which the field shows.
  inputValue: string;
  onInputChange: (text: string) => void;
  // What shows below the options, and its status region announces, such as
  // the failure of the read or "No users match.", or null.
  status: string | null;
  // Whether the options of the term wait for their read, which shows the
  // loading indicator in their place.
  waiting: boolean;
  // Whether the menu opens without options, to show status or waiting: a
  // combobox whose input is valid without a choice keeps it closed while it
  // has nothing to show.
  opensEmpty: boolean;
  // Whether the field accepts input that no option holds, as its value.
  allowsCustomValue?: boolean;
  // The keys of the options that the field lists but does not offer.
  disabledKeys?: Iterable<Key>;
  // Whether the field cannot change, as while its form is submitted.
  isDisabled?: boolean;
  // Whether the field keeps its text and its focus but takes no input, as
  // while the change of a value that it holds is in progress.
  isReadOnly?: boolean;
  // The input element, which takes the focus.
  inputRef?: Ref<HTMLInputElement>;
}

// The field: its label above it in text-15, weight 500, and the control,
// 40 px high, on surface with a border-strong boundary, a 6 px radius, and
// 16 px of side padding, which takes at most 500 characters; its description
// and its error after it, as the error of every field of a form follows it,
// after circle-alert, and assistive technologies read them with the field.
// Its options open below it (OPTIONS_POPOVER); while they load, the loading
// indicator shows in their place, and the status below them, which a status
// region of the menu announces.
export function SearchComboBox<TItem extends object>({
  label,
  name,
  description,
  items,
  itemKey,
  itemText,
  renderItem,
  value,
  onChange,
  inputValue,
  onInputChange,
  status,
  waiting,
  opensEmpty,
  allowsCustomValue = false,
  disabledKeys,
  isDisabled = false,
  isReadOnly = false,
  inputRef,
}: SearchComboBoxProps<TItem>) {
  const statusId = useId();
  return (
    <ComboBox
      name={name}
      items={items}
      value={value}
      onChange={onChange}
      inputValue={inputValue}
      onInputChange={onInputChange}
      disabledKeys={disabledKeys}
      isDisabled={isDisabled}
      isReadOnly={isReadOnly}
      allowsCustomValue={allowsCustomValue}
      allowsEmptyCollection={opensEmpty}
      className="flex flex-col"
    >
      <Label className="text-15 font-medium">{label}</Label>
      <Input
        ref={inputRef}
        maxLength={SEARCH_MAX_LENGTH}
        className={`mt-1.5 h-10 rounded-md border border-border-strong bg-surface px-4 text-15 text-fg data-disabled:opacity-60 data-invalid:border-2 data-invalid:border-danger-icon data-invalid:px-3.75 ${FOCUS_RING}`}
      />
      {description !== undefined && (
        <Text slot="description" className="mt-1.5 text-13 text-fg-muted">
          {description}
        </Text>
      )}
      {/* A status region that is there before the error, so that assistive
          technologies announce it also while the field keeps the focus, as
          after a submission with Enter in the field; it takes no room
          without one, the space before each part of the field being its
          own. */}
      <output className="block">
        <FieldError className="mt-1.5 flex gap-1.5 text-13 font-medium text-danger-on-soft">
          {({ validationErrors }) => (
            <>
              <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
              <span>{validationErrors.join(" ")}</span>
            </>
          )}
        </FieldError>
      </output>
      <Popover offset={4} className={OPTIONS_POPOVER}>
        <ListBox
          aria-describedby={statusId}
          className="outline-none"
          // Only while the options load: React Aria holds the empty state in
          // an option, which would otherwise be an option without a name.
          renderEmptyState={
            waiting
              ? () => (
                  <OptionsStatus>
                    <Loading inValue />
                  </OptionsStatus>
                )
              : undefined
          }
        >
          {(item: TItem) => (
            <Option id={itemKey(item)} textValue={itemText(item)}>
              {renderItem(item)}
            </Option>
          )}
        </ListBox>
        {/* A status region that is there before what it holds, so that
            assistive technologies announce it while the field holds the
            focus. */}
        <output className="block">
          <div id={statusId}>
            {status !== null && <OptionsStatus>{status}</OptionsStatus>}
          </div>
        </output>
      </Popover>
    </ComboBox>
  );
}
