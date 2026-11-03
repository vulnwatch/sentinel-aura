# Ticket list

This screen document records the Ticket list as built (`docs/conventions.md`,
Screen Documents). It follows the foundation documents and states only what
the screen adds to them: the views belong to `docs/screen-map.md` (Ticket
List Views), the presentation of the values of a Ticket to
`docs/design-system.md` (Values) and `docs/behaviors.md` (Deadlines), and the
layout of a list to `docs/design-system.md` (Lists; Tables). Backend behavior
and the API contract belong to Sentinel (`README.md`, Specification
Boundary).

## Purpose

The Ticket list shows the Tickets in the views of `docs/screen-map.md`
(Ticket List Views). Vulnerability analysts work their queues in it, starting
from the queue of new Tickets, their landing; every other user finds a Ticket
in it, starting from all of them (`docs/screen-map.md`, Users and Frequent
Tasks; Landing).

## Access

- Every signed-in user opens it; it needs no capability. It shows the Tickets
  that List Tickets returns to the user, whose scope, access grants, and
  package maintainership decide which confidential Tickets they are
  (Sentinel `docs/features/tickets/tickets.md`, List Tickets; Sentinel
  `docs/features/identity/rbac.md`, Scope and Confidential Ticket
  Visibility).
- The Assigned to me view shows only to a user whose roles include
  `vulnerability_analyst`, as Get Current User returns them (Sentinel
  `docs/features/identity/authentication.md`, Get Current User;
  `docs/screen-map.md`, Roles, Principles).

## Navigation

- Path: `/tickets` (`docs/screen-map.md`, Areas and Screens), with these
  search parameters:

  | Parameter | Values | Without it |
  |---|---|---|
  | `view` | `new`, `assigned-to-me`, `analysis`, `analyzed`, `unassigned` | The All view |
  | `page` | A whole number from 1 to 2147483647, the largest page that Sentinel accepts (Sentinel `docs/api-spec.md`, Pagination) | The first page |

  A link to a view leads to its first page and omits `page`, and so does a
  link to the first page of a view.
- Any other search parameter, and a value that the list does not accept, is
  removed from the URL in place of the URL in the browser history, before
  the list reads anything (`docs/behaviors.md`, Invalid Search Parameters).
  A user who is not shown Assigned to me sees the All view for
  `view=assigned-to-me`, and the list removes the parameter in the same way
  once it knows the user, also when a read of the signed-in user tells that
  the role was removed during the session (`docs/behaviors.md`, The
  Signed-in User); no request carries it. The other parameters and the
  fragment stay.
- The Tickets entry of the sidebar leads to `/tickets?view=new` for a user
  who holds the `vulnerability_analyst` role, and to `/tickets` for every
  other user. For such a user, `/` leads to `/tickets?view=new`, in place of
  `/` in the browser history, from every way to the landing, and so does the
  Home when a read of the signed-in user tells that the role was added
  while it shows (`docs/screen-map.md`, Sidebar; Landing; Browser History).
- A view and a page are each an entry of the browser history.
- Each row links to its Ticket, `/tickets/{ticket_id}`, and to its CVE,
  `/cves/{cve_id}` (`docs/screen-map.md`, Links Between Areas).

## Content

- The heading "Tickets", and the page title "Tickets – Sentinel".
- The views as tabs, named "Views" for assistive technologies, each its name
  followed by the number of its Tickets. The number comes from List Tickets,
  `GET /api/v1/tickets`, with the filters of the view and `per_page=1`, as
  `meta.total` (Sentinel `docs/features/tickets/tickets.md`, List Tickets),
  without the page and the sorting of the list. Every number is read again
  with each read of the list, such as another view or page, so that the tabs
  show the size of each queue as the list does.
- The table of the Tickets of the view, "Tickets" for assistive
  technologies, from List Tickets with the filters and the sorting of the
  view, `sort_order=desc`, the page, and `per_page=20`. A filter with several
  values repeats its parameter, such as `status=analysis&status=analyzed`
  (Sentinel `docs/api-spec.md`, Enum Filter Validation).

| View | Filters | Sorted by | Columns |
|---|---|---|---|
| New | `status=new` | Priority | Ticket, CVE, Title, Severity, Priority, Deadline |
| Assigned to me | `assignee` with the `id` of the signed-in user, `status=analysis`, `status=analyzed` | Priority | Ticket, CVE, Title, Status, Severity, Priority, Deadline |
| Analysis | `status=analysis` | Priority | Ticket, CVE, Title, Severity, Priority, Deadline, Assignee |
| Analyzed | `status=analyzed` | Priority | Ticket, CVE, Title, Severity, Priority, Deadline, Assignee |
| Unassigned | `status=analysis`, `status=analyzed`, `assignee=none` | Priority | Ticket, CVE, Title, Status, Severity, Priority, Deadline |
| All | None | Last modified | Ticket, CVE, Title, Status, Severity, Priority, Deadline, Assignee, Last modified |

- A view omits a column whose value its filters fix: Status where the view
  has one status, Assignee where it has none or only the signed-in user.
- Assigned to me filters by the user's `id`, which never changes, rather than
  by the username (Sentinel `docs/api-spec.md`, User Identifier Resolution).
- **Sorting.** Priority is `sort_by=priority`: P1 first, then P2 to P4, and a
  Ticket without a priority last (Sentinel `docs/api-spec.md`, Semantic Sort
  Fields; Nullable Sort Field Ordering). List Tickets sorts by one field, and
  orders the Tickets of the same priority by their internal `id`, in the same
  direction (Sentinel `docs/api-spec.md`, Sort Parameter Validation;
  Deterministic Pagination Ordering), which is a UUIDv7 (Sentinel
  `docs/features/tickets/tickets.md`, Ticket Identification), so the newest
  Ticket comes first. Last modified is `sort_by=updated_at`, the most recent
  first. The sorted column shows `arrow-down` after its name, and assistive
  technologies read its name followed by "(sorted descending)".
- **Ticket**: the identifier, which names the row, as a link to the Ticket at
  weight 500, followed by `lock` when the Ticket is confidential
  (`docs/design-system.md`, Tables; Confidential Tickets).
- **CVE**: the CVE ID as a link to the CVE at weight 500
  (`docs/design-system.md`, Type Scale), or an absent value for a Ticket
  without a CVE.
- **Title**: the title of the CVE, `cve.title`, the only title of a Ticket
  that List Tickets returns, or an absent value when it is `null` or the
  Ticket has no CVE. The column takes the width that the others leave, at
  least 100 px, and cuts a longer title with an ellipsis, which assistive
  technologies read whole.
- **Status**, **Severity**, and **Priority**: as `docs/design-system.md`
  (Ticket Status; Severity; Priority) shows them, the effective priority
  included.
- **Deadline**: the deadline badge (`docs/behaviors.md`, Deadlines), which
  compares the dates with the instant at which the data of the list arrived,
  the same for every row. A Ticket without a deadline leaves the place empty.
- **Assignee**: the user in the full form at the small size
  (`docs/behaviors.md`, Representation of a User), or "Unassigned", the
  precise name of the absence (`docs/behaviors.md`, Absent Values).
- **Last modified**: `updated_at`, as a date and time (`docs/behaviors.md`,
  Display). It is the last change of the Ticket record, whose columns include
  its status and its automatic priority (Sentinel `docs/data-model.md`,
  Ticket); Sentinel does not state whether a change of the packages,
  references, or CVSS assessments of a Ticket moves it, so the column names a
  modification of the Ticket, not its last activity.
- **Pagination**, below the table, when the view has more than one page
  (`docs/design-system.md`, Lists): Previous and Next are links to their
  pages. When the one that holds the focus leads to the first or the last
  page, where it is disabled, the focus moves to the other one
  (`docs/behaviors.md`, Accessibility, Focus after an action). It goes with
  the rows when an error takes their place.

## States

- **Loading.** The heading, the tabs, and the header row of the table show
  at once; the loading indicator shows inside the frame of the table, below
  the header row, and a count that waits leaves its name alone
  (`docs/behaviors.md`, Loading; `docs/design-system.md`, Tables).
- **Another view or page.** The rows that show stay, with the columns, the
  sorting, and the pagination of their view, until the new rows arrive, and
  are marked by the progress bar along the top edge of the frame once the
  new rows take longer than 300 milliseconds (`docs/behaviors.md`, Loading).
  The tab of the new view is selected at once. The focus stays where it was,
  and once the new rows show, assistive technologies announce what the list
  shows: "12 Tickets", "21–26 of 26 Tickets" when the view has more than one
  page, or the message of an empty state, also when the words are those of
  the previous view. The list as the screen opens is not announced: only a
  change of the view or the page is (`docs/behaviors.md`, Accessibility,
  Focus after a navigation).
- **The focus.** When the control that holds the focus leaves the page, such
  as "Go to the first page" once the rows arrive, or the pagination when an
  error takes the place of the rows, the focus moves to the screen's heading
  (`docs/behaviors.md`, Accessibility, Focus after an action).
- **Empty.** A view without Tickets says "No Tickets in this view.", on any
  page. A page beyond the last of a view with Tickets says "There are no
  Tickets on this page." and offers "Go to the first page", a link that looks
  like a secondary button, in place of the pagination (`docs/behaviors.md`,
  Empty States). Both show inside the frame, below the header row, and keep
  the tabs.
- **Errors.** The default presentation applies to every failure
  (`docs/behaviors.md`, Errors): the error of the first read of the list
  replaces the screen; the error of a read of another view or page shows in
  place of the rows, inside the frame, and keeps the tabs; and the error of a
  new read of the rows that show shows above the frame, with the rows. A
  count whose read fails shows an en dash, read as "Not available", until
  its next read, with the next read of the list, succeeds. The screen
  handles no error code
  specifically: List Tickets documents only the global responses (Sentinel
  `docs/features/tickets/tickets.md`, List Tickets).

## Cross-references

- `docs/screen-map.md` — Users and Frequent Tasks; Areas and Screens;
  Sidebar; Links Between Areas; Browser History; Landing; Ticket List Views;
  Contract URLs; Roles
- `docs/behaviors.md` — The Signed-in User; Errors; Invalid Search
  Parameters; Unknown Values; Loading and Empty States; Dates and Times;
  Accessibility; Representation of a User
- `docs/design-system.md` — Type Scale; Values; Buttons and Links; Lists;
  Tables; Loading; Empty States; Errors in Place of Content
- Sentinel `docs/features/tickets/tickets.md` — Ticket Identification;
  Statuses; Confidential Tickets; TicketSummary; List Tickets; Reassignment
- Sentinel `docs/data-model.md` — Ticket
- Sentinel `docs/features/tickets/ticket-priority.md` — Priority Levels;
  Persistence and Effective Priority
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Sorting; Ticket
  Current Phase
- Sentinel `docs/features/identity/authentication.md` — Get Current User
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility
- Sentinel `docs/api-spec.md` — Pagination; Enum Filter Validation; Sorting;
  User Identifier Resolution
