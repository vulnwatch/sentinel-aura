import { useState, type Ref } from "react";
import type { UserDirectoryData } from "../api/generated/model";
import { useListUsers } from "../api/generated/users";
import { Label as UserLabel } from "./label";
import { userOptionText, UserOptionLabel } from "./options";
import { placeMessage } from "./read-view";
import {
  characters,
  COUNT,
  SearchComboBox,
  SEARCH_MIN_LENGTH,
  useSettledTerm,
} from "./search-combobox";

// A combobox of users (docs/design-system.md, Forms): a field in which the
// user types part of a name, a username, or an email, with the matching
// users of the directory listed below it (Sentinel
// docs/features/identity/user-management.md, List Users).

// The most users that the field lists for a term, the first by username;
// a longer term narrows them.
export const LISTED_USERS = 20;

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

// The field (SearchComboBox): once the user has typed at least 2 characters
// without their surrounding whitespace, and has stopped typing, it reads the
// active users whose username, email, or full name contain them, the first
// 20 by username, and opens them below it, each in the full form at the small
// size with the username and the labels; while they load, or when their read
// fails, the loading indicator or the message of the failure shows in their
// place, and "No users match." when none does, or, below the users, how many
// match when more do, which a status region of the menu announces. A user
// that the field does not offer shows the label that says why and is
// disabled. Choosing a user shows it in the field as its text, the display
// name and @ and the username.
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
    <SearchComboBox
      label={label}
      name={name}
      items={users}
      itemKey={(user) => user.id}
      itemText={userOptionText}
      renderItem={(user) => {
        const isUnavailable = unavailable?.ids.has(user.id) === true;
        return (
          <UserOptionLabel
            user={user}
            labels={
              isUnavailable && unavailable !== undefined ? (
                <UserLabel>{unavailable.label}</UserLabel>
              ) : undefined
            }
          />
        );
      }}
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
      status={status}
      waiting={waiting}
      opensEmpty
      disabledKeys={unavailable === undefined ? undefined : unavailable.ids}
      isDisabled={isDisabled}
      inputRef={inputRef}
    />
  );
}
