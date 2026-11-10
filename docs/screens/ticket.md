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
in the tab Overview its CVE, its package tree, and its details. Vulnerability
and restricted analysts work in it all day; every other user reads it, as a
package maintainer does a Ticket of one of their packages that an analyst
shares, and finds in its package tree the tracks that wait for them
(`docs/screen-map.md`, Users and Frequent Tasks; Areas and Screens). It shows
the same Ticket to every user who can see it.

## Access

Every signed-in user opens it; reading it needs no capability. It shows a
Ticket that Get Ticket returns to the user, whose scope, access grants, and
package maintainership decide which confidential Tickets they are (Sentinel
`docs/features/tickets/tickets.md`, Get Ticket; Sentinel
`docs/features/identity/rbac.md`, Scope and Confidential Ticket Visibility).
The screen offers no action, so it is the same for every user, except that it
marks for a maintainer the tracks that wait for them (Packages).

## Navigation

- Path: `/tickets/{ticket_id}` (`docs/screen-map.md`, Areas and Screens), with
  `ticket_id` in the canonical form `SNTL-{n}`, with `n` from 1 to
  2147483647 without leading zeros (Sentinel `docs/api-spec.md`, Ticket
  Identifier Resolution). Any other form, such as `SNTL-0042`, `sntl-42`, or a
  UUID, shows Not found without a request (`docs/behaviors.md`, Missing and
  Inaccessible Records).
- Overview is at the path of the Ticket. Its one search parameter is
  `hidden=shown`, while the package tree shows its hidden records (Packages);
  the screen removes every other parameter and value from its URL, in place
  of the URL in the browser history, and keeps its anchor
  (`docs/behaviors.md`, Invalid Search Parameters).
- Anchors: `#cve`, the CVE, `#packages`, the package tree, and `#details`,
  the details, which every Ticket has; the reads of Overview are the Ticket,
  its duplicates, and, for a maintainer, their work on the Ticket
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

- The identifier, the level-one heading. For a confidential Ticket, `lock`
  after it, followed by the label Confidential (`docs/design-system.md`,
  Confidential Tickets).
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

**Layout of Overview** (`docs/design-system.md`, Detail Screens): the CVE and
the package tree in the main column, in this order, and the details in the
side column; in one column, the details above the CVE.

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

**Packages**, the second part of the main column, the package tree of the
Ticket, from `packages` of Get Ticket, read-only, in the order of the API
(Sentinel `docs/features/tickets/tickets.md`, Shared Sub-Schemas; Sentinel
`docs/features/packages/package-model.md`, List Ticket Packages):

- Each package is a group under a band (`docs/design-system.md`, Detail
  Screens): its name, the level-three heading, then its maintainers as an
  icon with their number, `user-round` for one, `users-round` for several,
  and `user-round-x` without any, a button named such as "2 maintainers of
  fictional-openssl", "1 maintainer of fictional-openssl", or "No maintainer
  of fictional-openssl", which its tooltip shows. It opens a popover, 288 px
  wide, with the title "Maintainers" and the package below it, and each
  maintainer in the full form at the medium size with the username, or
  "Sentinel knows no maintainer of this package." (Sentinel
  `docs/features/packages/package-maintainership.md`, Maintainers in the
  Package Tree). Users show without a link (Navigation).
- Its tracks are a list below the band, 16 px apart, each with a border line
  at its left:
  - on its first line, its reference at weight 500; "Needs your action"
    when it waits for the signed-in user (below); and at the end its
    affectedness, a value with the dot of its tone (`docs/design-system.md`,
    Other Values): Analysis `info`, Affected `warning`, Not affected and
    Fixed `success`, Won't fix `neutral`;
  - on its second line, "Delivery" in `fg-muted` and the delivery status,
    Pending `neutral`, In progress `info`, Released `success`, where
    `delivery_relevant` is true (Sentinel
    `docs/features/packages/package-model.md`, Delivery Relevance Indicator)
    and either its status is not Pending or the track has work and Sentinel
    observes its submission (below); and the pipeline of its phases, when
    it has work and due dates (`docs/design-system.md`, Track Milestones),
    named such as "Phases of fictional-openssl, SUSE:FLES-15-SP7:Update: …",
    whose Phases holds no more than the design system states. The track has
    no deadline badge: its pipeline and Phases show its deadlines
    (`docs/behaviors.md`, Deadlines). A track has work when it is actionable
    and in Analysis, or Affected or Fixed with a Product that is actionable
    and eligible; a track without work, Not affected and Won't fix included,
    shows no pipeline and no Delivery Pending, and a Ticket without due
    dates shows no pipeline.
  - Sentinel observes a phase of a track with due dates whose milestone is
    not `null`, and not, for example, the submission, the UM, and the QA of
    a Git track or of a track of a Ticket without a CVE; the delivery of the
    track completes its submission, and the release of its Products its QA
    (Sentinel `docs/features/tickets/ticket-deadlines.md`, Track Milestones;
    Observability of Later Phases; Completion Evidence). A track without
    due dates, whose milestones are all `null` because no SLA applies (same
    document, Null Due Dates), does not show which phases Sentinel observes,
    so it shows neither Delivery Pending nor a release that is due; on an
    Ignored or Duplicated Ticket, Sentinel observes neither (Sentinel
    `docs/features/packages/package-model.md`, Continued Updates).
- Its Products are a list below the track, with a border line at their left,
  each on a line that wraps: its name, which wraps, in `fg-muted` when it is
  not eligible; `user-pen` when its eligibility is set by hand, read as ",
  eligibility set by hand"; the label Not eligible; and at the end its
  release, in `text-13`, `fg-muted`: "Released" with the date and time of
  `released_at` on a released Product, and on an actionable, eligible
  Product of a track in Analysis, Affected, or Fixed, "Not released" where
  Sentinel observes the QA of the track, or "Release not observed" where it
  does not. A Product that does not take part or is not eligible, or whose
  track has no due dates, shows no release unless it is released.
- The name of a Product opens its details (`docs/design-system.md`, Menus,
  Popovers, and Tooltips): its CPE in monospace below the name, then
  Eligibility, "Eligible" or "Not eligible", followed by " · automatic", or
  " · set by hand" after `user-pen`; Lifecycle, the phase of `lifecycle_phase`
  (Pre-release, General support, Extended support, Reactive support, EOL),
  or "Not available" without lifecycle data; Release, where its line shows
  one, "Released" with its date and time, "Not released", or "Not
  observed"; and, for a Product that is not actionable, Actionable, "No,"
  followed by the reason that Sentinel gives, the first that applies in the
  order "its package is excluded", "its track is excluded", "it is excluded
  from this track", and "it has reached its end of life" (Sentinel
  `docs/features/packages/package-model.md`, Derived Actionability). It
  holds no action.
- **Hidden records.** A package, a track, or a Product that is not actionable,
  excluded, EOL, or holding nothing actionable, is hidden. "Show hidden", a
  switch at the end of the line of the heading of the part, followed by the
  number of the hidden records whose parent is not hidden, each counting
  with what it holds, shows them in `fg-muted` (`docs/design-system.md`, Detail
  Screens): a record that its own marker excludes carries the label
  Excluded, and a Product at the end of its life the label EOL, also under a
  hidden parent. The switch is disabled without hidden records, and keeps
  its state; its state is `hidden=shown` in the URL, which it adds to the
  browser history, keeping the anchor and the scroll position. While it is
  off and every package is hidden, the part says "All packages are hidden.".
- **The tracks that wait for the signed-in user.** For a user whom
  `maintainers` lists for a package that is not excluded, the screen reads
  their work on the Ticket, `GET /api/v1/my/packages/tickets/{ticket_id}`,
  when Overview opens and whenever the tab returns to the foreground, and
  marks each track that it returns as pending, matched by package name and
  reference, with the label "Needs your action" and a bar of 3 px in `link`
  in place of its line (`docs/design-system.md`, Labels; Sentinel
  `docs/features/packages/maintainer.md`, Pending; Package Details for
  Ticket; Sentinel `docs/features/packages/package-maintainership.md`,
  Workbench Dependency). For every other user, the read is not sent, and no
  track is marked, also once a user no longer maintains a package that is
  not excluded.
- A Ticket without packages shows "No packages.", without the switch.

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
  of Duplicates until its read arrives (`docs/behaviors.md`, Loading). Until
  the read of the work of a maintainer arrives, no track is marked.
- **Errors.** The default presentation applies (`docs/behaviors.md`, Errors).
  The failure of the first read of Get Ticket replaces the screen, its heading
  row and tabs included; `404 TICKET_NOT_FOUND`, for a Ticket that does not
  exist or that the user cannot see, shows Not found (`docs/behaviors.md`,
  Missing and Inaccessible Records). A later read of the Ticket that fails,
  such as when the tab returns to the foreground, keeps the Ticket shown, with
  its warning at the top of the panel of the tab, unless it is a `403` or a
  `404`, which replaces the screen. The failure of the read of the duplicates
  shows in place of their value, with Try again where the failure offers it,
  and leaves the rest of the screen usable. When the read of the work of a
  maintainer fails, a `warning` message above the package tree says "The
  tracks that wait for you couldn't be shown.", followed by the message of
  its status, with Try again where the failure offers it, and the package
  tree stays usable; once a read of it has succeeded, a later read that
  fails keeps its marks and says "The tracks that wait for you couldn't be
  updated.", followed by the message of its status, unless it is a `403` or
  a `404`, which removes them; while it is sent again, the marks that stay
  shown are marked as being updated (`docs/behaviors.md`, Where Errors
  Appear; Loading). The screen handles no error code specifically.
- **Reflow.** At 320 CSS px the page does not scroll horizontally, and the
  names of the package tree wrap (`docs/behaviors.md`, Accessibility, Reflow
  and text size).

## Cross-references

- `docs/screen-map.md` — Users and Frequent Tasks; Areas and Screens; Links
  Between Areas; Browser History; Contract URLs; Roles
- `docs/behaviors.md` — Errors; Invalid Search Parameters; Unknown Values;
  Links to Other Sites; Loading and Empty States; Dates and Times;
  Accessibility; Wording; Representation of a User
- `docs/design-system.md` — Main Content; Values; Deadline Badge; Track
  Milestones; Labels; Other Values; Buttons and Links; Detail Screens; Forms;
  Messages; Loading; Errors in Place of Content; Menus, Popovers, and
  Tooltips; Icons by Need; Representation of a User
- Sentinel `docs/features/tickets/tickets.md` — API Lookup; Status
  Transitions; Duplicate Handling; Confidential Tickets (Identifier
  Disclosure Boundary; Coordinated Release Date); Response Schemas (Shared
  Sub-Schemas; TicketDetail); Get Ticket; List Tickets (Duplicate filter)
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Due Dates (Null Due
  Dates); Track Milestones (Observability of Later Phases; Completion
  Evidence); Ticket Current Phase
- Sentinel `docs/features/packages/package-model.md` — Three Orthogonal
  Dimensions; Exclusion and Actionability; List Ticket Packages
- Sentinel `docs/features/packages/package-maintainership.md` — Maintainers
  in the Package Tree; Workbench Dependency
- Sentinel `docs/features/packages/maintainer.md` — Classification; Package
  Details for Ticket
- Sentinel `docs/features/packages/product-catalog.md` — Product Lifecycle
  Phases
- Sentinel `docs/features/tickets/ticket-priority.md` — Automatic Priority
  Basis; Manual Override
- Sentinel `docs/features/tickets/cve-tracking.md` — Get CVE; External
  Identifiers; CVE Rejection Handling
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility
- Sentinel `docs/api-spec.md` — Ticket Identifier Resolution; Pagination
