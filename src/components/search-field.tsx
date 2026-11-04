import { Search, X } from "lucide-react";
import { useState } from "react";
import {
  Button as AriaButton,
  Input,
  SearchField as AriaSearchField,
} from "react-aria-components";
import { FOCUS_RING } from "./focus-ring";
import { Tooltip } from "./tooltip";

interface SearchFieldProps {
  // The placeholder, such as "Search Tickets", which is also the accessible
  // name of the field.
  placeholder: string;
  // The term that applies, or "" without one.
  applied: string;
  // Applies a term, without its surrounding whitespace, or "" to remove it.
  onApply: (term: string) => void;
  // The longest term that the field accepts.
  maxLength: number;
}

// The search field of a list (docs/design-system.md, Lists; Forms): 224 px
// wide and 32 px high, on surface with a border-strong boundary and a 6 px
// radius, starting with search at 16 px in fg-muted and, with a value, ending
// with its clear button, an icon button with x at 16 px in a 24 px target,
// named "Clear search" (docs/design-system.md, Buttons and Links), which the
// pointer presses and Escape replaces for the keyboard. Enter applies the term
// that the user typed, without its surrounding whitespace; the clear button
// and Escape remove the term. A typed term that is not applied returns to the
// applied one when the focus leaves the field, and the field shows the term
// that applies when it changes otherwise, such as with back.
export function SearchField({
  placeholder,
  applied,
  onApply,
  maxLength,
}: SearchFieldProps) {
  const [value, setValue] = useState(applied);
  const [shownApplied, setShownApplied] = useState(applied);
  if (applied !== shownApplied) {
    setShownApplied(applied);
    setValue(applied);
  }
  return (
    <AriaSearchField
      aria-label={placeholder}
      value={value}
      maxLength={maxLength}
      onChange={setValue}
      onSubmit={(typed) => {
        const term = typed.trim();
        setValue(term);
        if (term !== applied) {
          onApply(term);
        }
      }}
      onClear={() => {
        if (applied !== "") {
          onApply("");
        }
      }}
      onBlur={() => {
        setValue(applied);
      }}
      className="group relative flex w-56 max-w-full items-center"
    >
      <Search
        aria-hidden
        className="pointer-events-none absolute start-3 size-4 text-fg-muted"
      />
      <Input
        placeholder={placeholder}
        className={`h-8 w-full rounded-md border border-border-strong bg-surface ps-9 pe-8 text-14 text-fg placeholder:text-fg-muted [&::-webkit-search-cancel-button]:hidden ${FOCUS_RING}`}
      />
      <Tooltip text="Clear search" placement="top">
        <AriaButton
          className={`absolute end-1 inline-flex size-6 items-center justify-center rounded-md group-data-empty:hidden data-hovered:bg-surface-hover ${FOCUS_RING}`}
        >
          <X aria-hidden className="size-4" />
        </AriaButton>
      </Tooltip>
    </AriaSearchField>
  );
}
