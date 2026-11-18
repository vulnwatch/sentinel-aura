import { CircleAlert, Search, X } from "lucide-react";
import { useId, useState, type Key } from "react";
import {
  Autocomplete,
  Button as AriaButton,
  FieldError,
  Input,
  ListBox,
  ListBoxSection,
  SearchField,
} from "react-aria-components";
import type { ListUsersAssignmentEligibilityItem } from "../api/generated/model";
import { useListUsers } from "../api/generated/users";
import { FOCUS_RING } from "./focus-ring";
import { Label as UserLabel } from "./label";
import { Loading } from "./loading";
import {
  Option,
  OptionsStatus,
  userOptionText,
  UserOptionLabel,
} from "./options";
import { placeMessage } from "./read-view";
import { Tooltip } from "./tooltip";
import type { UserFields } from "./user";
import {
  characters,
  COUNT,
  LISTED_USERS,
  SEARCH_MAX_LENGTH,
  SEARCH_MIN_LENGTH,
  useSettledTerm,
} from "./user-combobox";

// A combobox of users that lists its users at once (docs/design-system.md,
// Forms), as the control of a field that a pencil opens in a popover, whose
// choice applies at once (docs/design-system.md, Detail Screens), such as the
// assignee picker of a Ticket.

// The key of the action that the picker offers before its users, which
// cannot be the id of a user, a UUID.
const ACTION_KEY = "action";

interface UserOptionProps {
  user: UserFields;
  // The choice in progress (UserPickerProps).
  busy: string | null;
  // The label that names the user, such as You.
  label?: string;
}

// A user as an option: the full form at the small size with the username and
// the labels.
function UserOption({ user, busy, label }: UserOptionProps) {
  return (
    <Option
      id={user.id}
      textValue={userOptionText(user)}
      isBusy={busy === user.id}
    >
      <UserOptionLabel
        user={user}
        labels={
          label === undefined ? undefined : <UserLabel>{label}</UserLabel>
        }
      />
    </Option>
  );
}

interface UserPickerProps {
  // The accessible name of the search field, which its placeholder shows.
  label: string;
  // The assignment eligibility of the users that the picker lists (Sentinel
  // docs/features/identity/user-management.md, List Users).
  eligibility: readonly ListUsersAssignmentEligibilityItem[];
  // The user that comes first, such as the signed-in user, with the label
  // that names them, such as You, or undefined.
  first: { user: UserFields; label: string } | undefined;
  // The user who holds the field, whom the picker marks as chosen, by id.
  chosen: string | null;
  // The choice whose change is in progress, a user's id or "action", during
  // which the picker takes no other choice.
  busy: string | null;
  // An action that the picker offers before its users while no term is
  // typed, such as Unassign yourself, or undefined.
  action: string | undefined;
  // Applies a choice: a user, or the action.
  onChoose: (choice: UserFields | "action") => void;
  // What the status region says while a choice is in progress.
  busyText: string;
  // The error of the field, or undefined.
  error: string | undefined;
  // Tells that the user changed the term, after which the error of the field
  // no longer applies.
  onInput: () => void;
}

// The search field, 40 px high, on surface with a border-strong boundary and
// a 6 px radius, starting with search at 16 px in fg-muted and, with a term,
// ending with its clear button; then the users below it. Without a term, and
// with 1 character, they are the first 20 users of the eligibility, by
// username, the first user at once among them, as the caller holds them;
// from 2 characters, once the user has stopped typing, the first 20 users of
// the eligibility that match the term, the first user when they match. The
// action, without a term, and the first user stand before the others, apart
// by a border line. Each user shows in the full form at the small size with
// the username and the labels, the chosen one with check, and the busy
// choice with loader-circle in its place. Below them, how many more there
// are, or "No users match.", the loading indicator or the message of the
// failure of their read, and that a choice is in progress, which a status
// region announces. The error of the field follows the field, after
// circle-alert, in a status region, so that it is announced while the field
// keeps the focus, and assistive technologies read it with the field. What
// the picker reads is read once as it opens, and again for each term, and
// not when the tab returns to the foreground (docs/behaviors.md, Loading).
export function UserPicker({
  label,
  eligibility,
  first,
  chosen,
  busy,
  action,
  onChoose,
  busyText,
  error,
  onInput,
}: UserPickerProps) {
  const statusId = useId();
  const [input, setInput] = useState("");
  const typed = input.trim();
  const term = useSettledTerm(typed);
  const searching = characters(term) >= SEARCH_MIN_LENGTH;
  const read = useListUsers(
    {
      ...(searching ? { search: term } : {}),
      assignment_eligibility: [...eligibility],
      per_page: LISTED_USERS,
    },
    { query: { gcTime: 0, refetchOnWindowFocus: false } },
  );
  // A term of 1 character keeps the users without a term; a longer one waits
  // for its own.
  const settling = characters(typed) >= SEARCH_MIN_LENGTH && term !== typed;
  const found = settling ? [] : (read.data?.data ?? []);
  const others = found.filter((user) => user.id !== first?.user.id);
  // The first user shows at once without a term, and with a term once the
  // users that match hold them.
  const firstShown =
    first !== undefined &&
    !settling &&
    (!searching || others.length < found.length);
  const shownOthers = searching
    ? others
    : others.slice(0, LISTED_USERS - (firstShown ? 1 : 0));
  const users = firstShown ? [first.user, ...shownOthers] : shownOthers;
  const offersAction = action !== undefined && typed === "";

  // What shows below the users, and the status region announces.
  let status: string | null = null;
  const total = read.data?.meta.total ?? 0;
  if (busy !== null) {
    status = busyText;
  } else if (!settling && read.status === "error") {
    status = placeMessage(read);
  } else if (!settling && read.status === "success") {
    if (users.length === 0) {
      status = "No users match.";
    } else if (total > users.length) {
      status = searching
        ? `The first ${COUNT.format(users.length)} of ${COUNT.format(total)} users that match. Type more to narrow them.`
        : `The first ${COUNT.format(users.length)} of ${COUNT.format(total)} users. Type to find the others.`;
    }
  }
  const waiting = settling || read.status === "pending";

  const choose = (key: Key) => {
    if (busy !== null) {
      return;
    }
    if (key === ACTION_KEY) {
      onChoose("action");
      return;
    }
    const user = users.find((candidate) => candidate.id === key);
    if (user !== undefined) {
      onChoose(user);
    }
  };

  return (
    <Autocomplete
      // The users change once the term has settled, after the input, so a
      // user that the input made current could leave the list while the
      // field still names it; the arrow keys make one current instead, and
      // Enter chooses only that one.
      disableAutoFocusFirst
      inputValue={input}
      onInputChange={(text) => {
        if (text !== input) {
          onInput();
        }
        setInput(text);
      }}
    >
      <SearchField
        aria-label={label}
        isInvalid={error !== undefined}
        className="group relative flex flex-col gap-1.5"
      >
        <div className="relative flex items-center">
          <Search
            aria-hidden
            className="pointer-events-none absolute start-3 size-4 text-fg-muted"
          />
          <Input
            placeholder={label}
            maxLength={SEARCH_MAX_LENGTH}
            className={`h-10 w-full rounded-md border border-border-strong bg-surface ps-9 pe-9 text-15 text-fg placeholder:text-fg-muted data-invalid:border-2 data-invalid:border-danger-icon [&::-webkit-search-cancel-button]:hidden ${FOCUS_RING}`}
          />
          <Tooltip text="Clear search" placement="top">
            <AriaButton
              className={`absolute end-2 inline-flex size-6 items-center justify-center rounded-md group-data-empty:hidden data-hovered:bg-surface-hover ${FOCUS_RING}`}
            >
              <X aria-hidden className="size-4" />
            </AriaButton>
          </Tooltip>
        </div>
        {/* A status region that is there before the error, so that
            assistive technologies announce it while the field keeps the
            focus. */}
        <output className="block">
          <FieldError className="flex gap-1.5 text-13 font-medium text-danger-on-soft">
            <CircleAlert aria-hidden className="mt-0.75 size-3.5 shrink-0" />
            <span>{error}</span>
          </FieldError>
        </output>
      </SearchField>
      <ListBox
        aria-label="Users"
        aria-describedby={statusId}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={chosen === null ? [] : [chosen]}
        onSelectionChange={(keys) => {
          if (keys !== "all") {
            const [key] = keys;
            if (key !== undefined) {
              choose(key);
            }
          }
        }}
        className="mt-2 max-h-72 overflow-y-auto outline-none"
      >
        {(offersAction || firstShown) && (
          <ListBoxSection
            className={
              shownOthers.length > 0 ? "mb-1 border-b border-border pb-1" : ""
            }
          >
            {offersAction && (
              <Option
                id={ACTION_KEY}
                textValue={action}
                isBusy={busy === ACTION_KEY}
              >
                {action}
              </Option>
            )}
            {firstShown && (
              <UserOption user={first.user} busy={busy} label={first.label} />
            )}
          </ListBoxSection>
        )}
        <ListBoxSection>
          {shownOthers.map((user) => (
            <UserOption key={user.id} user={user} busy={busy} />
          ))}
        </ListBoxSection>
      </ListBox>
      {/* A status region that is there before what it holds, so that
          assistive technologies announce it while the field holds the
          focus. */}
      <output className="block">
        <div id={statusId}>
          {waiting && (
            <OptionsStatus>
              <Loading inValue />
            </OptionsStatus>
          )}
          {status !== null && <OptionsStatus>{status}</OptionsStatus>}
        </div>
      </output>
    </Autocomplete>
  );
}
