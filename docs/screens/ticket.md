# Ticket

This screen document records the Ticket screen as built
(`docs/conventions.md`, Screen Documents). It follows the foundation documents
and states only what the screen adds to them: the layout of a detail screen
belongs to `docs/design-system.md` (Detail Screens; Main Content), the
presentation of the values of a Ticket to `docs/design-system.md` (Values) and
`docs/behaviors.md` (Deadlines), and the links to other sites to
`docs/behaviors.md` (Links to Other Sites). Backend behavior and the API
contract belong to Sentinel (`README.md`, Specification Boundary).

## Purpose

The Ticket screen shows one Ticket: its heading row with its main values, and
in the tab Overview its CVE and its details. Vulnerability and restricted
analysts work in it all day; every other user reads it, as a package
maintainer does a Ticket of one of their packages that an analyst shares
(`docs/screen-map.md`, Users and Frequent Tasks; Areas and Screens). It shows
the same Ticket to every user who can see it.

## Access

Every signed-in user opens it; reading it needs no capability. It shows a
Ticket that Get Ticket returns to the user, whose scope, access grants, and
package maintainership decide which confidential Tickets they are (Sentinel
`docs/features/tickets/tickets.md`, Get Ticket; Sentinel
`docs/features/identity/rbac.md`, Scope and Confidential Ticket Visibility).
The screen offers no action, so it is the same for every user.

## Navigation

- Path: `/tickets/{ticket_id}` (`docs/screen-map.md`, Areas and Screens), with
  `ticket_id` in the canonical form `SNTL-{n}`, with `n` from 1 to
  2147483647 without leading zeros (Sentinel `docs/api-spec.md`, Ticket
  Identifier Resolution). Any other form, such as `SNTL-0042`, `sntl-42`, or a
  UUID, shows Not found without a request (`docs/behaviors.md`, Missing and
  Inaccessible Records).
- Overview is at the path of the Ticket. The screen accepts no search
  parameter: it removes every one from its URL, in place of the URL in the
  browser history, and keeps its anchor (`docs/behaviors.md`, Invalid Search
  Parameters).
- Anchors: `#cve`, the CVE, and `#details`, the details, which every Ticket
  has; the reads of Overview are the Ticket and its duplicates
  (`docs/design-system.md`, Main Content).
- The rows of the Ticket list lead to it, and so do the original and the
  duplicates in its details. Its CVE ID is not a link: the address of the CVE
  would lead to this screen (`docs/screen-map.md`, Links Between Areas). Users
  show without a link to their screen and without a card while the UI does
  not have it (`docs/behaviors.md`, Open Decisions).

## Content

The screen reads the Ticket from Get Ticket,
`GET /api/v1/tickets/{ticket_id}`. While it waits, its heading is "Ticket" and
the page title "Ticket – Sentinel", and the tabs show; then the heading is the
identifier and the page title, such as "SNTL-42 – Sentinel", without moving the
focus (`docs/behaviors.md`, Accessibility, Focus after a navigation).

**Heading row** (`docs/design-system.md`, Detail Screens):

- The identifier, the level-one heading. For a confidential Ticket, `lock` and
  "Confidential" 4 px after it (`docs/design-system.md`, Confidential
  Tickets); assistive technologies read the word.
- The main values, named CVE, Status, Severity, Priority, and Deadline for
  assistive technologies: the CVE ID in `fg-muted`, at the size of the
  heading, for a Ticket with a CVE; the status; the severity, or "Severity not
  set" without one; the effective priority, whose box is the button of its
  explanation (`docs/design-system.md`, Priority, Explanation), or "Not yet
  prioritizable" without one, which also names the button; and the deadline
  badge, when the Ticket has one (`docs/behaviors.md`, Deadlines), which
  compares the dates with the instant at which the Ticket arrived.
- The row wraps when the width runs short.

**Tabs**, named "Ticket" for assistive technologies: Overview.

**Layout of Overview** (`docs/design-system.md`, Detail Screens): the CVE in
the main column and the details in the side column; in one column, the
details above the CVE.

**CVE**, the first part of the main column, from `cve` of Get Ticket (Sentinel
`docs/features/tickets/tickets.md`, CVEDetail):

- Its heading is the CVE ID. While the CVE is rejected, the label "Rejected"
  follows it (`docs/design-system.md`, Labels): Sentinel ignores by itself
  only a New Ticket whose CVE is rejected, and leaves every other Ticket to the
  analyst (Sentinel `docs/features/tickets/tickets.md`, Status Transitions). A
  state that the pinned contract does not list shows as received in the
  label.
- Next to the heading, "SUSE CVE page", a link to the public CVE page of SUSE,
  an address composed from the CVE ID with the fixed origin
  `https://www.suse.com`: `https://www.suse.com/security/cve/{cve_id}.html`,
  the CVE ID encoded in the path (`docs/behaviors.md`, Links to Other Sites,
  Composed addresses).
- The title, when Sentinel returns one, and below it the description, cut to
  its first four lines with Show more (`docs/design-system.md`, Main Content),
  or "No description." in `fg-muted`.
- On one line that wraps, each value after its term in `fg-muted`: Published
  and Modified, each a date and time; Rejected, the date and time of the
  rejection, while the CVE is rejected; CWE, the identifiers of the
  weaknesses, separated by commas; and, when the CVE has any, External
  identifiers, each its identifier as a link to the address of its advisory,
  or as text when that address is not a web address (`docs/behaviors.md`,
  Links to Other Sites).
- The exploitation, in a box with three columns, one below the other where
  the part is narrower than 576 px:
  - CISA KEV: "Not listed", or Added and the date of the entry, never that the
    CVE is in KEV now;
  - SSVC: Exploitation (None, PoC, Active), Automatable (No, Yes), Technical
    impact (Partial, Total), Version, and Assessed, a date and time; a value
    that the pinned contract does not list shows as received;
  - EPSS: Score and Percentile, each cut to five decimals, with at least two,
    and Assessed, a date.

  Without an SSVC assessment or an EPSS score, an absent value.
- A Ticket without a CVE shows the heading "CVE" and "No CVE.".
- Absent values show as such (`docs/behaviors.md`, Absent Values).

**Details**, the section of the side column, as a description list:

| Term | Value |
|---|---|
| Assignee | The assignee in the full form at the small size, or "Unassigned" |
| Coordinated Release Date | While the Ticket is confidential, or while it has a Coordinated Release Date, also after it became non-confidential: the date and time, or an absent value (Sentinel `docs/features/tickets/tickets.md`, Coordinated Release Date) |
| Deadlines | A line per phase, Triage, Submission, UM, and QA, with its due date and time; the QA line reads "QA, release" while the QA due date is the final release deadline, and a line Release follows it otherwise. The phases before the current phase are in `fg-muted`; the current phase is at weight 600, with the state of its milestone below its date, as `docs/behaviors.md` (Deadlines) words it; the later phases are plain. When the current phase is done, every phase is in `fg-muted`; when it is `null` with due dates, Triage is in `fg-muted` and the other phases are plain; a current phase that the pinned contract does not list marks no phase. Without due dates, an absent value (Sentinel `docs/features/tickets/ticket-deadlines.md`, Null Due Dates; Ticket Current Phase) |
| Original | For a duplicate, `duplicate_of_ticket_id`, a link to its screen, without the lock, which the identifier does not carry (Sentinel `docs/features/tickets/tickets.md`, Identifier Disclosure Boundary) |
| Duplicates | For every other Ticket, its visible duplicates, each a link to its screen followed by the lock of a confidential one, from List Tickets, `GET /api/v1/tickets`, with `duplicate_of_ticket_id`, `sort_by=ticket_id`, `sort_order=asc`, and `per_page=100`, the largest page (Sentinel `docs/features/tickets/tickets.md`, List Tickets, Duplicate filter; Sentinel `docs/api-spec.md`, Pagination); beyond the page, "and N more", without a link; "None" without any. A duplicate has no duplicates, so its read is not sent (Sentinel `docs/features/tickets/tickets.md`, Duplicate Handling, Invariant) |
| Created | `created_at`, a date and time |
| Last modified | `updated_at`, a date and time |

## States

- **Loading.** The heading row and the tabs show at once; the panel of
  Overview shows the loading indicator until the Ticket arrives, and the value
  of Duplicates until its read arrives (`docs/behaviors.md`, Loading).
- **Errors.** The default presentation applies (`docs/behaviors.md`, Errors).
  The failure of the first read of Get Ticket replaces the screen, its heading
  row and tabs included; `404 TICKET_NOT_FOUND`, for a Ticket that does not
  exist or that the user cannot see, shows Not found (`docs/behaviors.md`,
  Missing and Inaccessible Records). A later read of the Ticket that fails,
  such as when the tab returns to the foreground, keeps the Ticket shown, with
  its warning at the top of the panel of the tab, unless it is a `403` or a
  `404`, which replaces the screen. The failure of the read of the duplicates
  shows in place of their value, with Try again where the failure offers it,
  and leaves the rest of the screen usable. The screen handles no error code
  specifically.
- **Reflow.** At 320 CSS px the page does not scroll horizontally
  (`docs/behaviors.md`, Accessibility, Reflow and text size).

## Cross-references

- `docs/screen-map.md` — Users and Frequent Tasks; Areas and Screens; Links
  Between Areas; Browser History; Contract URLs; Roles
- `docs/behaviors.md` — Errors; Invalid Search Parameters; Unknown Values;
  Links to Other Sites; Loading and Empty States; Dates and Times;
  Accessibility; Wording; Representation of a User
- `docs/design-system.md` — Main Content; Values; Labels; Buttons and Links;
  Detail Screens; Loading; Errors in Place of Content; Representation of a
  User
- Sentinel `docs/features/tickets/tickets.md` — API Lookup; Status
  Transitions; Duplicate Handling; Confidential Tickets (Identifier
  Disclosure Boundary; Coordinated Release Date); Response Schemas (Shared
  Sub-Schemas; TicketDetail); Get Ticket; List Tickets (Duplicate filter)
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Due Dates (Null Due
  Dates); Ticket Current Phase
- Sentinel `docs/features/tickets/ticket-priority.md` — Automatic Priority
  Basis; Manual Override
- Sentinel `docs/features/tickets/cve-tracking.md` — Get CVE; External
  Identifiers; CVE Rejection Handling
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility
- Sentinel `docs/api-spec.md` — Ticket Identifier Resolution; Pagination
