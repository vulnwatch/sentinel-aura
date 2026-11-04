# Ticket list

This screen document records the Ticket list as built (`docs/conventions.md`,
Screen Documents). It follows the foundation documents and states only what
the screen adds to them: the views and the attention summary belong to
`docs/screen-map.md` (Ticket List Views; Attention Summary), the presentation
of the values of a Ticket to `docs/design-system.md` (Values) and
`docs/behaviors.md` (Deadlines), and the layout of a list to
`docs/design-system.md` (Lists; Tables). Backend behavior and the API
contract belong to Sentinel (`README.md`, Specification Boundary).

## Purpose

The Ticket list shows the Tickets in the views of `docs/screen-map.md`
(Ticket List Views), which the user refines with a search, filters, and the
sorting of its columns. Vulnerability analysts work their queues in it,
starting from the queue of new Tickets, their landing, with the attention
summary above the views; every other user finds a Ticket in it, starting
from all of them (`docs/screen-map.md`, Users and Frequent Tasks; Landing).

## Access

- Every signed-in user opens it; it needs no capability. It shows the Tickets
  that List Tickets returns to the user, whose scope, access grants, and
  package maintainership decide which confidential Tickets they are
  (Sentinel `docs/features/tickets/tickets.md`, List Tickets; Sentinel
  `docs/features/identity/rbac.md`, Scope and Confidential Ticket
  Visibility).
- The Assigned to me view and the attention summary show only to a user
  whose roles include `vulnerability_analyst`, as Get Current User returns
  them (Sentinel `docs/features/identity/authentication.md`, Get Current
  User; `docs/screen-map.md`, Roles, Principles).

## Navigation

- Path: `/tickets` (`docs/screen-map.md`, Areas and Screens), with these
  search parameters, each value as text and a parameter with several values
  once for each, such as `status=new&status=analysis`:

  | Parameter | Values | Without it |
  |---|---|---|
  | `view` | `new`, `assigned-to-me`, `analysis`, `analyzed`, `orphaned` | The All view |
  | `search` | The search term, at most 500 characters, without surrounding whitespace and without U+0000, which Sentinel rejects (Sentinel `docs/api-spec.md`, Query Parameter Length Limit; Inadmissible Characters in Request Input) | No search |
  | `status` | One or more of `new`, `analysis`, `analyzed`, `resolved`, `ignored`, `duplicated`, in the All view only | No filter by status |
  | `severity` | One or more of `critical`, `high`, `medium`, `low`, `none`, `unresolved` | No filter by severity |
  | `priority` | One or more of `p1`, `p2`, `p3`, `p4`, `unresolved` | No filter by priority |
  | `phase` | One or more of `triage`, `submission`, `um`, `qa`, `done`: the current phase | No filter by current phase |
  | `overdue` | One or more of `triage`, `submission`, `um`, `qa`: the phases whose milestones are past due | No filter by overdue phase |
  | `sort` | `ticket`, `status`, `severity`, `priority`, `deadline`, `last-modified`: a sortable column that the view shows | The sorting of the view |
  | `order` | `asc` or `desc` | The first direction of the column |
  | `page` | A whole number from 1 to 2147483647, the largest page that Sentinel accepts (Sentinel `docs/api-spec.md`, Pagination) | The first page |

  A link to a view leads to its first page and omits `page`, and so does a
  link to the first page of a view. A sorting that is the view's, and a
  direction that is the first of its column, are omitted too.
- Any other search parameter, a value that the list does not accept, and a
  parameter other than a filter that the URL gives more than once are
  removed from the URL in place of the URL in the browser history, before the
  list reads anything (`docs/behaviors.md`, Invalid Search Parameters). So
  are a status filter outside the All view, whose statuses the view fixes,
  and a sorting by a column that the view does not show, with its order. A
  filter keeps the values that it knows, once each, in the order of the table
  above, and a search term loses its surrounding whitespace, both in place of
  the URL in the browser history. A user who is not shown Assigned to me sees
  the All view for `view=assigned-to-me`, and the list removes the parameter
  in the same way once it knows the user, also when a read of the signed-in
  user tells that the role was removed during the session
  (`docs/behaviors.md`, The Signed-in User); no request carries it. The other
  parameters and the fragment stay.
- The Tickets entry of the sidebar leads to `/tickets?view=new` for a user
  who holds the `vulnerability_analyst` role, and to `/tickets` for every
  other user. For such a user, `/` leads to `/tickets?view=new`, in place of
  `/` in the browser history, from every way to the landing, and so does the
  Home when a read of the signed-in user tells that the role was added
  while it shows (`docs/screen-map.md`, Sidebar; Landing; Browser History).
- A view, a page, a search, a change of the filters, and a sorting are each
  an entry of the browser history. A tab opens its view at its first page,
  without the search, the filters, and the sorting that the user applied, so
  that the list agrees with the count of the tab. A change of the search, the
  filters, or the sorting opens the first page and keeps the view; Previous,
  Next, and "Go to the first page" keep the search, the filters, and the
  sorting.
- Each row links to its Ticket, `/tickets/{ticket_id}`, and to its CVE,
  `/cves/{cve_id}` (`docs/screen-map.md`, Links Between Areas). Each count of
  the attention summary links to the All view refined to its Tickets.

## Content

- The heading "Tickets", and the page title "Tickets – Sentinel".
- **Attention summary**, for a user who holds the `vulnerability_analyst`
  role, in the heading row after the heading, named "Tickets that need
  attention" for assistive technologies: the five counts of
  `docs/screen-map.md` (Attention Summary), in this order, each read from List
  Tickets, `GET /api/v1/tickets`, with its filters and `per_page=1`, as
  `meta.total`, and each a link to the All view with the same filters:

  | Count | Filters of List Tickets | Link |
  |---|---|---|
  | Active P1 | `priority=p1`, `status=new`, `status=analysis`, `status=analyzed` | `/tickets?status=new&status=analysis&status=analyzed&priority=p1` |
  | Triage overdue | `current_phase=triage`, `overdue=triage` | `/tickets?phase=triage&overdue=triage` |
  | Submission overdue | `current_phase=submission`, `overdue=submission` | `/tickets?phase=submission&overdue=submission` |
  | UM overdue | `current_phase=um`, `overdue=um` | `/tickets?phase=um&overdue=um` |
  | QA overdue | `current_phase=qa`, `overdue=qa` | `/tickets?phase=qa&overdue=qa` |

  The counts do not depend on the view, the search, the filters, or the
  sorting. They are read again as the screen's data is, such as when the tab
  of the browser returns to the foreground (`docs/behaviors.md`, Loading),
  and a count that is not available is read again with each read of the list.
- The views as tabs, named "Views" for assistive technologies, each its name
  followed by the number of its Tickets. The number comes from List Tickets
  with the filters of the view and `per_page=1`, as `meta.total` (Sentinel
  `docs/features/tickets/tickets.md`, List Tickets), without the page, the
  sorting, the search, and the filters of the list. The number of the view
  that the list shows is read again when its view opens and with each read of
  the list, such as another page, so that the tab and the list agree;
  the others are read again as the screen's data is.
- **The toolbar**, after the tabs, at the end of their row; when the width
  runs short, its last controls wrap to a row below, Clear filters first
  (`docs/design-system.md`, Lists):
  - the search field, "Search Tickets", which is also its name for
    assistive technologies. Enter applies the term without its surrounding
    whitespace, and its clear button, "Clear search", and Escape remove it. It
    takes at most 500 characters. List Tickets matches the term against the
    identifier, the CVE ID, the package names, and the external identifiers
    of each Ticket (Sentinel `docs/features/tickets/tickets.md`, Search);
  - Filters, followed by the number of the filters that apply, which
    assistive technologies read as "2 applied". It opens a popover named
    "Filters" with a group of checkboxes for each filter below, and a change
    applies at once. While it is open, it announces itself what the list
    shows after a change, or the failure of its read, since the rest of the
    screen is then out of reach of assistive technologies. Its filters scroll
    within it in a window shorter than they are;
  - Clear filters, while a search or a filter applies, which removes them and
    keeps the view and the sorting.

  | Filter | Values | Of List Tickets |
  |---|---|---|
  | Status, in the All view only | New, Analysis, Analyzed, Resolved, Ignored, Duplicated, each with its mark | `status` (Sentinel `docs/features/tickets/tickets.md`, Statuses) |
  | Severity | Critical, High, Medium, Low, None, each with its mark, and Not set for a Ticket without a severity | `severity`, with `unresolved` for Not set |
  | Priority | P1, P2, P3, P4, each with its mark, and Not set for a Ticket that is not yet prioritizable | `priority`, the effective priority, with `unresolved` for Not set (Sentinel `docs/features/tickets/ticket-priority.md`, Persistence and Effective Priority) |
  | Current phase | Triage, Submission, UM, QA, Done | `current_phase`; a Ticket without a current phase matches none (Sentinel `docs/features/tickets/ticket-deadlines.md`, Current Phase Filter) |
  | Overdue | Triage, Submission, UM, QA | `overdue`: a phase whose milestone is past due and not completed (Sentinel `docs/features/tickets/ticket-deadlines.md`, Ticket-Level Overdue Filter) |

  A filter with several values matches a Ticket that has any of them, and the
  filters and the search together match a Ticket that each of them matches
  (Sentinel `docs/api-spec.md`, Filtering; Enum Filter Validation).
- The table of the Tickets of the view, "Tickets" for assistive
  technologies, from List Tickets with the filters of the view, the search
  and the filters that the user applied, the sorting, the page, and
  `per_page=20`. A filter with several values repeats its parameter, such as
  `status=analysis&status=analyzed` (Sentinel `docs/api-spec.md`, Enum Filter
  Validation).

| View | Filters | Sorted by | Columns |
|---|---|---|---|
| New | `status=new` | Priority, then deadline | Ticket, CVE, Title, Packages, Severity, Priority, Deadline |
| Assigned to me | `assignee` with the `id` of the signed-in user, `status=analysis`, `status=analyzed` | Priority, then deadline | Ticket, CVE, Title, Packages, Status, Severity, Priority, Deadline |
| Analysis | `status=analysis` | Priority, then deadline | Ticket, CVE, Title, Packages, Severity, Priority, Deadline, Assignee |
| Analyzed | `status=analyzed` | Priority, then deadline | Ticket, CVE, Title, Packages, Severity, Priority, Deadline, Assignee |
| Orphaned | `status=analysis`, `status=analyzed`, `assignee=none` | Priority, then deadline | Ticket, CVE, Title, Packages, Status, Severity, Priority, Deadline |
| All | None | Last modified | Ticket, CVE, Title, Packages, Status, Severity, Priority, Deadline, Assignee, Last modified |

- A view omits a column whose value its filters fix: Status where the view
  has one status, Assignee where it has none or only the signed-in user.
- Assigned to me filters by the user's `id`, which never changes, rather than
  by the username (Sentinel `docs/api-spec.md`, User Identifier Resolution).
- **Sorting.** The user sorts by a column by pressing its header, with a
  click, Enter, or Space: the first press sorts in the first direction of the
  column, and the next reverses it. The sorted column shows `arrow-up` or
  `arrow-down` after its name, and assistive technologies read whether and in
  which direction each sortable column sorts the rows. The header shows the
  new sorting at once, while the rows of the previous one stay until the new
  rows arrive.

  | Column | `sort_by` | First direction |
  |---|---|---|
  | Ticket | `ticket_id`, by its number | Descending, the newest first |
  | Status | `status`, from New to Duplicated | Ascending |
  | Severity | `severity`, from Critical to None, and a Ticket without one last | Descending |
  | Priority | `priority_then_current_due` | Descending |
  | Deadline | `current_due_at` | Ascending, the earliest first |
  | Last modified | `updated_at` | Descending, the most recent first |

  The CVE, Title, Packages, and Assignee columns are not sortable. Priority,
  then deadline, the sorting of the queues, is `priority_then_current_due`
  descending: by effective priority, P1 first, then P2 to P4, and a Ticket
  without a priority last; within one priority by the due date of the current
  phase, the deadline that the row's badge names (`docs/behaviors.md`,
  Deadlines), earliest first, so that a past deadline comes before one still
  ahead, and a Ticket without a deadline last. Ascending reverses both keys,
  and a Ticket without a priority or a deadline stays last. Deadline sorts by
  that due date alone, and a Ticket without a deadline is last in either
  direction (Sentinel `docs/features/tickets/ticket-deadlines.md`, Current
  Due Date; Sentinel `docs/api-spec.md`, Semantic Sort Fields; Nullable Sort
  Field Ordering). Tickets that the keys leave equal follow their internal
  `id`, in the direction of `sort_order` (Sentinel `docs/api-spec.md`,
  Deterministic Pagination Ordering), which is a UUIDv7 (Sentinel
  `docs/features/tickets/tickets.md`, Ticket Identification), so the newest
  Ticket comes first when descending. Last modified, the sorting of the All
  view, is `updated_at` descending, the most recent first.
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
- **Packages**: the package names of the Ticket, `package_names`, in the
  order that List Tickets returns them (Sentinel
  `docs/features/tickets/tickets.md`, TicketSummary): the first, then "+N"
  with the others (`docs/design-system.md`, Tables), such as "1 more package:
  fictional-zlib" for assistive technologies, or an absent value for a Ticket
  without packages. The search matches package names, so the column shows
  why a row matches.
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

- **Loading.** The heading, the attention summary, the tabs, the toolbar, and
  the header row of the table show at once; the loading indicator shows
  inside the frame of the table, below the header row, and a count that
  waits leaves its name alone (`docs/behaviors.md`, Loading;
  `docs/design-system.md`, Tables).
- **Another view, page, search, filter, or sorting.** The rows that show
  stay, with the columns and the pagination of their data, until the new rows
  arrive, and are marked by the progress bar along the top edge of the frame
  once the new rows take longer than 300 milliseconds (`docs/behaviors.md`,
  Loading). The tab of the new view, the search field, the filters, and the
  sorting of the header show the new state at once; the rows of another view
  keep the sorting of their own. The focus stays where it was, and once the
  new rows show, assistive technologies announce what the list shows:
  "12 Tickets", "21–26 of 26 Tickets" when the list has more than one page,
  or the message of an empty state, also when the words are those of the
  previous list. The list as the screen opens is not announced: only a
  change of the view, the page, the search, the filters, or the sorting is
  (`docs/behaviors.md`, Accessibility, Focus after a navigation).
- **The focus.** When the rows, the table without rows, the action of an
  empty state, the pagination, a tab, a count of the attention summary, or
  Clear filters leaves the page while it holds the focus, such as "Go to the
  first page" once the rows arrive, the pagination when an error takes the
  place of the rows, Clear filters once it removed the search and the
  filters, or Assigned to me and the attention summary when a read of the
  signed-in user tells that the role was removed, the focus moves to the
  screen's heading (`docs/behaviors.md`, Accessibility, Focus after an
  action). The popover of the filters takes the focus on its first checkbox
  as it opens; Escape or a click outside closes it, and the focus returns to
  Filters (`docs/behaviors.md`, Accessibility, Dialogs).
- **Empty.** A view without Tickets says "No Tickets in this view.", on any
  page. A list that the user refined without Tickets that match says "No
  Tickets match the search." when only a search applies and "No Tickets match
  the filters." otherwise, on any page, and offers Clear filters as a
  secondary button. A page beyond the last of a list with Tickets says "There
  are no Tickets on this page." and offers "Go to the first page", a link that
  looks like a secondary button, in place of the pagination
  (`docs/behaviors.md`, Empty States). Each shows inside the frame, below the
  header row, and keeps the tabs and the toolbar.
- **Errors.** The default presentation applies to every failure
  (`docs/behaviors.md`, Errors): the error of the first read of the list
  replaces the screen; the error of a read of another view, page, search,
  filter, or sorting shows in place of the rows, inside the frame, and keeps
  the tabs and the toolbar; and the error of a new read of the rows that show
  shows above the frame, with the rows. A count of a view or of the attention
  summary whose read fails shows an en dash, read as "Not available" after the
  name of a view and as "not available" after the name of a count of the
  summary, until a later read of it succeeds; each read of the list reads it
  again. The screen handles no error code specifically: List Tickets
  documents only the global responses (Sentinel
  `docs/features/tickets/tickets.md`, List Tickets).

## Cross-references

- `docs/screen-map.md` — Users and Frequent Tasks; Areas and Screens;
  Sidebar; Links Between Areas; Browser History; Landing; Ticket List Views;
  Attention Summary; Contract URLs; Roles
- `docs/behaviors.md` — The Signed-in User; Errors; Invalid Search
  Parameters; Unknown Values; Loading and Empty States; Dates and Times;
  Accessibility; Wording; Representation of a User
- `docs/design-system.md` — Type Scale; Values; Other Values; Buttons and
  Links; Lists; Tables; Forms; Loading; Empty States; Errors in Place of
  Content; Menus, Popovers, and Tooltips
- Sentinel `docs/features/tickets/tickets.md` — Ticket Identification;
  Search; Statuses; Confidential Tickets; TicketSummary; List Tickets;
  Reassignment
- Sentinel `docs/data-model.md` — Ticket
- Sentinel `docs/features/tickets/ticket-priority.md` — Priority Levels;
  Persistence and Effective Priority
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Ticket-Level Overdue
  Filter; Ticket Current Phase (Relation to the Overdue Filter; Current Phase
  Filter); Sorting, Current Due Date
- Sentinel `docs/features/identity/authentication.md` — Get Current User
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility
- Sentinel `docs/api-spec.md` — Query Parameter Length Limit; Inadmissible
  Characters in Request Input; Pagination; Filtering; Enum Filter
  Validation; Sorting; User Identifier Resolution
