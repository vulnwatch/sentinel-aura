# Cross-Cutting Behaviors

This document defines the behaviors that every screen of Sentinel Aura shares:
the session, the presentation of errors and of unknown values, the loading and
empty states, dates and times, confirmations and the outcome of changes,
accessibility, wording, and the representation of a user. It is a foundation
document (`docs/conventions.md`, Foundation Documents): every screen follows
it, and a screen that needs to depart from one of its behaviors changes this
document first. A screen document records only what its screen adds, such as
the error codes that it handles specifically (`docs/conventions.md`, Screen
Documents). The architecture belongs to `docs/architecture.md`, the users,
screen map, and roles to `docs/screen-map.md`, and the visual presentation of
these behaviors to the design system of the UI foundations; backend behavior,
the API contract, and the obligations that the contract places on clients
belong to Sentinel (`README.md`, Specification Boundary).

Every rule taken from Sentinel is summarized next to the Sentinel section that
states it, and that section remains authoritative (`docs/conventions.md`,
Sentinel Cross-references). Open Decisions lists the behaviors of this
document that do not take effect yet.

## Contents

- [Session](#session)
  - [Session State](#session-state)
  - [Return After Sign-in](#return-after-sign-in)
  - [Session Expiration Message](#session-expiration-message)
  - [The Signed-in User](#the-signed-in-user)
  - [Sign-out](#sign-out)
- [Errors](#errors)
  - [Where Errors Appear](#where-errors-appear)
  - [Default Presentation by Status](#default-presentation-by-status)
  - [Missing and Inaccessible Records](#missing-and-inaccessible-records)
  - [Retries and Unconfirmed Changes](#retries-and-unconfirmed-changes)
- [Unknown Values](#unknown-values)
- [Loading and Empty States](#loading-and-empty-states)
  - [Loading](#loading)
  - [Empty States](#empty-states)
  - [Absent Values](#absent-values)
- [Dates and Times](#dates-and-times)
  - [Display](#display)
  - [Input](#input)
  - [Deadlines](#deadlines)
- [Confirmations and Outcomes](#confirmations-and-outcomes)
  - [Confirmation](#confirmation)
  - [Outcome of a Change](#outcome-of-a-change)
- [Accessibility](#accessibility)
- [Wording](#wording)
  - [Domain Terms](#domain-terms)
  - [Actions](#actions)
  - [Style](#style)
- [Representation of a User](#representation-of-a-user)
- [Open Decisions](#open-decisions)

## Session

### Session State

- The UI cannot read the session cookie, so it learns the state of the
  session only from the API's responses (`docs/architecture.md`, Session
  Cookie).
- When the UI loads in a tab, it reads the signed-in user (Sentinel
  `docs/features/identity/authentication.md`, Get Current User) before it
  shows any screen, and shows only a loading indicator until the response
  arrives. A successful response shows the screen of the URL, and a `401`
  leads to Sign in. Any other failure shows its error as the whole page
  (Errors), with an action that tries again, and does not lead to Sign in:
  it does not tell whether a session exists.
- A `401` response to any request other than sign-in and sign-out (Sentinel
  `docs/features/identity/local-authentication.md`, Login; Sentinel
  `docs/features/identity/authentication.md`, Logout) means that the browser
  has no valid session: Sentinel answers an absent, expired, and invalidated
  session alike (Sentinel `docs/api-spec.md`, Global Responses). The UI then
  discards all the data that it read from the API, so that the next user of
  the browser cannot see it, and leads to Sign in. Input not yet submitted is
  lost.
- Sign in is shown only without a session: opened with a session, it is
  replaced by the landing (`docs/screen-map.md`, Landing) without a new entry
  in the browser history.
- Each tab learns of a change of the session, such as a sign-out in another
  tab, from its own next response.

### Return After Sign-in

- When the UI leads from a screen to Sign in, as it loads or after a `401`, it
  saves the URL of that screen, its path, search, and fragment, in the tab's
  session storage, where it survives a reload of Sign in. Sign in replaces the
  screen in the browser history, so that back does not return to a screen
  that needs the session. Opening Sign in directly saves nothing.
- After a successful sign-in, the UI reads the signed-in user, then reads and
  removes the saved URL. It opens that URL only when it is a path of the UI's
  origin other than `/api`, a path under `/api/`, Sign in, or
  `/auth/callback`. Any other value, such as one that resolves to another
  origin, counts as absent, and the UI opens the landing instead
  (`docs/screen-map.md`, Landing). Either replaces Sign in in the browser
  history.
- A script of the API's documentation page can write the saved value, which
  is therefore untrusted (`docs/architecture.md`, Same Origin). The check
  keeps a planted value from leading the user out of the UI after a genuine
  sign-in; a value that the UI saved itself always passes it.

### Session Expiration Message

- Sign in tells the user that their session has expired only when the
  browser had a session before, never on a first visit (Sentinel
  `docs/features/identity/authentication.md`, Session expiration handling).
- The cookie does not show whether the browser had a session, so the UI
  records it: it keeps in the origin's local storage a record that this
  browser has a session when it reads the signed-in user successfully, and
  removes the record when the user signs out (Sign-out). The record holds no
  data read from the API. Local storage is shared by the tabs of the browser
  and kept across restarts, like the cookie, so a sign-out in one tab removes
  the record for all of them.
- When the UI leads to Sign in and the record exists, Sign in shows the
  information "Your session has expired. Sign in again."; otherwise it shows
  none.
- The record is untrusted like every value of the origin's storage
  (`docs/architecture.md`, Same Origin): a planted or removed record only
  shows or hides this message.

### The Signed-in User

- The UI reads the signed-in user when it loads, when the tab returns to the
  foreground after being hidden, and after every `403` response. Sentinel
  applies a change of a user's roles from the user's next request (Sentinel
  `docs/features/identity/rbac.md`, Permission Checking), so these reads keep
  current the elements that depend on the roles (`docs/screen-map.md`,
  Roles), and those that will depend on capabilities once a pinned Sentinel
  version returns them (`docs/screen-map.md`, Capabilities of the Signed-in
  User).
- When a read returns a user other than the one that the tab showed, for
  example after another account signed in in another tab, the UI discards all
  the data that it read from the API and opens the landing of that user.

### Sign-out

- The account menu offers Sign out (`docs/screen-map.md`, Header), without
  confirmation (Confirmation). It sends Sentinel's logout, which ends the
  session of this browser only: the user's sessions in other browsers continue
  (Sentinel `docs/features/identity/authentication.md`, Logout; Concurrent
  sessions).
- On `204`, or on `401`, which means that no valid session remained, the UI
  removes the session record (Session Expiration Message), discards all the
  data that it read from the API, and opens Sign in without a message and
  without a saved URL.
- On any other outcome, such as a network failure or a `5xx`, the user stays
  signed in: the screen stays as it was and shows the error (Errors).

## Errors

This presentation applies to every failure that a screen does not handle
specifically; its screen document lists the codes that it does
(`docs/conventions.md`, Error Codes and Messages). The UI decides by the HTTP
status and Sentinel's `code`, never by `detail` (Sentinel `docs/api-spec.md`,
Response Format), and shows no text of an error response, so that every
message follows Wording.

### Where Errors Appear

| Failure | Where it appears |
|---|---|
| A read without which the screen shows nothing, such as the record of a detail screen or the list of a list screen | In place of the content of the screen, below the header; the screen's heading and page title name the error |
| A read of one part of a screen, such as a section, a tab, or a count | In place of that part; the rest of the screen stays usable |
| A new read of data that the screen already shows | Next to that data, which stays shown, saying that it could not be updated |
| A change submitted from a form or a dialog | In the form or the dialog, which keeps the input: each field error at its field, and every other error in a message at the top of the form |
| Any other change | In the screen's message area, where outcomes appear (Outcome of a Change) |

- The error of a read offers an action that tries again after a network
  failure, a `429`, or a `5xx`. A `403` or `404` in place of the content of a
  screen links to the landing instead.
- A form checks before sending the constraints that the pinned contract
  declares for its fields, such as a required value or a maximum length, and
  states the constraint at the field. A field error of a `VALIDATION_ERROR`
  response is matched to its field by its `loc` (`docs/conventions.md`, Error
  Codes and Messages) and says "This value isn't valid."; one that matches no
  field is an error of the form.

### Default Presentation by Status

| Status | Presentation |
|---|---|
| No response: a network failure | "Sentinel can't be reached. Check your connection and try again." |
| `400`, and every `4xx` that no other row names | "Sentinel didn't accept this request. Check the values and try again." |
| `401` | No message: the session has ended (Session State) |
| `403` | "You don't have permission to do this." In place of the content of a screen, the heading "No access" and "You don't have permission to view this page." The UI also reads the signed-in user again (The Signed-in User) |
| `404` | Missing and Inaccessible Records |
| `409` | "This can't be done in the current state. The latest data is now shown." The UI reads the affected data again |
| `422` | The field errors of a `VALIDATION_ERROR` as Where Errors Appear states; every other `422` as `400` |
| `429` | "Too many attempts. Try again later." |
| `500`, and a response that the UI cannot read | "Something went wrong in Sentinel. Try again, and if it happens again, report it with the reference below." |
| `503` with a `code` | "Sentinel can't do this now because a service that it depends on is unavailable. Try again later." (Sentinel `docs/api-spec.md`, Infrastructure Dependency Errors (HTTP 503)) |
| `502`, `504`, a `503` without a `code`, and every other `5xx` | "Sentinel isn't available right now. Try again later." |

- `403 AUTH_CROSS_ORIGIN_REJECTED` reports a fault in how the UI is served,
  not a missing permission (`docs/architecture.md`, Cross-Origin Requests): it
  gets the presentation of `500`, and the UI does not read the user again.
- Every `5xx` response, and every response that the UI cannot read, also
  shows "Reference:" followed by the request identifier that the response
  carries, when it carries one, as text that the user can select and copy, so
  that a report names the request (Sentinel `docs/api-spec.md`, Request
  Tracing).
- A status or `code` that the contract of the pinned version does not list
  for the operation gets the row of its status (Sentinel `docs/api-spec.md`,
  Client Tolerance of Non-Breaking Changes).

### Missing and Inaccessible Records

- Sentinel answers a record that does not exist and one that the user cannot
  see with the same not-found response (Sentinel `docs/api-spec.md`,
  Anti-Enumeration Boundary), and the UI never tells them apart
  (`docs/screen-map.md`, Roles).
- A `404` of the read of a screen, a path that matches no screen, and
  `/auth/callback` while it is reserved (`docs/screen-map.md`, Contract URLs)
  show the same page: the heading "Not found", the text "This page doesn't
  exist, or you don't have access to it.", and a link to the landing.
- A `404` of a change, such as one on a record that was deleted or became
  inaccessible in the meantime, shows "This no longer exists, or you no longer
  have access to it." The UI reads the affected data again.

### Retries and Unconfirmed Changes

- A read that fails with a network failure or a `5xx` is sent again
  automatically, up to two more times, before its error shows; the screen
  shows that it is loading meanwhile. A read that fails otherwise is not sent
  again.
- A change is never sent again automatically. When it fails with a network
  failure or a `5xx`, its outcome is unknown: it may have taken effect, as an
  unconfirmed task publication may (Sentinel `docs/api-spec.md`,
  Infrastructure Dependency Errors (HTTP 503)). In place of the message of
  its status, it shows "Sentinel didn't confirm this change. It may have taken
  effect: check before trying again.", with the reference, and the UI reads
  the affected data again.

## Unknown Values

A later Sentinel release within the supported Sentinel versions can return a
value of a response enum that the contract of the pinned version does not
list, and the UI tolerates it (Sentinel `docs/api-spec.md`, Response Enums;
Client Tolerance of Non-Breaking Changes; `docs/conventions.md`, Data Read
from the API):

- the value shows as received, as text, in the neutral appearance of the
  design system, without the label, icon, or color of a known value; it is
  also its accessible name;
- an action that a screen offers according to the value, such as a status
  transition, is not offered for an unknown value; the API decides every
  request anyway; and
- filters offer only the values that the pinned contract lists.

## Loading and Empty States

### Loading

- A screen shows its header, heading, and controls, such as tabs and filters,
  at once. Only a part that waits for data shows a loading indicator, and only
  once the data has taken longer than 300 milliseconds, so that a fast
  response shows none.
- When a screen reads its data again, for example for another page, filter,
  or sort of a list, it keeps showing the previous data, marked as being
  updated, until the new data arrives.
- A change in progress marks the control that started it as busy, and that
  control cannot start the change again until it ends; the rest of the screen
  stays usable, and a form keeps its input.

### Empty States

- A list or a view without records says what is absent, such as "No Tickets
  in this view.", and offers the action that creates such a record to a user
  who can take it (`docs/screen-map.md`, Roles).
- A list whose records do not match the user's filters or search says so,
  such as "No Tickets match the filters.", and offers an action that clears
  them.
- A page beyond the last page of a list, which Sentinel answers with no
  records (Sentinel `docs/api-spec.md`, Pagination), says so, such as "There
  are no Tickets on this page.", and links to the first page.
- A part of a screen without items, such as the references of a Ticket that
  has none, shows a short line in their place, such as "No references.".
- An empty state keeps the controls that led to it, such as tabs, filters,
  the search, and the counts of the views (`docs/screen-map.md`, Ticket List
  Views).

### Absent Values

A field without a value, `null` or omitted, shows a dash, which assistive
technologies read as "Not set". A screen document can name the absence
precisely, such as "Unassigned" for a Ticket without an assignee, and the
screen then shows that word instead. The actor of a recorded action is the
exception (Representation of a User).

## Dates and Times

### Display

- A date and time, which the API sends in UTC, shows in the time zone of the
  browser (Sentinel `docs/conventions.md`, Timestamps & Timezones), as
  `9 Oct 2026, 14:05`: the day without a leading zero, the English
  abbreviation of the month, the year, and the time on the 24-hour clock. A
  screen document adds the seconds where they matter, as `14:05:09`. The time
  zone is not shown.
- A date without a time, such as the end of support of a Product, shows as
  `9 Oct 2026`, as the API returns it, without a conversion between time
  zones.
- Times are absolute, never relative such as "3 hours ago": deadlines, audit
  logs, and fetcher runs are compared and shared, and a relative time is wrong
  in a screenshot or a report read later. The days that remain to a deadline
  are the only relative value (Deadlines).
- A duration shows its two largest units that are not zero, such as
  `1 h 5 min` or `42 s`.

### Input

- A date field shows the day, the month, and the year in this order, and a
  time field the 24-hour clock, both in the time zone of the browser.
- A date that the user enters as a filter covers that whole day in the time
  zone of the browser: the UI sends its first and last instant with the
  offset of the time zone (Sentinel `docs/api-spec.md`, Date Range
  Interpretation). A date and time that the user enters is sent as an instant,
  with its offset or in UTC (Sentinel `docs/conventions.md`, Timestamps &
  Timezones).

### Deadlines

A screen that shows the deadline of a Ticket, such as the Ticket list in its
rows, shows it as a badge with the days that remain to it:

| Ticket status | Deadline |
|---|---|
| New, Analysis | The triage due date, `triage_due_at` |
| Analyzed | The final release deadline, `release_due_at`, which stays meaningful when the maintainer has submitted the fix but the update waits for UM or QA |
| Every other status | No badge |

- A Ticket without that date, which Sentinel returns as `null` (Sentinel
  `docs/features/tickets/ticket-deadlines.md`, Null Due Dates), shows no
  badge.
- The badge shows the number of whole days that remain, followed by `d`,
  such as `3d`, and `0d` in the last day. Once the date is past, it shows the
  number of days begun since, as a negative number, such as `-2d`.
- The badge is red once the date is past, as Sentinel's `overdue` is (same
  document, Evaluation Instant; Track Milestones); yellow while less than a
  third of the window from the Ticket's creation to the date remains; and
  green otherwise. The proportion fits windows that differ widely, from 3 days
  for the triage of a Critical Ticket to 180 days for the release of a Low one
  (same document, SLA Tier; Due Dates).
- The color never carries the meaning alone: a past date also shows an icon,
  and the accessible name of the badge states the deadline, such as "Triage
  due in 3 days", "Triage due in less than a day", or "Release overdue by 2
  days".
- The badge compares the date with the browser's clock when the screen shows
  it; like the deadlines, it is informational (same document, Informational
  Only).
- The Delivery overdue count of the attention summary (`docs/screen-map.md`,
  Attention Summary) counts a Ticket whose submission, UM, or QA milestone is
  past due on one of its tracks, which the badge does not show, so it can
  count Tickets whose badge is not red.

## Confirmations and Outcomes

### Confirmation

An action asks for confirmation in a dialog before it sends its request when
it:

- cannot be undone in the UI, such as revoking an API key, resetting a user's
  password, or deleting a reference;
- ends the access or the work of other people, or changes what every user
  sees, such as deactivating a user, revoking an access grant, disabling a
  fetcher, or changing a system setting; or
- discards input that the user has not submitted, such as leaving a form or
  closing a dialog with changes.

Every other action asks for no confirmation, routine Ticket work included,
such as assigning a Ticket or changing its priority: another action reverses
it. The screen document states which of its actions ask for confirmation
(`docs/conventions.md`, Screen Documents).

A confirmation dialog:

- asks with its title for the action and its object, such as "Revoke API key
  ci-runner?";
- states the consequence, such as "Scripts that use this key stop working at
  once. This can't be undone.";
- offers a button named after the action, such as "Revoke API key", and
  "Cancel"; and
- asks before discarding input "Discard changes?", with "Discard" and "Keep
  editing". Closing or reloading the page with changed input leaves the
  question to the browser's own prompt.

### Outcome of a Change

- The UI shows a change only after the API confirms it, and then reads again
  the data that the change affects (`docs/conventions.md`, Data Read from the
  API).
- A result that shows where the user acted, such as an edited value, needs no
  message, and the change is announced (Accessibility).
- Any other successful change shows a short message in the screen's message
  area that says what happened, such as "API key revoked."; it stays until the
  user dismisses it or leaves the screen.
- A change that creates a record with a screen of its own opens that screen,
  with a message such as "Ticket SNTL-42 created.".
- An operation that Sentinel accepts with `202` has started, not finished:
  its message says so, such as "Refetch started.", and links to the screen
  that shows its progress, when one does.
- A change that fails follows Errors.

## Accessibility

Every screen meets WCAG 2.2 at levels A and AA in the supported browsers
(`docs/architecture.md`, Supported Browsers). Lint and axe-core check only
part of it (`docs/architecture.md`, Static Checks and Tests), so every screen
also meets these requirements, which they cannot check:

- **Keyboard.** Every function works with the keyboard alone, in an order that
  follows the reading order, and the focus is never trapped. The focus is
  always visible, and no fixed element, such as the header, hides it (2.1.1
  Keyboard; 2.1.2 No Keyboard Trap; 2.4.3 Focus Order; 2.4.7 Focus Visible;
  2.4.11 Focus Not Obscured (Minimum)).
- **Structure.** The first element that takes the focus is a link that skips
  to the main content. Every screen has its header, navigation, and main
  content as landmarks, and one level-one heading that names the screen
  (2.4.1 Bypass Blocks; 1.3.1 Info and Relationships).
- **Page title.** The title of the page is the screen's heading followed by
  "– Sentinel", such as "SNTL-42 – Sentinel", "Tickets – Sentinel", or "Not
  found – Sentinel" (2.4.2 Page Titled).
- **Focus after a navigation.** When the screen changes, the focus moves to
  its level-one heading. A change of the state that a screen keeps in its URL,
  such as its view, filters, sorting, or page, leaves the focus where it was
  and announces the number of results.
- **Dialogs.** A dialog takes the focus when it opens: its first field, or
  Cancel in a confirmation. Escape closes it, and the focus then returns to
  the element that opened it, or to the screen's heading when that element is
  gone, such as after a deletion.
- **Announcements.** A message that appears without a navigation, such as the
  outcome of a change or the error of an action, is announced without moving
  the focus (4.1.3 Status Messages). After a form is submitted with errors,
  the focus moves to the message at the top of the form, or to the field when
  only one field has an error (3.3.1 Error Identification).
- **Reflow and text size.** Screens work at a width of 320 CSS pixels without
  scrolling in two directions, except data tables, which scroll within
  themselves, and text enlarged to 200 % loses no content or function (1.4.4
  Resize Text; 1.4.10 Reflow).
- **Color.** No information is conveyed by color alone, such as a status, a
  deadline, or the state of a user (1.4.1 Use of Color).
- **Sign in.** The username and password fields state their purpose to the
  browser and accept pasting and password managers, and signing in needs no
  other test (1.3.5 Identify Input Purpose; 3.3.8 Accessible Authentication
  (Minimum)).

## Wording

### Domain Terms

- The UI names domain concepts with Sentinel's terms, as its specifications
  write them, capitalization included, such as Ticket, CVE, Product,
  codestream, and track (Sentinel `docs/conventions.md`, Terminology, and the
  owning feature specifications). This document adopts them by reference and
  lists none. For example, a Ticket status is active or inactive, never open
  or closed (Sentinel `docs/conventions.md`, Ticket Status Category
  Terminology), and a user is local or external (same document, External
  Identity / SSO Terminology).
- A value of the contract shows as the name that Sentinel's specifications
  give it, in sentence case, such as `analyzed` as "Analyzed" (Sentinel
  `docs/features/tickets/tickets.md`, Statuses) or `vulnerability_analyst` as
  "Vulnerability analyst". An unknown value shows as received (Unknown
  Values).

### Actions

- **Sign in** and **Sign out** name the start and the end of a session: the
  screen, its button, and the entry of the account menu. The path of Sign in
  stays `/login` (`docs/screen-map.md`, Contract URLs).
- An action that performs an operation that Sentinel names takes that name,
  such as Ignore, Reopen, Refetch, Grant access, Revoke access, Unlock,
  Deactivate, Reactivate, Exclude, and Restore.
- Every other action uses one of these verbs:

| Verb | Use |
|---|---|
| Create | Make a new record, such as a Ticket, a local user, or an API key |
| Add | Attach an item to a record, such as a package or a reference to a Ticket |
| Edit | Open existing values for change |
| Save | Submit changed values |
| Cancel | Leave an edit or a dialog without a change |
| Delete | Remove a record for good, such as a reference |
| Remove | Take an item out of a set that the user edits, such as a role from a user's roles |
| Discard | Drop input not yet submitted |

### Style

- Text is in US English, as the documents of both repositories are.
- Headings, labels, buttons, and menu entries use sentence case: only the
  first word, names, and the domain terms that Sentinel capitalizes start with
  a capital letter.
- A button or menu entry names its action with a verb and, where the screen
  offers it for several objects, its object, such as "Revoke API key"; never
  "OK", "Yes", or "Submit".
- A message states what happened and, when the user can do something about
  it, what to do. It blames no one and holds no technical detail except the
  reference of an error (Default Presentation by Status), and it uses
  contractions, such as "can't".
- A count uses the singular or the plural, such as "1 Ticket" and "2
  Tickets", and groups thousands with commas, such as "1,250".
- The header and the page titles name the product Sentinel. Sentinel Aura is
  the name of this user interface, which the UI shows only next to its
  version.

## Representation of a User

Every screen shows a user in the same way, from the fields that every user
representation of the API carries, a user reference, a directory entry, the
complete profile and its manager, and the signed-in user alike: `id`,
`username`, `full_name`, `active`, and `bot` (Sentinel
`docs/features/identity/user-management.md`, Bot Accounts; Sentinel
`docs/api-spec.md`, User References in Responses).

- **Display name.** `full_name`, or `username` when `full_name` is `null` or
  blank: Sentinel returns `full_name` as stored and leaves the fallback to the
  presentation (Sentinel `docs/features/identity/user-management.md`, Get
  User).
- **Avatar.** A picture that the UI generates from the user's `id`, which
  never changes; the design system defines it.
- **Full form.** The avatar followed by the display name. The avatar is
  hidden from assistive technologies, because the name identifies the user.
  Where users must be told apart exactly, such as in a user picker, the
  access grants of a Ticket, or Administration, the username follows the
  display name when the two differ.
- **Compact form.** The avatar alone, in a link, a button, or another
  interactive element without room for the name. The display name is its
  accessible name and shows in a tooltip on hover and on keyboard focus. Every
  other place shows the full form.
- **Inactive user** (`active` is `false`). The label "Inactive" follows the
  name; in the compact form, the accessible name and the tooltip end with
  "(inactive)".
- **Bot account** (`bot` is `true`), an account that an automation operates
  instead of a person. The label "Bot" follows the name; in the compact form,
  "(bot)". A bot account is still a user, with its own avatar, and an
  inactive bot account shows both labels.
- **No recorded actor.** A recorded action whose actor is `null`, such as one
  of a system task or of an external provisioning sync (Sentinel
  `docs/features/identity/rbac.md`, Actor Identities), shows "System" with an
  icon of its own instead of an avatar, so that it differs from a bot account.
  Only the actor of a recorded action is "System": another field without a
  user, such as the assignee of an unassigned Ticket, is an absent value
  (Absent Values).
- **Sizes.** Three sizes: small for text and table rows, medium for lists and
  the account menu, and large for the heading of a user's screen. The design
  system defines their dimensions and how the labels look, never by color
  alone (Accessibility).

## Open Decisions

A decision that is not taken yet is listed here, with who takes it, and every
design that depends on it waits for it.

- **The frontend session behavior.** Sentinel's specifications define the
  post-login redirect and the session expiration handling, with the texts of
  its login flows (Sentinel `docs/features/identity/authentication.md`,
  Frontend session behavior), and remain their authority until a pinned
  Sentinel version moves them to this repository (`README.md`, Specification
  Boundary). Sentinel takes the decision. Until then, Return After Sign-in and
  Session Expiration Message do not take effect, and the implementation of
  the session handling and of Sign in waits for that version; this entry is
  then removed.
