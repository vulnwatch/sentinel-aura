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
sorting of its columns. It is the landing of every user. Vulnerability and
restricted analysts work their queues in it, starting from the queue of new
Tickets; every other user finds a Ticket in it, starting from all of them.
The attention summary above the views shows every user the Tickets that need
attention. The analysts who hold `manage_confidentiality` also follow the
embargoes in the Embargo view, and the summary counts for them those whose
Coordinated Release Date has passed (`docs/screen-map.md`, Users and Frequent
Tasks; Landing; Ticket List Views; Attention Summary).

## Access

- Every signed-in user opens it; it needs no capability. It shows the Tickets
  that List Tickets returns to the user, whose scope, access grants, and
  package maintainership decide which confidential Tickets they are
  (Sentinel `docs/features/tickets/tickets.md`, List Tickets; Sentinel
  `docs/features/identity/rbac.md`, Scope and Confidential Ticket
  Visibility).
- Two views, and one count of the attention summary, show only to some users,
  as Get Current User describes them (Sentinel
  `docs/features/identity/authentication.md`, Get Current User;
  `docs/screen-map.md`, Roles, Principles):
  - Assigned to me, to a user who can be the assignee of a Ticket: one whose
    `assignment_eligibility` is `all` or `non_confidential` (Sentinel
    `docs/features/identity/rbac.md`, Assignment Eligibility Wire Format);
  - Embargo and the Embargo expired count, to a user whose `capabilities`
    include `manage_confidentiality` (Sentinel
    `docs/features/identity/rbac.md`, Capabilities).

## Navigation

- Path: `/tickets` (`docs/screen-map.md`, Areas and Screens), with these
  search parameters, each value as text and a parameter with several values
  once for each, such as `status=new&status=analysis`:

  | Parameter | Values | Without it |
  |---|---|---|
  | `view` | `new`, `unassigned`, `analysis`, `analyzed`, `assigned-to-me`, `embargo` | The All view |
  | `search` | The search term, at most 500 characters, without surrounding whitespace and without U+0000, which Sentinel rejects (Sentinel `docs/api-spec.md`, Query Parameter Length Limit; Inadmissible Characters in Request Input) | No search |
  | `status` | One or more of `new`, `analysis`, `analyzed`, `resolved`, `ignored`, `duplicated`, in the All and Embargo views only | No filter by status |
  | `embargo` | `expired`, in the Embargo view only: a Coordinated Release Date that has passed | No filter by embargo |
  | `severity` | One or more of `critical`, `high`, `medium`, `low`, `none`, `unresolved` | No filter by severity |
  | `priority` | One or more of `p1`, `p2`, `p3`, `p4`, `unresolved` | No filter by priority |
  | `phase` | One or more of `triage`, `submission`, `um`, `qa`, `done`: the current phase | No filter by current phase |
  | `overdue` | One or more of `triage`, `submission`, `um`, `qa`: the phases whose milestones are past due | No filter by overdue phase |
  | `sort` | `ticket`, `status`, `severity`, `priority`, `deadline`, `coordinated-release-date`, `last-modified`: a sortable column that the view shows | The sorting of the view |
  | `order` | `asc` or `desc` | The first direction of the column |
  | `page` | A whole number from 1 to 2147483647, the largest page that Sentinel accepts (Sentinel `docs/api-spec.md`, Pagination) | The first page |

  The URL leaves out a parameter whose value is the one of the last column,
  such as the first page, the sorting of the view, or the first direction of
  the column that sorts the rows.
- Any other search parameter, a value that the list does not accept, and a
  parameter other than a filter that the URL gives more than once are
  removed from the URL in place of the URL in the browser history, before the
  list reads anything (`docs/behaviors.md`, Invalid Search Parameters). So
  are a status filter in a view whose statuses its filters fix, an embargo
  filter outside the Embargo view, and a sorting that the list does not
  accept, such as by a column that the view does not show, with its order. A
  filter keeps the values that it knows, once each, in the order of the
  table above, a search term loses its surrounding whitespace, and a
  parameter that names the value of the last column, such as `page=1`, is
  left out, all in place of the URL in the browser history. A user who is
  not shown a view, Assigned to me or Embargo (Access), sees the All view for
  its `view`, and the list removes that parameter in the same way once it
  knows the user, with those that the All view does not accept, such as the
  embargo filter or a sorting by Coordinated Release Date, also when a read
  of the signed-in user tells during the session that the user is no longer
  shown the view (`docs/behaviors.md`, The Signed-in User); no request
  carries them. The other parameters and the fragment stay.
- The Tickets entry of the sidebar and `/`, the landing, lead to
  `/tickets?view=new` for a user who holds `triage_ticket`, and to `/tickets`
  for every other user. `/` leads there in place of itself in the browser
  history, from every way to the landing, such as the product name, "Go to
  the start page", and Sign in without a saved URL (`docs/screen-map.md`,
  Sidebar; Landing; Browser History).
- A view and a page are each an entry of the browser history, and so are a
  search, a change of the filters, and a sorting, which keep the view
  (`docs/design-system.md`, Lists). A tab opens its view at its first page,
  without the search, the filters, and the sorting that the user applied, so
  that the list agrees with the count of the tab.
- Each row links to its Ticket, `/tickets/{ticket_id}`. Its CVE ID is not a
  link: the address of the CVE would lead to the same Ticket
  (`docs/screen-map.md`, Links Between Areas). Each count of the attention
  summary links to the list refined to its Tickets: Embargo expired to the
  Embargo view, every other count to the All view.

## Content

- The heading "Tickets", and the page title "Tickets – Sentinel".
- **Attention summary**, in the heading row after the heading, named
  "Tickets that need attention" for assistive technologies: the counts of
  `docs/screen-map.md` (Attention Summary), in this order, Embargo expired
  only for a user who holds `manage_confidentiality` (Access), each read from
  List Tickets, `GET /api/v1/tickets`, with its filters and `per_page=1`, as
  `meta.total`, so that it counts the Tickets that the user sees, and each a
  link to the view of its Tickets with the same filters, so that the count
  and the rows agree.
  Active P1 and Embargo expired stand alone, and the four overdue counts,
  which never count the same Ticket, form the group "Overdue" after them
  (`docs/design-system.md`, Lists): each shows its phase, as "1 Triage", and
  is read with the name of the group, as "1 Triage overdue".

  | Count | Filters of List Tickets | Link |
  |---|---|---|
  | Active P1 | `priority=p1`, `status=new`, `status=analysis`, `status=analyzed` | `/tickets?status=new&status=analysis&status=analyzed&priority=p1` |
  | Embargo expired | `is_confidential=true`, `coordinated_release_passed=true` | `/tickets?view=embargo&embargo=expired` |
  | Triage overdue | `current_phase=triage`, `overdue=triage` | `/tickets?phase=triage&overdue=triage` |
  | Submission overdue | `current_phase=submission`, `overdue=submission` | `/tickets?phase=submission&overdue=submission` |
  | UM overdue | `current_phase=um`, `overdue=um` | `/tickets?phase=um&overdue=um` |
  | QA overdue | `current_phase=qa`, `overdue=qa` | `/tickets?phase=qa&overdue=qa` |

  The counts do not depend on the view, the search, the filters, or the
  sorting. They are read again as the screen's data is, such as when the tab
  of the browser returns to the foreground (`docs/behaviors.md`, Loading).
- The views as tabs, named "Views" for assistive technologies, each its name
  followed by the number of its Tickets, with the line that sets New and
  Unassigned apart before Analysis, the first view after them
  (`docs/screen-map.md`, Ticket List Views; `docs/design-system.md`, Lists).
  The number comes from List Tickets with the filters of the view and
  `per_page=1`, as `meta.total` (Sentinel `docs/features/tickets/tickets.md`,
  List Tickets), without the page, the sorting, the search, and the filters of
  the list. The number of the view that the list shows is read again when its
  view opens and with each read of the list, such as another page, so that
  the tab and the list agree; the others are read again as the screen's data
  is.
- **The toolbar**, after the tabs (`docs/design-system.md`, Lists):
  - the search field, "Search Tickets", which takes at most 500 characters,
    the longest term that Sentinel accepts (Sentinel `docs/api-spec.md`,
    Query Parameter Length Limit). List Tickets matches the term against the
    identifier, the CVE ID, the package names, and the external identifiers
    of each Ticket (Sentinel `docs/features/tickets/tickets.md`, Search);
  - Filters, whose popover holds a group of checkboxes for each filter below;
  - Clear filters.

  | Filter | Values | Of List Tickets |
  |---|---|---|
  | Status, in the All and Embargo views only | New, Analysis, Analyzed, Resolved, Ignored, Duplicated, each with its mark | `status` (Sentinel `docs/features/tickets/tickets.md`, Statuses) |
  | Embargo, in the Embargo view only | Expired | `coordinated_release_passed=true`: a confidential Ticket whose Coordinated Release Date is at or before the instant at which Sentinel evaluates the read (Sentinel `docs/features/tickets/tickets.md`, List Tickets, Embargo filters) |
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
| Unassigned | `status=analysis`, `status=analyzed`, `assignee=none` | Priority, then deadline | Ticket, CVE, Title, Packages, Status, Severity, Priority, Deadline |
| Analysis | `status=analysis` | Priority, then deadline | Ticket, CVE, Title, Packages, Severity, Priority, Deadline, Assignee |
| Analyzed | `status=analyzed` | Priority, then deadline | Ticket, CVE, Title, Packages, Severity, Priority, Deadline, Assignee |
| All | None | Last modified | Ticket, CVE, Title, Packages, Status, Severity, Priority, Deadline, Assignee, Last modified |
| Assigned to me | `assignee` with the `id` of the signed-in user, `status=analysis`, `status=analyzed` | Priority, then deadline | Ticket, CVE, Title, Packages, Status, Severity, Priority, Deadline |
| Embargo | `is_confidential=true` | Coordinated Release Date | Ticket, CVE, Title, Packages, Status, Coordinated Release Date, Deadline, Assignee |

- A view omits a column whose value its filters fix: Status where the view
  has one status, Assignee where it has none or only the signed-in user.
  Embargo, which follows the embargoes by their dates, also omits Severity,
  Priority, and Last modified; the severity and priority filters still
  refine it.
- Assigned to me filters by the user's `id`, which never changes, rather than
  by the username (Sentinel `docs/api-spec.md`, User Identifier Resolution).
- **Sorting.** The user sorts by these columns by pressing their headers
  (`docs/design-system.md`, Tables), the first press on another column in its
  first direction:

  | Column | `sort_by` | First direction |
  |---|---|---|
  | Ticket | `ticket_id`, by its number | Descending, the newest first |
  | Status | `status`, from New to Duplicated | Ascending |
  | Severity | `severity`, from Critical to None, and a Ticket without one last | Descending |
  | Priority | `priority_then_current_due` | Descending |
  | Deadline | `current_due_at` | Ascending, the earliest first |
  | Coordinated Release Date | `coordinated_release_at` | Ascending, the earliest first |
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
  view, is `updated_at` descending, the most recent first. Coordinated
  Release Date, the sorting of the Embargo view, is `coordinated_release_at`
  ascending: the dates that have passed first, then the nearest, and a
  Ticket without a date last in either direction (Sentinel
  `docs/features/tickets/tickets.md`, List Tickets, Embargo filters; Sentinel
  `docs/api-spec.md`, Nullable Sort Field Ordering).
- **Ticket**: the identifier, which names the row, as a link to the Ticket at
  weight 500, followed by `lock` when the Ticket is confidential
  (`docs/design-system.md`, Tables; Confidential Tickets).
- **CVE**: the CVE ID as text, at the weight of the row, since it is not a
  link (Navigation; `docs/design-system.md`, Type Scale), or an absent value
  for a Ticket without a CVE.
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
  why a row matches when the name that matches is among those that it names.
- **Status**, **Severity**, and **Priority**: as `docs/design-system.md`
  (Ticket Status; Severity; Priority) shows them, the effective priority
  included. The cell of the priority is the button of its explanation
  (`docs/design-system.md`, Priority, Explanation), which shows the fields
  that List Tickets returns for the row: `priority`, `priority_automatic`,
  `priority_override`, and `priority_automatic_basis` (Sentinel
  `docs/features/tickets/tickets.md`, TicketSummary; PriorityBasis;
  PriorityEvidence).
- **Deadline**: the deadline badge (`docs/behaviors.md`, Deadlines), which
  compares the dates with the instant at which the data of the list arrived,
  the same for every row. A Ticket without a deadline leaves the place empty.
- **Coordinated Release Date**: `coordinated_release_at`, as a date and time
  (`docs/behaviors.md`, Display), not as the days that remain to it, which
  only a deadline shows; or an absent value for a confidential Ticket without
  one. When an SLA applies to a Ticket with a date, its deadlines divide the
  window up to that date, and its QA deadline is that date (Sentinel
  `docs/features/tickets/ticket-deadlines.md`, Deadline Window; Coordinated
  Release Window; Null Due Dates), so the Deadline column shows how the
  remediation keeps to the embargo.
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
  (`docs/behaviors.md`, Accessibility, Focus after a navigation), and while
  the popover of Filters is open, it announces the same itself
  (`docs/design-system.md`, Lists).
- **The focus.** When the rows, the explanation of a priority, the table
  without rows, the action of an empty state, the pagination, a tab, a count
  of the attention summary, or Clear filters leaves the page while it holds
  the focus, such as "Go to the first page" once the rows arrive, the
  explanation of a priority whose row a new read removes, the pagination when
  an error takes the place of the rows, Clear filters once it removed the
  search and the filters, or a tab or a count that a read of the signed-in
  user removes (Access), the focus moves to the screen's heading
  (`docs/behaviors.md`, Accessibility, Focus after an action).
- **Empty.** A view without Tickets says "No Tickets in this view.", on any
  page. A view that the user refined without Tickets that match says "No
  Tickets in this view match the search." when only a search applies and "No
  Tickets in this view match the filters." otherwise, on any page, and offers
  Clear filters as a secondary button: the search of the list searches the
  view alone, as a tab opens its view without it. A page beyond the last of a
  list with Tickets says "There are no Tickets on this page." and offers "Go
  to the first page", a link that looks like a secondary button, in place of
  the pagination (`docs/behaviors.md`, Empty States). Each shows inside the
  frame, below the header row, and keeps the tabs and the toolbar.
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
  Search; Statuses; Confidential Tickets; PriorityBasis; PriorityEvidence;
  TicketSummary; List Tickets; Reassignment
- Sentinel `docs/data-model.md` — Ticket
- Sentinel `docs/features/tickets/ticket-priority.md` — Priority Levels;
  Exploitation Level; Persistence and Effective Priority; Automatic Priority
  Basis; API Surface
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Due Dates (Deadline
  Window; Coordinated Release Window; Null Due Dates); Ticket-Level Overdue
  Filter; Ticket Current Phase (Relation to the Overdue Filter; Current Phase
  Filter); Sorting, Current Due Date
- Sentinel `docs/features/identity/authentication.md` — Get Current User
- Sentinel `docs/features/identity/rbac.md` — Capabilities; Scope and
  Confidential Ticket Visibility; Assignment Eligibility Wire Format
- Sentinel `docs/api-spec.md` — Query Parameter Length Limit; Inadmissible
  Characters in Request Input; Pagination; Filtering; Enum Filter
  Validation; Sorting (Nullable Sort Field Ordering); User Identifier
  Resolution
