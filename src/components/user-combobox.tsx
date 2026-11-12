import { CircleAlert } from "lucide-react";
import { useEffect, useId, useState, type Ref } from "react";
import {
  ComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  Popover,
} from "react-aria-components";
import type { UserDirectoryData } from "../api/generated/model";
import { useListUsers } from "../api/generated/users";
import { FOCUS_RING } from "./focus-ring";
import { Label as UserLabel } from "./label";
import { Loading } from "./loading";
import {
  Option,
  OPTIONS_POPOVER,
  OptionsStatus,
  userOptionText,
  UserOptionLabel,
} from "./options";
import { placeMessage } from "./read-view";

// A combobox of users (docs/design-system.md, Forms): a field in which the
// user types part of a name, a username, or an email, with the matching
// users of the directory listed below it (Sentinel
// docs/features/identity/user-management.md, List Users).

// The shortest and the longest term that List Users searches.
const SEARCH_MIN_LENGTH = 2;
const SEARCH_MAX_LENGTH = 500;

// The most users that the field lists for a term, the first by username;
// a longer term narrows them.
const LISTED_USERS = 20;

// How long the field waits after the user stops typing before it reads the
// users of the term, so that it does not read them for every character.
export const SEARCH_DELAY_MS = 250;

const COUNT = new Intl.NumberFormat("en-US");

// The length of a term as Sentinel counts it, in characters, rather than in
// the UTF-16 code units of a string of JavaScript (Sentinel
// docs/features/identity/user-management.md, List Users).
function characters(term: string): number {
  // oxlint-disable-next-line typescript/no-misused-spread -- the code points are what Sentinel counts, as Python's len does
  return [...term].length;
}

// The term of the field once the user has stopped typing for SEARCH_DELAY_MS.
function useSettledTerm(input: string): string {
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

interface UserComboBoxProps {
  // The label above the field.
  label: string;
  // The name of the field in its form, by which the form shows its errors.
  name: string;
  // The user that the field holds, or null.
  value: UserDirectoryData | null;
  // Applies the user that the user chooses, or null when the input no longer
  // names the user that the field held.
  onChange: (user: UserDirectoryData | null) => void;
  // Tells that the user changed the input, after which an error of the
  // field that the form shows no longer applies.
  onInput?: () => void;
  // The users that the field lists but does not offer, by id, such as those
  // that already hold what the form grants, with the label that says why.
  unavailable?: { ids: ReadonlySet<string>; label: string };
  // Whether the field cannot change, as while its form is submitted.
  isDisabled?: boolean;
  // The input element, which takes the focus.
  inputRef?: Ref<HTMLInputElement>;
}

// The field: its label above it in text-15, weight 500, and the control,
// 40 px high, on surface with a border-strong boundary, a 6 px radius, and
// 16 px of side padding, which takes at most 500 characters. Once the user
// has typed at least 2 characters without their surrounding whitespace, and
// has stopped typing, it reads the active users whose username, email, or
// full name contain them, the first 20 by username, and opens them below it
// (OPTIONS_POPOVER), each in the full form at the small size with the
// username and the labels; while they load, or when their read fails, the
// loading indicator or the message of the failure shows in their place, and
// "No users match." when none does, or, below the users, how many match
// when more do, which a status region of the menu announces. A user that the
// field does not offer shows the label that says why and is disabled.
// Choosing a user shows it in the field as its text,
// the display name and @ and the username. Its error follows it, after
// circle-alert, as the error of every field of a form does, and assistive
// technologies read it with the field.
export function UserComboBox({
  label,
  name,
  value,
  onChange,
  onInput,
  unavailable,
  isDisabled = false,
  inputRef,
}: UserComboBoxProps) {
  const statusId = useId();
  const [input, setInput] = useState(
    value === null ? "" : userOptionText(value),
  );
  const typed = input.trim();
  const term = useSettledTerm(typed);
  const searching =
    characters(term) >= SEARCH_MIN_LENGTH &&
    (value === null || input !== userOptionText(value));
  const read = useListUsers(
    { search: term, active: true, per_page: LISTED_USERS },
    { query: { enabled: searching } },
  );
  // The users of the term, and the user that the field holds, whom the
  // field keeps among its options, so that it keeps showing it.
  const found = searching ? (read.data?.data ?? []) : [];
  const users =
    value === null || found.some((user) => user.id === value.id)
      ? found
      : [value, ...found];

  // What shows in place of the options, and the status region announces.
  let status: string | null = null;
  const total = read.data?.meta.total ?? 0;
  if (characters(typed) < SEARCH_MIN_LENGTH) {
    status = "Enter at least 2 characters.";
  } else if (searching && read.status === "error") {
    status = placeMessage(read);
  } else if (searching && read.status === "success" && found.length === 0) {
    status = "No users match.";
  } else if (searching && read.status === "success" && total > found.length) {
    status = `The first ${COUNT.format(found.length)} of ${COUNT.format(total)} users that match. Type more to narrow them.`;
  }
  const waiting =
    characters(typed) >= SEARCH_MIN_LENGTH &&
    (term !== typed || (searching && read.status === "pending"));

  return (
    <ComboBox
      name={name}
      items={users}
      value={value?.id ?? null}
      onChange={(key) => {
        const chosen = users.find((user) => user.id === key) ?? null;
        // With its value and its input controlled, the field shows the text
        // of the user chosen itself.
        if (chosen !== null) {
          setInput(userOptionText(chosen));
        }
        onChange(chosen);
      }}
      inputValue={input}
      onInputChange={(text) => {
        if (text !== input) {
          onInput?.();
        }
        setInput(text);
        if (value !== null && text !== userOptionText(value)) {
          onChange(null);
        }
      }}
      disabledKeys={
        unavailable === undefined ? undefined : [...unavailable.ids]
      }
      isDisabled={isDisabled}
      allowsEmptyCollection
      className="flex flex-col gap-1.5"
    >
      <Label className="text-15 font-medium">{label}</Label>
      <Input
        ref={inputRef}
        maxLength={SEARCH_MAX_LENGTH}
        className={`h-10 rounded-md border border-border-strong bg-surface px-4 text-15 text-fg data-disabled:opacity-60 data-invalid:border-2 data-invalid:border-danger-icon data-invalid:px-3.75 ${FOCUS_RING}`}
      />
      <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
        {({ validationErrors }) => (
          <>
            <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
            <span>{validationErrors.join(" ")}</span>
          </>
        )}
      </FieldError>
      <Popover offset={4} className={OPTIONS_POPOVER}>
        <ListBox
          aria-describedby={statusId}
          className="outline-none"
          renderEmptyState={() =>
            waiting ? (
              <OptionsStatus>
                <Loading inValue />
              </OptionsStatus>
            ) : null
          }
        >
          {(user: UserDirectoryData) => {
            const isUnavailable = unavailable?.ids.has(user.id) === true;
            return (
              <Option id={user.id} textValue={userOptionText(user)}>
                <UserOptionLabel
                  user={user}
                  labels={
                    isUnavailable && unavailable !== undefined ? (
                      <UserLabel>{unavailable.label}</UserLabel>
                    ) : undefined
                  }
                />
              </Option>
            );
          }}
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
