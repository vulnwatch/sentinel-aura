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

The Ticket screen shows one Ticket: its heading row with its main values and
the menu of its actions, with which an analyst ignores it with a reason, marks
it as a duplicate, reopens it, reverts its duplicate status, overrides its
priority, and, without a CVE, sets its severity and associates a CVE with it,
an analyst or a user who manages fetchers reruns its convergence, and an
analyst who manages confidentiality places it under embargo and discloses it;
in the tab Overview its CVE, the CVSS assessments of its CVE, whose SUSE
assessment an analyst who manages CVSS adds, edits, and deletes, its package
tree, with the IBS requests of its tracks, to which an analyst who manages
packages adds the packages that Sentinel missed, whose packages, tracks, and Products they
exclude and restore, and on which they set the affectedness of the tracks and
the eligibility of the Products, its details, whose assignee an analyst
changes and whose Coordinated Release Date, the end of the embargo, an
analyst who manages confidentiality sets, changes, and removes, the sources
of its CVE, which an analyst refetches, and who is involved in it, with the
access grants of a confidential Ticket, which an analyst who manages
confidentiality grants and revokes; in the tab References
its references, the advisories, patches, and other pages of other sites that
analysts read while they analyze it, which an analyst who manages references
adds, edits, and deletes; in the tab Affected versions the versions of the
software that its CVE affects, as the CVE record, its ADPs, GHSA, and OSV
report them, which an analyst compares with the tracks of its packages; and in
the tab Audit log its history, which an analyst searches and filters to
reconstruct who changed what and what Sentinel did by itself. Vulnerability and
restricted analysts work in it all day; every other user reads it, as a package
maintainer does a Ticket of one of their packages that an analyst shares, and
finds in its package tree the tracks that wait for them (`docs/screen-map.md`,
Users and Frequent Tasks; Areas and Screens). It shows the same Ticket to every
user who can see it.

## Access

Every signed-in user opens it; reading it needs no capability. It shows a
Ticket that Get Ticket returns to the user, whose scope, access grants, and
package maintainership decide which confidential Tickets they are (Sentinel
`docs/features/tickets/tickets.md`, Get Ticket; Sentinel
`docs/features/identity/rbac.md`, Scope and Confidential Ticket Visibility).
The screen is the same for every user, except that it offers Refetch, Edit
assignee, Ignore… and Ignore as not shipped by SUSE, Mark as duplicate…,
Reopen, Revert duplicate, Override priority…, Set severity…, and Associate CVE…
to a user who holds `triage_ticket`; Rerun convergence to a user who holds
`triage_ticket` or `manage_fetchers`; Add SUSE assessment, and Edit and Delete
on the SUSE assessments, to a user who holds `manage_cvss`, Grant access and
Revoke access, Make confidential… and Make non-confidential…, and Edit
Coordinated Release Date to a user who holds `manage_confidentiality`, Add
reference, and Edit and Delete on the manual references, to a user who holds
`manage_references`, Add package, Exclude and Restore on the packages, tracks,
and Products, the affectedness of the tracks, and the eligibility of the
Products to a user who holds `manage_packages`, and Fixed to a user who holds
`admin_ticket_ops`, or `manage_packages` on a Ticket without a CVE (Actions;
Sentinel `docs/features/identity/rbac.md`, Endpoint Permission Map (CVEs;
Tickets; Ticket Packages; Ticket References)), lists the signed-in user first
among the users who can be the assignee when their assignment eligibility
admits the Ticket (`docs/screen-map.md`, Roles, Principles), and marks for a
maintainer the tracks that wait for them (Packages). Every user who sees a
confidential Ticket sees its access grants, whatever their capabilities
(Sentinel `docs/features/tickets/tickets.md`, List Access Grants).

## Navigation

- Path: `/tickets/{ticket_id}` (`docs/screen-map.md`, Areas and Screens), with
  `ticket_id` in the canonical form `SNTL-{n}`, with `n` from 1 to
  2147483647 without leading zeros (Sentinel `docs/api-spec.md`, Ticket
  Identifier Resolution). Any other form, such as `SNTL-0042`, `sntl-42`, or a
  UUID, shows Not found without a request (`docs/behaviors.md`, Missing and
  Inaccessible Records).
- Overview is at the path of the Ticket. Its one search parameter is
  `hidden=shown`, while the package tree shows its hidden records and has
  some (Packages); the screen removes every other parameter and value from
  its URL, and `hidden=shown` once the Ticket has no hidden records, in place
  of the URL in the browser history, and keeps its anchor
  (`docs/behaviors.md`, Invalid Search Parameters).
- References is at `/tickets/{ticket_id}/references`, with these search
  parameters, each value as text, `type` once for each of its values, such
  as `type=advisory&type=uncategorized`:

  | Parameter | Values | Without it |
  |---|---|---|
  | `type` | One or more of `advisory`, `patch`, `issue`, `article`, and `uncategorized`, a reference without a type (References) | Every type |
  | `source` | One source as Sentinel records it, such as `manual` or `sync_nvd_cves`, at most 100 characters, without U+0000 (Sentinel `docs/features/tickets/ticket-references.md`, TicketReference) | Any source |

  The screen removes every other parameter and value and a `source` that the
  URL gives more than once, and keeps the types once each in the order of
  the table above, all in place of the URL in the browser history
  (`docs/behaviors.md`, Invalid Search Parameters). A change of the filters
  is an entry of the browser history (`docs/design-system.md`, Lists).
- Affected versions is at `/tickets/{ticket_id}/affected-versions`, with one
  search parameter, `search`, the search term, at most 500 characters,
  without surrounding whitespace and without U+0000, as the search of Audit
  log takes it. The screen removes every other parameter and value and a
  `search` that the URL gives more than once, and writes the term without
  its surrounding whitespace, all in place of the URL in the browser history
  (`docs/behaviors.md`, Invalid Search Parameters). A search is an entry of
  the browser history (`docs/design-system.md`, Lists).
- Audit log is at `/tickets/{ticket_id}/audit-log`, with these search
  parameters, each value as text and a parameter with several values once for
  each, such as `kind=status&kind=packages`:

  | Parameter | Values | Without it |
  |---|---|---|
  | `search` | The search term, at most 500 characters, without surrounding whitespace and without U+0000 (Sentinel `docs/api-spec.md`, Query Parameter Length Limit; Inadmissible Characters in Request Input) | No search |
  | `actor` | `system`, or the `id` of a user, a UUID in lower case, never the username, which can change and can be `system` (Sentinel `docs/features/tickets/ticket-audit-log.md`, List Ticket Events; Sentinel `docs/api-spec.md`, User Identifier Resolution) | Any actor |
  | `kind` | One or more of `status`, `assignment`, `packages`, `cve`, `priority`, `confidentiality`, `references` (Audit log) | Every kind |
  | `from`, `to` | A date, such as `2026-11-08`, from 1 Jan 1970 to 30 Dec 9999; `from` not after `to` | No bound |
  | `page` | A whole number from 1 to 2147483647 (Sentinel `docs/api-spec.md`, Pagination) | The first page |

  The screen removes every other parameter and value, a parameter other than
  `kind` that the URL gives more than once, and a range whose start follows
  its end, keeps the kinds that it knows once each in the order of the table
  above, writes a UUID in lower case, and removes `page=1`, all in place of
  the URL in the browser history (`docs/behaviors.md`, Invalid Search
  Parameters). A search, a change of the filters, and a page are each an
  entry of the browser history (`docs/design-system.md`, Lists). A tab opens
  at its path without parameters.
- Anchors: `#cve`, the CVE, `#cvss`, the CVSS assessments, `#packages`, the
  package tree, `#details`, the details, `#sources`, the sources of the CVE,
  and `#participants`, the participants; a Ticket without a CVE lacks the
  CVSS assessments and the sources. The reads of Overview are the Ticket, its
  duplicates, the CVSS assessments and the sources of its CVE, the users who
  acted on it, the access grants of a confidential Ticket, and, for a
  maintainer, their work on the Ticket (`docs/design-system.md`, Main
  Content).
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
- At the end of the row, on every tab, for a user who can take at least one of
  its actions on the Ticket, Actions, the menu of the actions of the Ticket
  (Actions; `docs/design-system.md`, Detail Screens), named such as "Actions
  of SNTL-42" for assistive technologies.
- The row wraps when the width runs short, and Actions then stays at the end
  of its line.

**Tabs**, named "Ticket" for assistive technologies: Overview, References,
Affected versions, and Audit log.

**Layout of Overview** (`docs/design-system.md`, Detail Screens): the CVE, the
CVSS assessments, and the package tree in the main column, in this order, and
the details, the sources of the CVE, and the participants in the side column;
in one column, the details above the CVE, and the sources and the
participants below the package tree. The sources and the participants keep
their place in the order of the page in both layouts, so they stay, with the
focus, a refetch in progress, and an open dialog of the access grants, when
the layout changes. The details move: an open popover of the assignee
closes, and Edit assignee stays busy in the new place while its assignment
is in progress; while the dialog of the Coordinated Release Date is open,
the layout waits until it closes, and then the details move
(`docs/design-system.md`, Detail Screens).

**CVE**, the first part of the main column, from `cve` of Get Ticket (Sentinel
`docs/features/tickets/tickets.md`, CVEDetail):

- Its heading is the CVE ID. While the CVE is rejected, the label "Rejected"
  follows it (`docs/design-system.md`, Labels): of the Tickets whose CVE is
  rejected, Sentinel ignores by itself only a New one, and leaves the others
  to the analyst (Sentinel `docs/features/tickets/tickets.md`, Status
  Transitions). A state that the pinned contract does not list shows as
  received in the label.
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
  rejection, while the CVE is rejected; CNA, the CNA that owns the record of
  the CVE (below); CWE, the identifiers of the weaknesses, separated by
  commas; and, when the CVE has any, External identifiers, each its
  identifier as a link to the address of its advisory, or as text when that
  address is not a web address (`docs/behaviors.md`, Links to Other Sites).
- The CNA, from `cna` of the CVE, shows by its name, `name`, as a name that
  opens its details (`docs/design-system.md`, Menus, Popovers, and Tooltips;
  Sentinel `docs/features/tickets/cna.md`, CNA of a CVE; Display Name). The
  popover reads them from Get CNA, `GET /api/v1/cnas/{org_id}`, each time it
  opens, so that they follow the CNA as Sentinel describes it then (same
  document, Get CNA). Its title is the name, and below it the short name,
  `short_name`, unless it is absent or is the name, as it is while the CNA
  list of the CVE Program has not given the CNA an organization name. Then:
  - Types, the types of `types` as a list of labels (`docs/design-system.md`,
    Labels), each as received, since Sentinel does not close their set
    (Sentinel `docs/features/tickets/cna.md`, Response Schemas), or an absent
    value without any;
  - Auto-ignore, from `auto_ignore`: "Yes, new Tickets are ignored
    automatically" or "No", which says nothing of the Ticket shown, since a
    change of the policy changes no existing Ticket (same document, Flag);
  - Scope, `scope`, as text (same document, Security), cut to its first four
    lines with Show more (`docs/design-system.md`, Main Content), or an
    absent value.

  A CNA without a name, which Sentinel knows only by its identifier, shows
  "Unnamed CNA" in `fg-muted`, without a popover, and a CVE without a CNA an
  absent value. The screen shows no identifier of a CNA.
- The exploitation, in a box with three columns, one below the other where
  the part is narrower than 576 px:
  - CISA KEV: "Not listed", or Added and the date of the entry, never that the
    CVE is in KEV now;
  - SSVC: Exploitation (None, PoC, Active), Automatable (No, Yes), Technical
    impact (Partial, Total), Version, and Assessed, a date and time; a value
    that the pinned contract does not list shows as received;
  - EPSS: Score, cut to five decimals, with at least two, since most scores
    are below 0.01; Percentile, cut to two decimals, as in the explanation of
    the priority (`docs/design-system.md`, Priority, Explanation); and
    Assessed, a date.

  Without an SSVC assessment or an EPSS score, an absent value.
- A Ticket without a CVE shows the heading "CVE" and "No CVE.".
- Absent values show as such (`docs/behaviors.md`, Absent Values).

**CVSS assessments**, the second part of the main column, for a Ticket with a
CVE, from Get CVSS Assessments for a CVE, `GET /api/v1/cves/{cve_id}/cvss`,
with the actions on the SUSE assessment (Actions; Sentinel
`docs/features/tickets/cvss-scoring.md`, Get CVSS Assessments for a CVE;
Shared Assessment Item). A score shows with one decimal and tabular figures; a
CVSS version shows with a "v", such as "v3.1", so that it is not read as a
score, and a version that the pinned contract does not list shows as received,
without the "v" (`docs/behaviors.md`, Unknown Values).

- What the assessments resolve, which Sentinel resolves apart (Sentinel
  `docs/features/tickets/cvss-scoring.md`, Core Distinctions), on lines whose
  term in `fg-muted` precedes the value; a severity shows with its mark
  (`docs/design-system.md`, Severity), followed by its score in parentheses.
  When the SUSE assessment of the default CVSS version sets both the severity
  and the eligibility score, as the source `suse` of `eligibility` states, one
  line, such as "Severity High (8.1) from SUSE CVSS v3.1, which also sets the
  eligibility score of the Products". Otherwise two: Severity, from
  `severity`, such as "Critical (9.3) from NVD CVSS v4.0", and Eligibility
  score, which with the source `fallback` reads such as "10.0, the fallback
  without a SUSE CVSS v3.1 assessment", with the version of
  `default_cvss_version` (same document, Severity Resolution Cascade;
  Eligibility Score Resolution); a source that the pinned contract does not
  list follows the score as received, such as "7.0, fictional_source".
- Below them, the table "CVSS assessments" (`docs/design-system.md`,
  Tables), in the order of the API, by version, then by provider (Sentinel
  `docs/features/tickets/cvss-scoring.md`, Version Precedence): Provider,
  `provider_name`; Version; Base score, the score, then the severity of the
  assessment by the scale of its version, which is not the resolved severity,
  with its mark, such as "7.8 High", the scores ending at the same place, so
  that the marks align in a column; and Vector, `vector_string`, in
  monospace, which wraps only after a "/" where its column is narrower than
  it. The provider and the version name the row for assistive technologies.
  An assessment of a version that the pinned contract does not list shows its
  score without its severity, whose scale depends on the version, and its
  vector as text (`docs/behaviors.md`, Unknown Values).
- The vector of an assessment of a version that the pinned contract lists is
  a value that opens its metrics (`docs/design-system.md`, Menus, Popovers,
  and Tooltips): the title of the popover is the provider and the version,
  such as "NVD CVSS v3.1", with the vector below it, in monospace, wrapping
  as in the table, then the metrics of `metrics`, each by the name that
  Sentinel gives the metric without what the term of its group says, such as
  Confidentiality for Confidentiality Impact under Impact, or for Vulnerable
  System Confidentiality under Vulnerable system, and its value in sentence
  case, such as `adjacent_network` as "Adjacent network", or as
  received when the pinned contract does not list it (Sentinel
  `docs/features/tickets/cvss-scoring.md`, CVSS v2.0 Base Metrics; CVSS v3.0
  and v3.1 Base Metrics; CVSS v4.0 Base Metrics). They show in the groups of
  FIRST's specifications of each version, each group a term with its metrics
  below it:
  - v2.0: Exploitability, with Access vector, Access complexity, and
    Authentication; and Impact, with Confidentiality, Integrity, and
    Availability;
  - v3.0 and v3.1: Exploitability, with Attack vector, Attack complexity,
    Privileges required, and User interaction; Scope, a single metric, on
    the line of its term; and Impact, with Confidentiality, Integrity, and
    Availability;
  - v4.0: Exploitability, with Attack vector, Attack complexity, Attack
    requirements, Privileges required, and User interaction; Vulnerable
    system and Subsequent system, each with Confidentiality, Integrity, and
    Availability.
- For v3.0, v3.1, and v4.0, the popover ends with "Open in the FIRST
  calculator", a link to the calculator of the version on the site of FIRST,
  which explains each metric and value: an address composed with the fixed
  origin `https://www.first.org`, `https://www.first.org/cvss/calculator/3.0`,
  `3.1`, or `4.0`, with the vector as its fragment, such as
  `https://www.first.org/cvss/calculator/3.1#CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`,
  from which the calculator reads it as it is, without decoding it
  (`docs/behaviors.md`, Links to Other Sites, Composed addresses).
  FIRST has no such calculator for v2.0, whose popover has no link.
- Without assessments, "No CVSS assessments.", without the lines and the
  table.
- A Ticket without a CVE has no CVSS assessments: the part does not show, and
  its read is not sent.

**Packages**, the third part of the main column, the package tree of the
Ticket, from `packages` of Get Ticket, in the order of the API, with the
edits of its packages, tracks, and Products (Actions; Sentinel
`docs/features/tickets/tickets.md`, Shared Sub-Schemas; Sentinel
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
  Package Tree). Users show without a link (Navigation). For a user who
  holds `manage_packages`, the band ends with the menu of the actions of the
  package (Actions).
- Its tracks are a list below the band, 12 px apart, indented by 12 px on
  both sides, so that the menu of the actions of a track ends where that of
  its package does, each with a border line at its left, on one line that
  wraps where it is too narrow: its reference at weight 500; "Needs your
  action" when it waits for the signed-in user (below); and at the end, in
  `text-14`, its pipeline or its delivery, then, 12 px later, its
  affectedness, at the start of a place at least 104 px wide, wider than Not
  affected, or 136 px, wider than the select of Not affected, for a user who
  sets the affectedness, so that the pipelines and the affectedness of the
  tracks line up; then, 4 px later, for a user who holds `manage_packages`,
  the menu of the actions of the track (Actions). Where the line wraps, the
  pipeline or the delivery and the affectedness move below the reference,
  each at the end of its line. The line is on `surface` under the pointer,
  without its Products (`docs/design-system.md`, Detail Screens). IBS and
  Git tracks show alike.
  - The affectedness is a value with the dot of its tone
    (`docs/design-system.md`, Other Values): Analysis `info`, Affected
    `warning`, Not affected and Fixed `success`, Won't fix `neutral`; for a
    user who can set another value on the track, a select of it (Actions).
  - The pipeline of its phases shows when the track has work and due dates
    (`docs/design-system.md`, Track Milestones), named such as "Phases of
    fictional-openssl, SUSE:FLES-15-SP7:Update: …". The track has no
    deadline badge: its pipeline and Phases show its deadlines
    (`docs/behaviors.md`, Deadlines). A track has work when it is actionable
    and in Analysis, or Affected or Fixed with a Product that is actionable
    and eligible; a track without work, Not affected and Won't fix included,
    shows no pipeline, and a Ticket without due dates shows no pipeline. The
    name of the pipeline does not state the IBS requests of the track
    (below), which Phases reads only as it opens.
  - Its delivery is "Delivery" in `fg-muted`, then, 6 px later, the name of
    the delivery status, Pending, In progress, or Released, without a mark,
    so that it does not read as a second affectedness (`docs/design-system.md`,
    Other Values). It shows where `delivery_relevant` is true (Sentinel
    `docs/features/packages/package-model.md`, Delivery Relevance Indicator)
    and either its status is not Pending or the track has work and Sentinel
    observes its submission (below), so a track without work shows no
    Delivery Pending. With a pipeline, it shows in Phases, after the phases
    and a `border` line with 12 px of space above and below it, and the name
    of the pipeline ends with it, such as "…; QA due in 10 days; delivery
    pending". Without a pipeline, it shows on the line of the track in place
    of the pipeline, such as on a Not affected track whose delivery is
    Released, a combination that Sentinel treats as anomalous (Sentinel
    `docs/features/packages/package-model.md`, Affectedness-Delivery
    Independence); there its status opens the IBS requests of the track
    (below).
  - Its IBS requests show on an IBS track of a Ticket with a CVE, the only
    tracks to which Sentinel correlates requests, through the CVE that their
    diff names (Sentinel `docs/features/packages/ibs-submission-tracking.md`,
    Scope; Action-Scoped CVE Evidence). Phases shows, at the end of the line
    of Submission, the latest submission request of the track, from List
    Submission Requests, `GET /api/v1/tickets/{ticket_id}/submission-requests`,
    and at the end of the line of QA its latest release request, from List
    Release Requests, `GET /api/v1/tickets/{ticket_id}/release-requests`, in
    the column of Phases (`docs/design-system.md`, Track Milestones): UM
    creates a release request to end its phase, and the request then waits
    for the tests of QA (Sentinel
    `docs/features/tickets/ticket-deadlines.md`, Actors and Phases;
    Completion Evidence). Triage and UM show none, and neither does a phase
    without requests. Each read sends the package name as `package_name` and
    the reference of the track as `codestream_name`, which Sentinel matches
    exactly (Sentinel `docs/features/packages/ibs-submission-tracking.md`,
    Package and Codestream Identity; Common Query Rules), with
    `sort_by=upstream_created_at`, `sort_order=desc`, and `per_page=11`, the
    latest request and the ten others that "+N" names: the latest request is
    the one that IBS created last, since Sentinel designates none of them as
    the one in effect (same document, Public API). The reads are sent each
    time the popover that shows them opens, and not again while it is open,
    even when the tab returns to the foreground meanwhile
    (`docs/behaviors.md`, Loading); for any other track they are not sent,
    so a Git track shows none.
  - A request shows the mark of its state (`docs/design-system.md`, Other
    Values): in progress for New and Review, accepted for Accepted, and
    failed for Declined, Revoked, Superseded, and Deleted (Sentinel
    `docs/features/packages/ibs-submission-tracking.md`, Request States);
    then "SR" for a submission request or "RR" for a release request and its
    request number, such as "SR 900001", as a link to its `ibs_url`
    (`docs/behaviors.md`, Links to Other Sites), 24 px high, whose tooltip
    states its state by its name, such as "Review", followed for a superseded
    request by the number of the request that replaced it, such as
    "Superseded by 900014", and whose accessible name states the same after
    the number, such as "SR 900001, Review (another site)". A state that the
    pinned contract does not list shows the mark of an unknown value, and as
    received in the tooltip and the accessible name (`docs/behaviors.md`,
    Unknown Values). When the phase has other requests, "+N" follows, named
    after them, separated by semicolons, since each states its state after a
    comma, such as "2 more submission requests: SR 900000, Declined; SR
    899990, Superseded by 900000", whose tooltip lists, below their number,
    such as "3 submission requests", the requests from the latest, each with
    its state as the tooltip of its link states it, such as "SR 900000 ·
    Declined", at most ten, and then how many more, such as "…and 3 more"
    (`docs/design-system.md`, Tables).
  - On a track without a pipeline whose delivery shows on its line, an IBS
    track of a Ticket with a CVE, its status is a value that opens the same
    requests (`docs/design-system.md`, Menus, Popovers, and Tooltips), named
    such as "Delivery of fictional-sudo, SUSE:FLES-15-SP4:Update: In
    progress", in a popover titled "Delivery" whose description list holds
    Submission and QA, each with its latest request in the same form, or
    "None" in `fg-muted` without one. On any other track, the status is
    text.
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
  each on a line that wraps, which is on `surface` under the pointer
  (`docs/design-system.md`, Detail Screens): its name, which wraps, in
  `fg-muted` when it is not eligible; `user-pen` when its eligibility is set
  by hand, read as ", eligibility set by hand"; and the label Not eligible.
  Its details (below) show its release: "Released" with the date and time of
  `released_at`, which keep to one line, on a released Product, and on an
  actionable, eligible Product of a track in Analysis, Affected, or Fixed,
  "Not released" where Sentinel observes the QA of the track, or "Not
  observed" where it does not. A Product that does not take part or is not
  eligible, or whose track has no due dates, has no release unless it is
  released.
- A Product that keeps the Ticket from Resolved also shows its release at
  the end of its line, or of the next line where the line wraps: on a Ticket
  with a CVE, an actionable, eligible Product of an actionable Fixed track,
  with a release that is not "Released" (Sentinel
  `docs/features/tickets/tickets.md`, Gate: Analyzed → Resolved). It shows
  `triangle-alert` at 14 px in `warning-icon`, then, 4 px later, "Not
  released", or "Release not observed" where Sentinel does not observe the
  QA of the track, such as below a Git track, in `text-13`, weight 500,
  `warning-on-soft`, so that an analyst sees which Product the Ticket waits
  for. Another Product shows no release on its line; a Product of a track
  without due dates, which has no release, shows none either.
- The name of a Product opens its details (`docs/design-system.md`, Menus,
  Popovers, and Tooltips): its CPE in monospace below the name, then
  Eligibility, "Eligible" or "Not eligible", and, when it is set by hand,
  `user-pen` at 14 px in `fg-muted`, 4 px after it, read as ", set by hand",
  and below it, in `text-13`, `fg-muted`, who set it and when: "Set by", the
  user in the name form, which wraps, "on", and the date and time, which
  keep to one line, such as "Set by Alice Smith on 9 Oct 2026, 14:05". The
  user is the setter's current profile, so a user deactivated since shows as
  inactive (Sentinel `docs/features/packages/package-model.md`, Package
  Eligibility (Override Model); Sentinel `docs/api-spec.md`, User References
  in Responses). Then Lifecycle, the phase of `lifecycle_phase` (Pre-release,
  General support, Extended support, Reactive support, EOL), or "Not
  available" without lifecycle data; Release, where it has one
  (above); and, for a Product that is not actionable, Actionable, "No,"
  followed by the reason that Sentinel gives, the first that applies in the
  order "its package is excluded", "its track is excluded", "it is excluded
  from this track", and "it has reached its end of life" (Sentinel
  `docs/features/packages/package-model.md`, Derived Actionability). For a
  user who holds `manage_packages`, the actions of the Product follow
  (Actions).
- **Hidden records.** A package, a track, or a Product that is not actionable,
  excluded, EOL, or holding nothing actionable, is hidden. "Show hidden", a
  switch at the end of the line of the heading of the part, followed by the
  number of the hidden records whose parent is not hidden, each counting with
  what it holds, shows them in `fg-muted` (`docs/design-system.md`, Detail
  Screens): a record that its own marker excludes carries the label Excluded,
  and a Product at the end of its life the label EOL, also under a hidden
  parent. Its state is `hidden=shown` in the URL, which it adds to the browser
  history, keeping the anchor and the scroll position. Without hidden records,
  it is off and disabled: when a read of the Ticket shows none while it is on,
  as after the restore of the last one, the screen removes `hidden=shown` from
  its URL, in place of the URL in the browser history, keeping the anchor, the
  scroll position, and the focus, and an open dialog with its input, without
  asking (`docs/behaviors.md`, Confirmation); the tree shows the same records
  either way. While it is off and every package is hidden, the part says "All
  packages are hidden.".
- **The tracks that wait for the signed-in user.** For a user whom
  `maintainers` lists for a package that is not excluded, the screen reads
  their work on the Ticket, `GET /api/v1/my/packages/tickets/{ticket_id}`,
  when Overview opens, whenever the tab returns to the foreground, and when a
  fetch of a source of the CVE ends (Sources of the CVE), and
  marks each track that it returns as pending, matched by package name and
  reference, with the label "Needs your action" and a bar of 3 px in `link`
  in place of its line (`docs/design-system.md`, Labels; Sentinel
  `docs/features/packages/maintainer.md`, Pending; Package Details for
  Ticket; Sentinel `docs/features/packages/package-maintainership.md`,
  Workbench Dependency). For every other user, the read is not sent, and no
  track is marked, also once a user no longer maintains a package that is
  not excluded.
- A Ticket without packages shows "No packages.", without the switch.
- For a user who holds `manage_packages`, Add package follows "Show hidden"
  at the end of the line of the heading of the part, 16 px after it, also on
  a Ticket without packages; where the line is too narrow, the switch and
  the button wrap (Actions).

**Details**, the section of the side column, as a description list:

| Term | Value |
|---|---|
| Assignee | The assignee in the full form at the small size, or "Unassigned", and, for a user who can change it, Edit assignee at the end of the line (Actions) |
| Ignore reason | While the Ticket is Ignored, `ignore_reason` by its name: `not_shipped` Not shipped, `cve_rejected` CVE rejected, `cna_policy` CNA policy, which only Sentinel sets, and `other` Other; a reason that the pinned contract does not list shows as received (Sentinel `docs/features/tickets/tickets.md`, Ignore Reason; `docs/behaviors.md`, Unknown Values) |
| Coordinated Release Date | While the Ticket is confidential, or while it has a Coordinated Release Date, also after it became non-confidential: the date and time, or an absent value, and, for a user who holds `manage_confidentiality`, Edit Coordinated Release Date at the end of the line (Actions; Sentinel `docs/features/tickets/tickets.md`, Coordinated Release Date) |
| Deadlines | A line per phase, Triage, Submission, UM, and QA, with its due date and time; the QA line reads "QA, release" while the QA due date is the final release deadline, and a line Release follows it otherwise. The phases before the current phase are in `fg-muted`; the current phase is at weight 600, with the state of its milestone below its date, as `docs/behaviors.md` (Deadlines) words it; the later phases are plain. When the current phase is done, every phase is in `fg-muted`; when it is `null` with due dates, Triage is in `fg-muted` and the other phases are plain; a current phase that the pinned contract does not list marks no phase. Without due dates, an absent value (Sentinel `docs/features/tickets/ticket-deadlines.md`, Null Due Dates; Ticket Current Phase) |
| Original | For a duplicate, `duplicate_of_ticket_id`, a link to its screen, without the lock, which the identifier does not carry (Sentinel `docs/features/tickets/tickets.md`, Identifier Disclosure Boundary) |
| Duplicates | For every other Ticket, its visible duplicates, each a link to its screen followed by the lock of a confidential one, from List Tickets, `GET /api/v1/tickets`, with `duplicate_of_ticket_id`, `sort_by=ticket_id`, `sort_order=asc`, and `per_page=100`, the largest page (Sentinel `docs/features/tickets/tickets.md`, List Tickets, Duplicate filter; Sentinel `docs/api-spec.md`, Pagination); beyond the page, "and N more", without a link; "None" without any. A duplicate has no duplicates, so its read is not sent (Sentinel `docs/features/tickets/tickets.md`, Duplicate Handling, Invariant) |
| Created | `created_at`, a date and time |
| Last modified | `updated_at`, a date and time |

**Sources of the CVE**, a section of the side column, before the
participants, for a Ticket with a CVE, from CVE Source Status,
`GET /api/v1/cves/{cve_id}/sources`, in the order of the API, by source, as a
list (Sentinel `docs/features/tickets/cve-service.md`, CVE Source Status):

- Each source on a line of its own: the mark of its status alone, which
  names the status for assistive technologies after the name of the source
  (`docs/design-system.md`, Other Values): Success a green dot, Failure a red
  dot, Missing a hollow circle, Pending turning, as an operation in progress,
  and Not attempted a dashed circle, as an observation never made; a status
  that the pinned contract does not list shows a circle with a question mark
  (`docs/behaviors.md`, Unknown Values). Then the name of the source, at
  weight 500, as Sentinel names it, NVD, MITRE, Linux Kernel CNA, GHSA, Red
  Hat, OSV, CISA KEV, EPSS, or SUSE Bugzilla (Sentinel
  `docs/features/tickets/cve-tracking.md`, CVE Sources), or as received for a
  source that the pinned contract does not list; and, at the end of the line,
  the label Disabled for a registered source that is not enabled, or Retired
  for one that is no longer registered (`docs/design-system.md`, Labels).
- Below the name, each on a line of its own across the width of the line, in
  `text-13` and `fg-muted`: "Last attempt" and the date and time of the last
  completed attempt, `fetched_at`, or an absent value without one
  (`docs/behaviors.md`, Absent Values), or, for CISA KEV in Success,
  "Updated" and the date and time of the last change of its evidence, which
  is what `fetched_at` then is; and, during a failure streak, "Failing since"
  and the date and time of its start, `first_failed_at`, which a fetch in
  progress keeps (Sentinel `docs/features/tickets/cve-service.md`, CVE Source
  Status, Response schema).
- Refetch of the source in place of its mark, and Refetch all at the end of
  the heading (Actions).
- Without sources, "No sources.".
- While the read shows a source Pending, the sources are read again every
  5 seconds (`docs/behaviors.md`, Loading). When a read no longer shows
  Pending a source that an earlier read of the screen showed so, the screen
  announces what it shows of each such source, in one announcement in the
  order of the sources, such as "MITRE: Failure. NVD: Success.", or "NVD: no
  new result." when its `fetched_at` is the one of the read that showed it
  Pending, as when Sentinel did not run the fetch or cannot tell that it is
  still pending (Sentinel `docs/features/tickets/cve-service.md`, CVE Source
  Status, Completed timestamps during pending; Redis graceful degradation);
  it then reads again the Ticket, its duplicates, the work of a maintainer on
  it, the CVSS assessments, the users who acted on it, and its access grants
  (`docs/behaviors.md`, Outcome of a Change).

**Participants**, the last section of the side column, who is involved in the
Ticket, every user once:

- its assignee, from Get Ticket;
- the users who acted on it, from List Ticket Actors,
  `GET /api/v1/tickets/{ticket_id}/actors` (Sentinel
  `docs/features/tickets/ticket-audit-log.md`, List Ticket Actors);
- the maintainers of its packages that are not excluded, from `maintainers`
  of Get Ticket, since an excluded package gives its maintainers no
  visibility of the Ticket (Sentinel
  `docs/features/packages/package-maintainership.md`, Maintainers in the
  Package Tree; Sentinel `docs/features/identity/rbac.md`, Scope and
  Confidential Ticket Visibility); and
- for a confidential Ticket, the users with an access grant, from List Access
  Grants, `GET /api/v1/tickets/{ticket_id}/access`, which every user who sees
  the Ticket reads (Sentinel `docs/features/tickets/tickets.md`, List Access
  Grants). For a Ticket that is not confidential, the read is not sent.

Bot accounts are not participants, whatever the source; System is not a user
and is never one; an inactive user is. The participants show as a group of
users named "Participants" (`docs/design-system.md`, Representation of a
User): the assignee first, then the others by display name, and by username
between equal names. Each shows its name in the compact form when it takes
the focus or the pointer rests on it, such as "Robert Lee (inactive)"
(`docs/behaviors.md`, Representation of a User). A Ticket without any says
"No participants.".

On a confidential Ticket, Access grants, a quiet button 32 px high with
`user-round-key` at the end of the heading (`docs/design-system.md`, Buttons
and Links), opens the access grants of the Ticket for every user who sees it,
in a dialog at most 560 px wide named "Access grants" (`docs/design-system.md`,
Dialogs):

- below the title, in `fg-muted`, what a grant does: "An access grant lets a
  user see this confidential Ticket. The users who see every Ticket, and the
  maintainers of its packages that are not excluded, see it without one."
  (Sentinel `docs/features/identity/rbac.md`, Scope and Confidential Ticket
  Visibility);
- below it, for a user who holds `manage_confidentiality`, the form of Grant
  access (Actions);
- the grants, as a list named "Access grants", in the order of the API, by
  the time of the grant, between `border` lines: each its user in the full
  form at the medium size with the username and the labels, and below it, in
  `text-13`, `fg-muted`, "Granted by", the user who granted it in the name
  form, "on", and the date and time of the grant, such
  as "Granted by Alice Smith on 8 Nov 2026, 13:05"; and, for a user who holds
  `manage_confidentiality`, Revoke access at its end, or below the user where
  the line is too narrow for both (Actions). A bot account with a grant shows
  here with the label Bot, although it is not a participant. Without grants,
  "No access grants.";
- Close, a secondary button, which closes the dialog, as Escape does, and
  returns the focus to Access grants.

For a user who holds `manage_confidentiality`, the user field of the form
takes the focus as the dialog opens; for every other user, who has no field,
the dialog takes the focus itself, so that its grants are read first
(`docs/behaviors.md`, Accessibility, Dialogs). The dialog offers Grant access
and Revoke access as the user's capabilities were when it opened, until it
closes (`docs/behaviors.md`, The Signed-in User). When a read shows the
Ticket no longer confidential while the dialog is open, the dialog stays open
and says, in `fg-muted`, "This Ticket is no longer confidential, so it has
no access grants." in place of its explanation, the form, and the grants,
which its status region announces, and takes the focus; Close then moves the
focus to the screen's heading, since Access grants is gone
(`docs/behaviors.md`, Accessibility, Focus after an action). When a read
removes Access grants while it has the focus, the focus moves to
the screen's heading too.

**References**, a tab that takes the whole width, without a side column
(`docs/design-system.md`, Detail Screens): the references of the Ticket, from
List References, `GET /api/v1/tickets/{ticket_id}/references`, read when the
tab opens, every reference at once, without pages, in the order of the API,
by type, then by the time it was added (Sentinel
`docs/features/tickets/ticket-references.md`, List References). A reference
that a user added is manual; the others are automatic, owned by the fetcher
of a source of the CVE that added them (same document, Purpose).

- **The toolbar** of a tab without a heading, since the selected tab names
  the panel (`docs/design-system.md`, Lists): Add reference with `plus`, for
  a user who holds `manage_references` (Actions), Filters, and Clear filters.
  The table follows 16 px below. The screen
  applies the filters itself to the complete list that List References
  returns, whose own `type` and `source` filters take one value each and
  cannot select a reference without a type (Sentinel `docs/api-spec.md`, Enum
  Filter Validation; Sentinel `docs/features/tickets/ticket-references.md`,
  List References). Filters holds, in this order:
  - **Type**, a group of checkboxes, Advisory, Patch, Issue, Article, and
    Uncategorized, without icons, that sets `type`: a reference matches when
    its type is one of those chosen, a reference without a type when
    Uncategorized is, and a reference of a type that the pinned contract
    does not list matches none (`docs/behaviors.md`, Unknown Values).
  - **Source**, a select (`docs/design-system.md`, Forms) that sets `source`:
    Any source; then, after a line, the sources of the references of the
    Ticket that the pinned contract lists, as the table names them, Manual
    first, then the others by name (`docs/behaviors.md`, Unknown Values).
    While List References loads, or when it fails, the select shows Any
    source and, in place of the sources, the loading indicator or the
    message of the failure. A source of the URL that no reference of the
    Ticket has shows in the select by its name, and matches no reference.
- **The table** "References" (`docs/design-system.md`, Tables), whose column
  Reference wraps and whose rows grow, since a reference has no screen of its
  own:
  - Reference, which names the row and takes the width that the other
    columns leave: the title, or without a title the address, at weight 500,
    as a link to the address, or as text where the address is not a web
    address (`docs/behaviors.md`, Links to Other Sites); below a title, the
    address in `text-13`, `fg-muted`, as the link leads to it (same section,
    The address as parsed); and below them the description, cut to its
    first four lines with Show more (`docs/design-system.md`, Main Content).
    A title or an address longer than its line wraps at any character.
  - Type: Advisory, Patch, Issue, or Article; for a reference without a
    type, "Uncategorized" in `fg-muted`, the name of the absence of a type
    (Sentinel `docs/features/tickets/ticket-references.md`, ReferenceType;
    `docs/behaviors.md`, Absent Values); and a type that the pinned contract
    does not list as received (`docs/behaviors.md`, Unknown Values).
  - Source: "Manual", or the CVE source whose fetcher owns the reference, as
    Sentinel names it, such as NVD for `sync_nvd_cves` (Sentinel
    `docs/features/tickets/cve-tracking.md`, CVE Sources), so that the rows
    without Edit and Delete are explained; any other source as received.
  - Added: `created_at`, a date and time.
  - For a user who holds `manage_references`, the column of the actions
    (`docs/design-system.md`, Tables): Edit and Delete in the row of a
    manual reference (Actions), and nothing in the row of an automatic one.
- Without references, "No references." in `fg-muted`, in place of the table
  (`docs/behaviors.md`, Empty States). When no reference matches the
  filters, the table says "No references match the filters." inside its
  frame, below the header row, with Clear filters (`docs/design-system.md`,
  Tables; Empty States).
- After a change of the filters, also one that Clear filters or the browser
  history makes, the screen announces what the tab shows, "3 references",
  "1 reference", "No references match the filters.", or "No references."
  for a Ticket without any, with the focus where it was
  (`docs/behaviors.md`, Accessibility, Focus after a navigation); the tab
  announces nothing as it opens.

**Affected versions**, a tab that takes the whole width, without a side
column (`docs/design-system.md`, Detail Screens): the products and versions
that the CVE of the Ticket affects, as the scopes of their provenance report
them, from Get CVE Affected Versions,
`GET /api/v1/cves/{cve_id}/affected-versions`, read when the tab opens,
every entry at once, without pages (Sentinel
`docs/features/tickets/cve-tracking.md`, Get CVE Affected Versions).
Sentinel uses them neither to resolve packages nor to decide affectedness,
which analysts decide on the tracks (same section). A source of this tab is
the scope of the provenance of its entries, `source_container`, such as the
CNA container of the CVE record, which several CVE sources can write, not
one of the CVE sources that Overview shows (Sentinel `docs/data-model.md`,
CVEAffectedVersion).

- **The toolbar** of a tab without a heading (`docs/design-system.md`,
  Lists): at its start, "The versions of the affected software as the CVE
  record and other databases report them."; then the search field, "Search
  entries", and Clear filters while a search applies. The tab applies the
  search itself to the entries that it read, since the operation takes no
  parameter (Sentinel `docs/features/tickets/cve-tracking.md`, Get CVE
  Affected Versions, Filtering and sorting): an entry matches when one of its
  values, as Sentinel returns it, holds the term without regard to case, also
  a value that only the details of its source show, such as a CPE or a
  program file, but not the name of its source or the words of its line.
- **The affected products**, each a group under a band
  (`docs/design-system.md`, Detail Screens) whose level-two heading is its
  name: the product of its entries, or without one their package name, or
  without either the first that they have of their repository, collection
  URL, Package URL, and CPE, a repository or a collection URL as a link where
  it is a web address (`docs/behaviors.md`, Links to Other Sites). Entries
  without any of these show last, under "Unnamed product" in `fg-muted`. The
  entries of one name, as Sentinel returns it, are one product whatever their
  source; names that differ in their writing, such as `fictional-tar` and
  `fictional_tar`, are two, since Sentinel does not tell whether they name
  the same software. The products are in alphabetical order of their name.
- **The sources** of a product, below its band, as a description list
  (`docs/design-system.md`, Detail Screens): each source a term, a CNA as
  "CNA", an ADP by its short name, such as "CISA-ADP", GHSA and OSV as
  Sentinel names them (Sentinel `docs/features/tickets/cve-tracking.md`, CVE
  Sources), and a scope that the pinned contract does not list as received
  (`docs/behaviors.md`, Unknown Values); its versions the value. The CNA comes first, as the authority of
  the record of the CVE, then the other sources in the order of the API, by
  scope. A source shows once for each set of the fields that its entries
  share, such as each `affected` element of a CVE record, in the order in
  which the API first returns one of its entries, so a source can show twice
  in a product, such as the Git ranges and the stable versions of a kernel
  CVE.
- **The versions** of a source, a line each, in the order of the API, by
  package coordinates, then by version type, version, and end as text, which
  is not the order of the versions (Sentinel
  `docs/features/tickets/cve-tracking.md`, Get CVE Affected Versions,
  Filtering and sorting). Each says the versions of its entry in words, as
  the scope of the entry means them (same document, Get CVE Affected
  Versions, Interpreting entries; Sentinel
  `docs/features/platform/cve-record-parser.md`, `parse_affected_versions`;
  Sentinel `docs/features/tickets/cve-sync-ghsa.md`, Field Mapping, Affected
  versions (from `.vulnerabilities[]`); Sentinel
  `docs/features/tickets/cve-sync-osv.md`, Field Mapping — CVE Record
  (Phase 1); Field Mapping — Alias Records (Phase 2)):

  | Entry | Words |
  |---|---|
  | A start and an end | "From 1.0 before 1.5", without the end; "From 1.0 through 1.4.2", with the end; "From 1.0 up to 2.0" when Sentinel does not say which |
  | An end alone | "Before 1.5", "Through 1.5", or "Up to 1.5" |
  | A start and an end of one version, with the end | The version, such as "1.5.0" |
  | A version alone | The version, such as "1.5", from a CNA, an ADP, or a scope that the pinned contract does not list, and an enumerated version of OSV, of type `exact`; an open range from GHSA and OSV, such as "From 1.0.0" |
  | No version | "Every version" from OSV; "No version details" in `fg-muted` otherwise |

  A Git commit shows in monospace, and every value as received, such as
  `6.1.*` or `*`. At the end of the line, in a column of 104 px, the status
  of the entry with the dot of its tone (`docs/design-system.md`, Other
  Values): Affected `warning`, as the affectedness of a track, Unaffected
  `success`, Unknown `neutral`, and a status that the pinned contract does
  not list as received; or nothing for an entry without a status, as those
  of GHSA and OSV. A line is on `surface` under the pointer
  (`docs/design-system.md`, Detail Screens).
- **A CNA or an ADP**, whose entries come from the `affected` elements of the
  CVE record: an entry without a version, an end, or a status of its own
  makes no line of its own, and an entry without a status of its own takes
  the status of its element, `default_status` (Sentinel
  `docs/features/tickets/cve-tracking.md`, Get CVE Affected Versions,
  Interpreting entries; Sentinel `docs/data-model.md`, CVEAffectedVersion). A
  last line, "Other versions" in `fg-muted`, shows that status, which applies
  to the versions that the element does not list, or "All versions" when it
  lists none; it shows only while the search hides none of the lines of its
  source, so that it never seems to cover a version that the search hides.
  Without such a status and without versions, the line says "No version
  details". A scope that the pinned contract does not list shows only what
  the fields of its entries state: no status that an entry does not carry,
  and no last line (`docs/behaviors.md`, Unknown Values).
- **The details of a source**: the name of a source whose entries share a
  field of the table below is a name that opens its details
  (`docs/design-system.md`, Menus, Popovers, and Tooltips), named after the
  source and the product, such as "CNA for fictional-tar", or "CNA for the
  unnamed product", followed, for a source that shows more than once in its
  product, by its rank among all its blocks there, also those that the
  search hides, such as "CNA for Linux, 2 of 2". The title of the popover is
  the source, with the name of the product below it, and nothing there for
  the unnamed product, and its details, a description list:

  | Term | Value |
  |---|---|
  | Vendor | `vendor` |
  | Package name | `package_name`, where it is neither the name of the affected product nor its `product` |
  | Ecosystem | `ecosystem`, such as npm or Debian:12, of which the versions are |
  | Repository, Collection URL | `repo`, `collection_url`, each a link where it is a web address, and text otherwise (`docs/behaviors.md`, Links to Other Sites) |
  | Package URL, CPE | `package_url`, `cpe`, as text in monospace |
  | Version type | The version types of the entries, each once, such as semver or git |
  | Program files | `program_files`, below its term, cut to their first four lines with Show more (`docs/design-system.md`, Main Content) |

  A field without a value does not show, and neither does the field that
  names the product. A source without any of these fields shows its name as
  text.
- A CVE without entries says "Sentinel has no version data for this CVE." in
  `fg-muted`, since Sentinel does not tell a scope that its source emptied
  from one that it never observed (Sentinel
  `docs/features/tickets/cve-tracking.md`, Get CVE Affected Versions, Empty
  and absent scopes). When no entry matches the search, the tab says "No
  entries match the search." with Clear filters (`docs/behaviors.md`, Empty
  States). A Ticket without a CVE says "This Ticket has no CVE.", without the
  toolbar, and the read is not sent.
- After a change of the search, also one that Clear filters or the browser
  history makes, the screen announces what the tab shows, "7 entries", "1
  entry", "No entries match the search.", or "Sentinel has no version data
  for this CVE.", with the focus where it was (`docs/behaviors.md`,
  Accessibility, Focus after a navigation); the tab announces nothing as it
  opens. When a product or a source that holds the focus leaves the page, as
  after a search, the focus moves to the screen's heading
  (`docs/behaviors.md`, Accessibility, Focus after an action).

**Audit log**, a tab that takes the whole width, without a side column
(`docs/design-system.md`, Detail Screens): the events of the Ticket as a
timeline (`docs/design-system.md`, Timelines), from List Ticket Events,
`GET /api/v1/tickets/{ticket_id}/audit-log`, newest first, 50 a page
(Sentinel `docs/features/tickets/ticket-audit-log.md`, List Ticket Events).

- **The toolbar**, at the end of the line above the timeline
  (`docs/design-system.md`, Lists): the search field, "Search events", which
  takes at most 500 characters and sends `search`; Filters; and Clear
  filters. Sentinel matches the term, without regard to case, against the
  values as it records them, such as `NOT_AFFECTED` for a track that is Not
  affected, not against the sentences or the names of the actors (same
  section). Filters holds, in this order:
  - **Actor**, a select (`docs/design-system.md`, Forms) that sends `actor`:
    Any actor; System, with the Sentinel mark, which sends `system`; and the
    signed-in user with the label You (`docs/design-system.md`, Labels) when
    they acted on the Ticket; then, after a line, the other users who acted
    on it, from List Ticket Actors, `GET /api/v1/tickets/{ticket_id}/actors`,
    in its order, by username (same document, List Ticket Actors), bot
    accounts and inactive users included, without the line when there are
    none. Each user shows in the full form with the username and the labels,
    and sends their `id`. List Ticket Actors is read when the tab opens; while
    it loads, or when it fails, the select shows Any actor, System, and in
    place of the users the loading indicator or the message of the failure.
    While the read loads, a chosen user shows the loading indicator in the
    select, and once it has arrived without that user, or has failed, as
    "Unknown user" in `fg-muted`: the events of an `actor` that
    did not act on the Ticket are none, which Sentinel returns without an
    error (same document, `list_ticket_events()`), so the screen reads the
    events without waiting for the actors.
  - **Kind**, a group of checkboxes, each with the icon of its kind
    (`docs/design-system.md`, Icons by Need), that sends the event types of
    each kind chosen as `event_type`:

    | Kind | Event types |
    |---|---|
    | Status | `ticket_created`, `status_change`, `duplicate_set`, `duplicate_removed`, `duplicate_target_changed` |
    | Assignment | `assignment` |
    | Packages | `package_added`, `package_maintainer_added`, `package_excluded`, `package_restored`, `track_status_changed`, `track_excluded`, `track_restored`, `product_released`, `product_eligibility_changed`, `product_excluded`, `product_restored` |
    | CVE and CVSS | `cve_associated`, `cvss_assessment_changed`, `severity_changed` |
    | Priority | `priority_changed` |
    | Confidentiality | `confidentiality_changed`, `coordinated_release_changed`, `access_grant_added`, `access_grant_removed` |
    | References | `reference_added`, `reference_deleted`, `reference_url_changed`, `reference_type_changed`, `reference_title_changed`, `reference_description_changed` |

  - **Period**, the date fields From and To (`docs/behaviors.md`, Input),
    each with its calendar, which send `from_date` and `to_date` (Sentinel
    `docs/api-spec.md`, Date Range Interpretation). The fields take the days
    from that of the first event of the Ticket, in the time zone of the
    browser as the timeline groups it, to today, or to that day when a
    clock of the browser behind Sentinel's shows it after today: the first
    event is its
    `ticket_created` (Sentinel `docs/features/tickets/ticket-audit-log.md`,
    Cross-Event Ordering, Locking, and Rollback), which the screen reads as
    it reads its data, as the one event of
    `event_type=ticket_created&per_page=1` from List Ticket Events
    (`docs/behaviors.md`, Loading). Without a bound, From shows the day of
    the first event, unless the applied To is before it, and To stays
    empty, up to today: the period that the timeline shows without a
    filter. Whenever the fields apply the period, a From on the day of the
    first event, typed, chosen, or unchanged from the URL, is no bound: it
    sends no `from_date` and leaves the URL without `from`, so it does not
    count among the filters that apply. Enter in a field that the user
    emptied removes its bound, and a From so emptied shows the day of the
    first event again once the focus leaves both fields. Until a read of the
    first event succeeds, while it loads, when it fails, and when it returns
    no event, From stays empty and
    the fields take the days from 1 Jan 1970 to today, and a failure shows
    nowhere (`docs/behaviors.md`, Where Errors Appear); a day that arrives
    while the focus is in the period shows in From once the focus leaves
    both fields. A date of the URL that the fields do not take, such as a
    day after today, applies and shows in its field as it is, without an
    error. A field with only some of its parts says "Enter the day, the
    month, and the year.", a typed date outside the days that the field
    takes "Enter a date from 8 Nov 2026 to 12 Nov 2026.", with its first and
    its last day, and a start after the end "This date is before the
    start." at To; none of them applies, and each goes as its field returns
    to the applied date when the focus leaves it (`docs/design-system.md`,
    Lists).
- **The events**, grouped by day, each day a level-two heading. Each event
  shows its time, the icon of its kind, or `circle-question-mark` for an
  event type that the pinned contract does not list, and its sentence, which
  starts with its actor, or System without one (`docs/behaviors.md`,
  Representation of a User). A user whom an event names only by the username
  that it recorded, such as the assignee of an `assignment`, shows as `@`
  and that username, at weight 500, without an avatar or labels. A value of
  the pinned contract shows by the name that the screen gives it elsewhere,
  as `docs/behaviors.md` (Domain Terms) names it: a Ticket status, a
  severity, a priority, a track status, such as `WONT_FIX` as Won't fix, an
  ignore reason, such as `not_shipped` as Not shipped, and a reference type;
  any other value, and a value that the pinned contract does not list, shows
  as received, and an absent severity or priority as Not set. A Ticket
  identifier is a link to its screen, the address of a reference a link to it
  (`docs/behaviors.md`, Links to Other Sites), and a date and time shows as
  such (`docs/behaviors.md`, Display). A vector wraps only after a "/", as in
  the table of the CVSS assessments; any other value without a place to
  break, such as an address, wraps at any character where its line is too
  narrow, and a text keeps none of its line breaks. In the table, *Package ·
  track* is the `package` and the `track` of `detail`, and *Product* its
  `product_name` (Sentinel `docs/features/tickets/ticket-audit-log.md`,
  Event Type Contract; detail JSONB Schema Contract):

  | Event type | Sentence after the actor |
  |---|---|
  | `ticket_created` | "created the Ticket from its CVE, ingested from NVD", with the source of the comment `CVE ingested from NVD`; otherwise "created the Ticket", which the comment `Ticket created manually` does not follow |
  | `status_change` | "changed the status from Analysis to Analyzed"; into Ignored with a reason in `detail`, "ignored the Ticket as Not shipped, from New", the reason by its name in the details (Details), which the comments `CVE rejected` and `CNA auto-ignore policy` then do not follow, while they follow the sentence of an event without a reason |
  | `assignment` | "assigned the Ticket to @asmith"; "reassigned the Ticket from @asmith to @bwilson"; "unassigned @asmith"; for an unassignment by the system, "unassigned @eblack: user deactivated", from its comment (Sentinel `docs/features/tickets/ticket-audit-log.md`, Canonical Automatic Comment Vocabulary) |
  | `duplicate_set` | "marked the Ticket as a duplicate of SNTL-21" |
  | `duplicate_removed` | "reverted the duplicate of SNTL-21" |
  | `duplicate_target_changed` | "changed the original from SNTL-22 to SNTL-21, as SNTL-22 was marked as a duplicate" |
  | `package_added` | "added or completed the package fictional-openssl": the event records a new package and new tracks or Products of a package alike |
  | `package_maintainer_added` | "added the maintainer @ghill to fictional-openssl" |
  | `package_excluded`, `package_restored` | "excluded the package fictional-openssl", "restored the package fictional-openssl" |
  | `track_status_changed` | "set *Package · track* from Analysis to Affected" |
  | `track_excluded`, `track_restored` | "excluded the track *Package · track*", "restored the track *Package · track*" |
  | `product_released` | "recorded the release of *Product* of *Package · track* on 8 Nov 2026, 13:05, in SUSE-SU-2099:0001-1", with `advisory_id` |
  | `product_eligibility_changed` | "made *Product* of *Package · track* eligible", or "not eligible", followed by its reason: "after a change of the CVSS assessments or of the default CVSS version" (`cvss`), "after a change of its CVSS threshold" (`threshold`), "after a change of its lifecycle phase" (`reactive_ltss`), "as the Ticket left Ignored or Duplicated" (`reactivation`), or the reason as received; set by hand (`va_override`), "set *Product* of *Package · track* as eligible by hand", or "as not eligible", and "returned *Product* of *Package · track* to automatic eligibility, eligible" when the override is cleared |
  | `product_excluded`, `product_restored` | "excluded *Product* from *Package · track*", "restored *Product* on *Package · track*" |
  | `cve_associated` | "associated CVE-2099-0021" |
  | `severity_changed` | "set the severity to High"; "changed the severity from High to Critical"; "removed the severity High" |
  | `priority_changed` | "set the priority to P3"; "changed the priority from P3 to P2"; for an override, "overrode the priority from P3 to P1", "changed the priority override from P1 to P2", or "cleared the priority override, from P1 to P3" (Sentinel `docs/features/tickets/ticket-priority.md`, Manual Override) |
  | `cvss_assessment_changed` | "added the NVD CVSS v3.1 assessment 8.1, CVSS:3.1/AV:N/…", "changed the SUSE CVSS v3.1 assessment from 7.5, CVSS:3.1/… to 8.1, CVSS:3.1/…", or "deleted the SUSE CVSS v3.1 assessment 8.1, CVSS:3.1/…", the vector in monospace at the size of the sentence, from the canonical values (Sentinel `docs/features/tickets/ticket-audit-log.md`, Event Type Contract, Rules); a value of another form as received |
  | `confidentiality_changed` | "made the Ticket confidential", "made the Ticket non-confidential" |
  | `coordinated_release_changed` | "set the Coordinated Release Date to 25 Nov 2026, 14:00"; "changed the Coordinated Release Date from … to …"; "removed the Coordinated Release Date 25 Nov 2026, 14:00" |
  | `access_grant_added`, `access_grant_removed` | "granted access to @cwhite", "revoked the access of @cwhite" |
  | `reference_added`, `reference_deleted` | "added the reference https://…", "deleted the reference https://…" |
  | `reference_url_changed` | "changed the address of a reference from https://… to https://…" |
  | `reference_type_changed` | "changed the type of https://… from Article to Advisory", a type without a value being Uncategorized (Sentinel `docs/features/tickets/ticket-references.md`, ReferenceType) |
  | `reference_title_changed`, `reference_description_changed` | "changed the title of https://… from “Fictional advisory draft” to “Fictional advisory”"; "set the title of https://… to “…”" without an earlier one; "removed the title “…” of https://…" without a new one; and so for the description |

  An event whose fields lack what its sentence needs, such as a
  `status_change` into Ignored recorded before the reason existed, says what
  its fields hold, such as "changed the status from New to Ignored". An event
  type that the pinned contract does not list shows its actor followed by
  its type as received, such as "John Doe fictional_event", with its time
  and none of its values (`docs/behaviors.md`, Unknown Values). Every comment
  that the sentence of its event does not use, such as `CVE package
  resolution` of a package added by the system, follows the sentence
  (`docs/design-system.md`, Timelines).
- **Pagination**, below the timeline, when the events have more than one
  page (`docs/design-system.md`, Lists), with the behavior of the pagination
  of the Ticket list: when Previous or Next holds the focus and becomes
  disabled, the focus moves to the other one, and the pagination goes with
  the events when an error takes their place.

## Actions

The actions share these rules, which the entries below state only where they
depart from them:

- **Statuses.** Sentinel refuses a change on an Ignored or Duplicated Ticket
  with `409 TICKET_NOT_MUTABLE`, so the screen offers an action that this
  guard covers on a Ticket in New, Analysis, Analyzed, or Resolved, and none
  on a Ticket of a status that the pinned contract does not list (Sentinel
  `docs/api-spec.md`, Manual-Zone Mutability Guard; `docs/behaviors.md`,
  Unknown Values). Refetch, Grant access and Revoke access, Make
  confidential… and Make non-confidential…, Edit Coordinated Release Date,
  and the actions of the references are outside the guard, and the screen
  offers them in every status. Reopen, Revert duplicate, and Rerun
  convergence are outside the guard too, each with the statuses that its
  entry states. An action that the status of the Ticket does not allow is not offered, in a menu
  too, rather than shown disabled: the arrow keys of a menu pass over a
  disabled item, so its reason would not be read, and a control whose
  actions are all left out does not show (`docs/screen-map.md`, Roles,
  Principles).
- **Dialogs and confirmations of a change.** With input that the user
  changed, Cancel, Escape, and a navigation of the UI, such as back, ask
  "Discard changes?", with the consequence that the entry states, Keep
  editing, and Discard (`docs/behaviors.md`, Confirmation). While the
  request is in progress, its action is busy, the dialog or the confirmation
  cannot be closed, and a navigation asks nothing (`docs/behaviors.md`,
  Loading). Once Sentinel confirms the change, it closes, and the focus
  returns to the button that opened it (`docs/behaviors.md`, Accessibility,
  Dialogs), or moves as the entry states when the change removes that
  button.
- **Forms.** A form checks before sending what its entry states, and the error
  of a check shows at its field when the user submits the form, the field takes
  the focus, and the error goes once the input changes (`docs/behaviors.md`,
  Where Errors Appear; Accessibility, Announcements). A dialog that edits
  values closes without a request when its values are those with which it
  opened.
- **Outcome.** The screen announces an outcome once the read after the
  change that the entry names arrives, and shows it in the message area
  when that read fails, also when the failure replaces the screen, as a
  `403` or a `404` of the Ticket does (States; `docs/behaviors.md`, Outcome
  of a Change). The outcome of a change that ends after the user left the
  tab shows in the message area, and so does its failure, in the
  presentation of its status unless the entry or States gives another
  (`docs/behaviors.md`, Default Presentation by Status; Retries and
  Unconfirmed Changes), starting with the Ticket, as a link to its screen,
  such as "SNTL-42: Assigned to Bob Wilson.", when the user is on another
  screen.
- **Reads.** Whatever the outcome of a change, the screen then reads again
  what the change affects, which the entry lists (`docs/behaviors.md`,
  Outcome of a Change).
- **Focus.** After a change that removes the element with the focus, the
  focus waits for the read after the change and moves only while it is
  still where the entry states; `docs/behaviors.md` (Accessibility, Focus
  after an action) states where it is when that read fails.

**Ignore…** and **Ignore as not shipped by SUSE**, Ignore Ticket, `POST
/api/v1/tickets/{ticket_id}/ignore`; **Mark as duplicate…**, Mark Ticket as
Duplicate, `POST /api/v1/tickets/{ticket_id}/duplicate`; **Reopen**, Reopen
Ticket, `POST /api/v1/tickets/{ticket_id}/reopen`; and **Revert duplicate**,
Revert Duplicate Status, `POST /api/v1/tickets/{ticket_id}/revert-duplicate`,
for a user who holds `triage_ticket`; and **Rerun convergence**, Rerun Ticket
Convergence, `POST /api/v1/tickets/{ticket_id}/rerun-reactivation`, for a user
who holds `triage_ticket` or `manage_fetchers`, in Actions, the menu at the end
of the heading row (`docs/design-system.md`, Detail Screens; Sentinel
`docs/features/tickets/tickets.md`, Status Transitions; Duplicate Handling;
Ignored; Ignore Reason; Ignore Ticket; Mark Ticket as Duplicate; Reopen Ticket;
Revert Duplicate Status; Rerun Ticket Convergence; Sentinel
`docs/features/identity/rbac.md`, Endpoint Permission Map (Tickets)):

- Actions offers the actions that the user can take on the Ticket in its status
  (above): first, so that the keyboard, which opens the menu on its first
  item, opens a dialog rather than ignoring at once, Ignore… and Ignore as
  not shipped by SUSE, each with `circle-pause`, on a Ticket in New or
  Analysis, since Sentinel refuses an ignore on an Analyzed or Resolved
  Ticket with `409 TICKET_INVALID_TRANSITION`; Mark as duplicate…, with
  `merge`, on a Ticket in New, Analysis, Analyzed, or Resolved; Reopen, with
  `circle-play`, on an Ignored Ticket; Revert duplicate, with `split`, on a
  Duplicated Ticket; below a `border` line, the actions on the priority, the
  severity, and the CVE of the Ticket (below), Override priority…, Set
  severity…, and Associate CVE…; below a `border` line when one of them
  precedes it, Rerun convergence, with `list-restart`, on a Ticket in
  Analysis, Analyzed, or Resolved, since Sentinel refuses it on a New,
  Ignored, or Duplicated Ticket with `409 TICKET_INVALID_TRANSITION`; and
  last, below a `border` line when one of them precedes it, Make
  confidential… or Make non-confidential… (below). So Actions does not show
  to a user who holds none of `triage_ticket`, `manage_fetchers`, and
  `manage_confidentiality`, nor to a user who holds `manage_fetchers` alone
  on a New, Ignored, or Duplicated Ticket.
  While its menu is open, the change of one of its items is in progress, or
  the dialog of one of its items is open, Actions stays, with the items that
  it offered as its menu opened (`docs/behaviors.md`, The Signed-in User).
- Ignore… opens a dialog at most 560 px wide (`docs/design-system.md`,
  Dialogs), titled such as "Ignore SNTL-31", once its menu has closed, so that
  the focus returns to Actions as the dialog closes. It says, in `fg-muted`,
  "SNTL-31 stops being worked, and accepts no change to its analysis until
  Reopen."; then Reason, in a form (`docs/design-system.md`, Forms), a group of
  radio buttons that offers the reasons that a user can choose, none chosen,
  each with its meaning below it:
  - Not shipped, `not_shipped`: "SUSE ships none of the affected software. If
    SUSE ships it but the issue doesn't affect it, set its tracks to Not
    affected instead.";
  - CVE rejected, `cve_rejected`, only while the CVE of the Ticket is
    rejected, since Sentinel refuses it otherwise: "CVE-2099-0027 is
    rejected. If the rejection is reverted, SNTL-31 reopens by itself.";
  - Other, `other`: "Another reason. SNTL-31 stays ignored until someone
    reopens it."

  Then Cancel and Ignore, a primary button. The dialog offers the reasons of
  the Ticket as it opened, until it closes, so that a read does not change the
  choices under the user; Sentinel decides the reason sent (States). No user
  chooses `cna_policy`, which only Sentinel sets (Sentinel
  `docs/features/tickets/tickets.md`, Ignore Reason). Like the dialog of Mark
  as duplicate…, it belongs to the heading row, so a navigation between the
  tabs of the Ticket leaves it open.
- The form checks that a reason is chosen before sending it: without one,
  "Choose a reason." at Reason (above). Ignore… asks for no confirmation:
  Reopen reverses it (`docs/behaviors.md`, Confirmation). Its input is the
  reason chosen, and before discarding it the question says "SNTL-31 isn't
  ignored." (above). While the request is in progress, the reason is read-only
  (`docs/design-system.md`, Forms).
- Ignore as not shipped by SUSE ignores the Ticket with `not_shipped` at
  once, the quick action of the most common reason; its label says that SUSE
  ships none of the affected software, so that it is not used for software
  that SUSE ships but that the issue does not affect, whose tracks are Not
  affected instead.
- Mark as duplicate… opens a dialog at most 560 px wide
  (`docs/design-system.md`, Dialogs), titled such as "Mark SNTL-30 as a
  duplicate", once its menu has closed, so that the focus returns to Actions
  as the dialog closes. It says, in `fg-muted`, "SNTL-30 becomes a duplicate
  of the Ticket that you choose, and accepts no change to its analysis until
  Revert duplicate.", and below it what the change does to the duplicates of the
  Ticket, which Sentinel moves to the original (Sentinel
  `docs/features/tickets/tickets.md`, Mark-as-Duplicate Operation): their
  identifiers, from the read of the duplicates that the details show (Content,
  Details), which the dialog sends on every tab, the visible ones only, since
  Sentinel also moves those that the user cannot see (same document, List
  Tickets, Duplicate filter), such as "SNTL-31 and SNTL-32, its duplicates,
  become duplicates of that Ticket too.", "SNTL-31, its duplicate, becomes a
  duplicate of that Ticket too.", or, after the identifiers of the page of
  that read, ", and 3 more, its duplicates, become duplicates of that Ticket
  too."; nothing for a Ticket without visible duplicates; and, until that read
  arrives and when it fails, "Its duplicates, if it has any, become duplicates
  of that Ticket too.". Then the field Original, in a form
  (`docs/design-system.md`, Forms), which takes the focus as the dialog opens;
  then Cancel and Mark as duplicate, a primary button. The dialog belongs to
  the heading row, which every tab shares, so a navigation between the tabs of
  the Ticket leaves it open, as it leaves a menu whose change is in progress.
- Original is a combobox that searches the Tickets that the user can see as
  the user types (`docs/design-system.md`, Forms), described "Type its
  identifier, its CVE ID, or the name of one of its packages to find it.":
  from 2 characters, the first 20 Tickets that List Tickets, `GET
  /api/v1/tickets`, returns for the term as `search`, by identifier, with
  `sort_by=ticket_id` and `sort_order=asc`, which matches the identifier, the
  CVE ID, the names of the packages, and the external identifiers of a Ticket
  (Sentinel `docs/features/tickets/tickets.md`, Search; List Tickets); "No
  Tickets match." without one, and "The first 20 of 63 Tickets that match.
  Type more to narrow them." when more match. Each option has two lines: the
  identifier at weight 500, followed by the lock of a confidential Ticket
  (`docs/design-system.md`, Confidential Tickets), its status (same document,
  Ticket Status), and, for a Ticket that the field does not offer, the label
  that says why (same document, Labels); below them, in `text-13`, `fg-muted`,
  on one line that ends with an ellipsis, the CVE ID, followed by the title of
  the CVE when it has one, such as "CVE-2099-0013 · Fictional flaw
  CVE-2099-0013", or, for a Ticket without a CVE, "No CVE", followed by its
  packages when it has any, such as "No CVE · fictional-lz4". The field lists,
  disabled, the Ticket itself, with the label "This Ticket", and a Duplicated
  Ticket, since an original is never a duplicate (Sentinel
  `docs/features/tickets/tickets.md`, Duplicate Handling, Invariant): with the
  label of its original, such as "Duplicate of SNTL-40", which the user
  chooses instead, or with "Duplicate of this Ticket" when the Ticket itself
  is its original, which becomes the original only once its own duplicate
  status is reverted. It offers a Ticket of every other status, also one that
  the pinned contract does not list: an option only helps to find the
  original, and the field takes any identifier typed, so leaving the Ticket
  out would prevent nothing. Choosing a Ticket writes its identifier in the
  field. The Tickets only help to find the original: the field also takes an
  identifier that the user types, with or without `SNTL-`, in any letter case,
  such as "sntl-42" or "42", which the form sends in its canonical form,
  `SNTL-42` (Sentinel `docs/api-spec.md`, Ticket Identifier Resolution), and a
  failure of their read, which shows in the menu, leaves the change possible.
- The form checks the original, without its surrounding whitespace, before
  sending it: empty, "Choose the original Ticket."; a text that is not an
  identifier, "Choose a Ticket, or enter its identifier, such as SNTL-42."; and
  the Ticket itself, "A Ticket can't be a duplicate of itself." (above).
- Mark as duplicate… asks for no confirmation: Revert duplicate reverses it,
  and the duplicates that it moved return with changes of their own
  (`docs/behaviors.md`, Confirmation; Sentinel
  `docs/features/tickets/tickets.md`, Revert-Duplicate Operation). Its input
  is a text typed or chosen, other than whitespace, and before discarding it
  the question says "SNTL-30 isn't marked as a duplicate." (above). While the
  request is in progress, the field keeps the original sent, read-only, and
  its focus.
- Ignore as not shipped by SUSE, Reopen, Revert duplicate, and Rerun
  convergence apply at once, as the items of a menu do, without confirmation
  (`docs/design-system.md`, Menus, Popovers, and Tooltips; `docs/behaviors.md`,
  Confirmation): Reopen and Revert duplicate make the user the assignee, when
  they can be, in place of the one that the screen shows, as an assignment
  does; an ignore makes them the assignee, when they can be, of an unassigned
  Ticket only; and a rerun changes nothing by itself (Sentinel
  `docs/features/tickets/tickets.md`, Reassignment, Expected assignee;
  Auto-Assignment on Unassigned Tickets; Rerun Ticket Convergence). While one
  is in progress, assistive technologies read with its item, as its
  description, "Ignoring.", "Reopening.", "Reverting the duplicate.", or
  "Starting the convergence."; meanwhile the other items of the menu are
  unavailable. Once Sentinel answers, the menu closes, and the focus returns to
  Actions.
- A change of the status can change the assignee, the status, which Sentinel
  evaluates anew as the Ticket leaves Ignored or Duplicated, the deadlines,
  the eligibility of the Products, and the duplicates of the Ticket and of
  its original (Sentinel `docs/features/tickets/tickets.md`, Auto-Assignment
  on Unassigned Tickets; Ignored; Duplicate Handling; Sentinel
  `docs/features/tickets/ticket-service.md`, `mark_as_duplicate`;
  `reopen_from_ignored()`; `revert_duplicate()`). After each change of the
  status, and after Rerun convergence, the screen reads again the Ticket, the
  work of a maintainer on it, the users who acted on it, its audit log, and
  the reads of the Ticket list, its duplicates included.
- The outcome of a change of the status is announced once the read of the
  Ticket after it arrives (above), as Sentinel returns the Ticket: "Marked as a
  duplicate of SNTL-21."; with the reason and the assignee that the Ticket now
  has, "Ignored as Not shipped, assigned to you.", "Ignored as CVE rejected,
  assigned to Bob Wilson.", or "Ignored as Other, unassigned."; and, with the
  status and the assignee that the Ticket now has, "Reopened: Analysis,
  assigned to you.", "Duplicate reverted: Analyzed, assigned to Bob Wilson.",
  or "Reopened: Resolved, unassigned.". Actions shows on every tab, so a change
  of its menu ends elsewhere only once the user has left the screen, not the
  tab: its outcome, or its failure, then shows in the message area, starting
  with the Ticket (above). Until the read of the Ticket after a change arrives,
  Actions offers the items of the status that the screen still shows.
- Sentinel accepts Rerun convergence with `202`, and its message says that it
  started, in the `info` tone: "Convergence started." (`docs/behaviors.md`,
  Outcome of a Change). The screen shows no progress of the convergence, of
  which Sentinel offers none (Sentinel `docs/features/tickets/tickets.md`,
  TicketConvergenceDispatchResponse): what it changes shows with the later
  reads of the screen (`docs/behaviors.md`, Loading).
- Actions stays after each of them, with the focus, since a Ticket of every
  status that the pinned contract lists offers a user who holds
  `triage_ticket` one of them. When a read removes Actions while it holds the
  focus, as after a read of the signed-in user took the capability away, the
  focus moves to the screen's heading (`docs/behaviors.md`, Accessibility,
  Focus after an action).

**Override priority…**, Set Priority Override,
`PATCH /api/v1/tickets/{ticket_id}/priority`; **Set severity…**, Set Severity
Manual, `PATCH /api/v1/tickets/{ticket_id}/severity`; and **Associate CVE…**,
Associate CVE, `POST /api/v1/tickets/{ticket_id}/associate-cve`, in Actions,
for a user who holds `triage_ticket` (Sentinel
`docs/features/tickets/tickets.md`, CVE Association; Severity Resolution;
Tickets Without CVE: Behavioral Differences; Associate CVE; Set Severity
Manual; Set Priority Override; Sentinel
`docs/features/tickets/ticket-priority.md`, Priority Levels; Automatic
Priority Basis; Manual Override):

- Actions offers them on the statuses that accept a change (above), below a
  `border` line after the actions of the status, in this order: Override
  priority…, with `user-pen`, the mark of an override; and, on a Ticket
  without a CVE only, since Sentinel derives the severity of a Ticket with a
  CVE from CVSS and keeps the CVE of a Ticket once associated, Set severity…,
  with `gauge`, and Associate CVE…, with `plus`. Each opens a dialog at most
  560 px wide (`docs/design-system.md`, Dialogs) once its menu has closed, as
  Ignore… does; it belongs to the heading row, so a navigation between the
  tabs of the Ticket leaves it open.
- Override priority… opens "Override the priority of SNTL-12". It says, in
  `fg-muted`, "An override replaces the automatic priority of SNTL-12 until
  it is cleared. Sentinel keeps calculating the automatic priority."; below
  it, in a frame, the automatic priority and what it is based on, as the
  explanation of the priority shows them beside an override
  (`docs/design-system.md`, Priority, Explanation). Then Priority, in a form
  (`docs/design-system.md`, Forms), a group of radio buttons: Automatic,
  "The automatic priority, now P3.", or "…, not yet prioritizable now."
  without one, which clears the override and sends `null`; then P1 to P4,
  each with its mark, and the meaning that Sentinel gives it, "Remediate
  immediately.", "Remediate with high urgency.", "Remediate in the normal
  flow.", and "Remediate when convenient.", which sets the override and sends
  its level. The override of the Ticket as the dialog opened is chosen; an
  override that the pinned contract does not list chooses none
  (`docs/behaviors.md`, Unknown Values). Then Cancel and Save, a primary
  button.
- Set severity… opens "Set the severity of SNTL-21". It says, in `fg-muted`,
  "Without a CVE, SNTL-21 has the severity that you set here. It decides the
  deadlines and the automatic priority of SNTL-21."; then Severity, a group
  of radio buttons: Critical, High, Medium, and Low, each with its mark
  (`docs/design-system.md`, Severity); None, with its mark and "Informational:
  no deadline applies.", since Sentinel applies no SLA to it (Sentinel
  `docs/features/tickets/ticket-deadlines.md`, SLA Tier); and Not set, which
  sends `null`, "SNTL-21 can't become Analyzed without a severity.", or, on an
  Analyzed or Resolved Ticket, "SNTL-21 returns to Analysis without a
  severity." (Sentinel `docs/features/tickets/tickets.md`, Gate: Analysis →
  Analyzed). The severity of the Ticket as the dialog opened is chosen; a
  severity that the pinned contract does not list chooses none. Then Cancel
  and Save, a primary button.
- Without a choice, Save says "Choose a priority." or "Choose a severity." at
  the group. The choice with which the dialog opened stays its value also when
  a read meanwhile shows another value, so Save then closes it without a
  request (above): the choice is the user's input, while the frame of the
  automatic priority and the meaning of Automatic and of Not set follow the
  Ticket as the screen shows it. Neither asks for confirmation: another change
  reverses it (`docs/behaviors.md`, Confirmation). Their input is another
  choice than the one with which the dialog opened, and before discarding it
  the question says "The priority of SNTL-12 isn't changed." or "The severity
  of SNTL-21 isn't changed." (above), also once a read shows the Ticket with a
  CVE, after which Save, with another choice, shows `409
  TICKET_SEVERITY_DERIVED` (States). While the request is in progress, the
  choice is read-only (`docs/design-system.md`, Forms).
- Associate CVE… opens "Associate a CVE with SNTL-21". It says, in
  `fg-muted`, "SNTL-21 takes the severity, the CVSS assessments, the sources,
  and the affected versions of the CVE that you enter. Sentinel creates a CVE
  that it doesn't know yet, so check its ID.", since an unknown CVE becomes a
  record of its own (Sentinel `docs/features/tickets/tickets.md`, CVE
  Resolution Behavior); then CVE ID, a single-line field, described "Such as
  CVE-2099-1234.", which takes the focus as the dialog opens; then Cancel and
  Associate CVE, a primary button.
- The form takes the CVE ID without its surrounding whitespace, with `CVE-` in
  any letter case, which it sends in capitals, and checks it before sending it,
  as the pinned OpenAPI document publishes it (Sentinel `docs/api-spec.md`,
  Published Input Constraints): empty, "Enter the CVE ID."; more than 20
  characters, "Enter at most 20 characters."; and another form than `CVE-`,
  four digits, `-`, and at least four digits, "Enter a CVE ID, such as
  CVE-2099-1234." (above).
- No operation removes a CVE from a Ticket, so Associate CVE… asks for
  confirmation once the form passes its checks (`docs/behaviors.md`,
  Confirmation): "Associate CVE-2099-1234 with SNTL-21?", "SNTL-21 takes its
  severity from the CVSS assessments of CVE-2099-1234, in place of the severity
  High set by hand, and Sentinel fetches the CVE from its sources.", without
  the severity set by hand when the Ticket has none; then, for an Analyzed
  Ticket, "SNTL-21 can also return to Analysis until CVE-2099-1234 has a SUSE
  assessment.", or, for a Resolved Ticket, whose fixed tracks then wait for the
  release of their Products, "SNTL-21 can also return to Analysis until
  CVE-2099-1234 has a SUSE assessment, and to Analyzed until its eligible
  Products are released." (Sentinel `docs/features/tickets/tickets.md`,
  Associating a CVE Later; Gate: Analysis → Analyzed; Gate: Analyzed →
  Resolved); and "No action removes a CVE from a Ticket, so this can't be
  undone."; Cancel and Associate CVE, a danger button, which sends the CVE ID.
  The consequences follow the Ticket as the screen shows it. Cancel and Escape
  return to the form, and a navigation of the UI asks "Discard changes?" over
  the confirmation, whose Keep editing returns to it. Its input is a text
  typed, other than whitespace, and before discarding it the question says "No
  CVE is associated with SNTL-21." (above). Once a read shows the Ticket with a
  CVE, as after another user's association or the user's own that Sentinel did
  not confirm, the text no longer holds input, since the question would state
  what is no longer true: Cancel, Escape, and a navigation close the dialog
  without the question, and Associate CVE, through the confirmation, shows `400
  TICKET_CVE_ALREADY_SET` (States). While the request is in progress, the field
  keeps the CVE ID, read-only.
- An effective change can assign an unassigned Ticket to the user, move it
  from New to Analysis, and change its status; a change of the severity
  also changes its deadlines and its automatic priority, and an association
  replaces the severity set by hand with the one of the CVE, changes the
  eligibility of the Products, and starts a fetch of the CVE (Sentinel
  `docs/features/tickets/ticket-priority.md`, `set_priority_override()`;
  Sentinel `docs/features/tickets/ticket-mutations.md`,
  `set_severity_manual()`; Sentinel `docs/features/tickets/ticket-service.md`,
  `associate_cve`). None changes the duplicates. The screen then reads again
  the Ticket, the work of a maintainer on it, the users who acted on it, its
  audit log, and the reads of the Ticket list; once the Ticket shows its CVE,
  the parts that the CVE brings, the CVSS assessments, the sources, and the
  affected versions, read theirs (Content).
- The outcome is announced once the read of the Ticket after it arrives
  (above), as Sentinel returns the Ticket: "Priority overridden: P2.",
  "Priority override cleared: P3, automatic.", or "Priority override
  cleared: not yet prioritizable."; "Severity set to High." or "Severity
  removed."; and "CVE-2099-1234 associated.". After an association, Set
  severity… and Associate CVE… leave Actions, which holds the focus as its
  dialog closes.

**Make confidential…** and **Make non-confidential…**, Set Confidentiality,
`PATCH /api/v1/tickets/{ticket_id}/confidentiality`, in Actions, for a user
who holds `manage_confidentiality` (Sentinel
`docs/features/tickets/tickets.md`, Confidential Tickets; Set
Confidentiality; Sentinel `docs/features/identity/rbac.md`, Scope and
Confidential Ticket Visibility):

- Actions offers Make confidential…, with `lock`, on a Ticket that is not
  confidential, and Make non-confidential…, with `lock-open`, on a
  confidential one, in every status (above). Each opens its confirmation
  once its menu has closed, as Ignore… opens its dialog; it belongs to the
  heading row, so a navigation between the tabs of the Ticket leaves it open,
  and it sends the confidentiality that its item offered, also once a read
  shows the Ticket changed.
- Both ask for confirmation (`docs/behaviors.md`, Confirmation): making a
  Ticket confidential ends the access of the users who see it without scope
  `all`, other than the maintainers of its packages, and making it
  non-confidential discloses it to every user, which cannot be undone. The
  consequences follow the Ticket as the screen shows it:
  - "Make SNTL-12 confidential?", "Only the users who see every Ticket and
    the maintainers of its packages that are not excluded keep seeing
    SNTL-12. Every other user loses access to it.", since a Ticket that is
    not confidential has no access grants; then, for a Ticket in New,
    Analysis, or Analyzed with an assignee, whom Sentinel unassigns when they
    cannot be the assignee of a confidential Ticket: "If Bob Wilson, the
    assignee, can't be the assignee of a confidential Ticket, SNTL-12 becomes
    unassigned.", since the screen reads the assignment eligibility of no
    other user, or, for the signed-in user as the assignee, whose assignment
    eligibility the screen has, "You can't be the assignee of a confidential
    Ticket, so SNTL-12 becomes unassigned." unless it is `all`; Cancel and
    Make confidential, a danger button;
  - "Make SNTL-18 non-confidential?", "Every user can then see SNTL-18.
    Making it confidential again doesn't undo that disclosure.", "Its access
    grants are deleted, and making it confidential again doesn't restore
    them.", and, for a Ticket with a Coordinated Release Date, which Sentinel
    keeps, "Its Coordinated Release Date stays, and still decides its
    deadlines.", or "Its Coordinated Release Date stays." for a Ticket
    without deadlines, as an Ignored or Duplicated one, or one of severity
    None (Sentinel `docs/features/tickets/ticket-deadlines.md`, Null Due
    Dates); Cancel and Make non-confidential, a danger button.
- Once Sentinel confirms the change, the confirmation closes and the focus
  returns to Actions, which offers the other item. A change of the
  confidentiality can unassign the Ticket and deletes the access grants of a
  Ticket made non-confidential, so the screen then reads again the Ticket,
  the work of a maintainer on it, the users who acted on it, its audit log,
  and the reads of the Ticket list, the Embargo view and its count included.
  It reads the access grants again only once it shows the Ticket
  confidential, since Sentinel refuses the read of the grants of a Ticket
  that is not confidential (Sentinel `docs/features/tickets/tickets.md`,
  List Access Grants).
- The outcome is announced once the read of the Ticket after it arrives
  (above), as Sentinel returns the Ticket: "Made confidential.", "Made
  confidential, unassigned." when Sentinel cleared the assignee that the
  screen showed, or "Made non-confidential.".

**Edit assignee**, Assign Ticket, `PATCH /api/v1/tickets/{ticket_id}/assignee`,
in the details, for a user who holds `triage_ticket` (Sentinel
`docs/features/tickets/tickets.md`, Assign Ticket; Reassignment;
Self-Unassignment):

- The pencil of the assignee (`docs/design-system.md`, Detail Screens), named
  "Edit assignee", which its tooltip shows, on the statuses that accept a
  change (above). While its popover is open or its
  assignment is in progress, it stays as it was when the popover opened, also
  when a read of the signed-in user takes `triage_ticket` away
  (`docs/behaviors.md`, The Signed-in User).
- It opens a popover below it, named "Assignee", whose search field, "Search
  users", takes the focus. Below the field, the users who can be the assignee
  of the Ticket, from List Users, `GET /api/v1/users`, with
  `assignment_eligibility=all` for a confidential Ticket, and with
  `assignment_eligibility=all&assignment_eligibility=non_confidential` for
  every other Ticket (`docs/screen-map.md`, Roles, Principles; Sentinel
  `docs/features/identity/user-management.md`, List Users), as a combobox of
  users that lists its users at once (`docs/design-system.md`, Forms): the
  first 20 by username without a term, and those that match from 2 characters.
  The signed-in user comes first, with the label You, at once (States), apart
  from the other users by a `border` line, when their assignment eligibility
  as the popover opens admits the Ticket: `all` for a confidential Ticket,
  `all` or `non_confidential` for every other Ticket; a value that the pinned
  contract does not list admits none. The assignee is chosen, with `check`. The
  popover reads its users each time it opens, and for each term, and not when
  the tab returns to the foreground (`docs/behaviors.md`, Loading).
- For a signed-in user who is the assignee, "Unassign yourself" comes first
  while no term is typed, before the signed-in user, in the group that the line
  sets apart from the other users: it returns the Ticket to the queue of the
  unassigned Tickets, and no user unassigns another (Sentinel
  `docs/features/tickets/tickets.md`, Self-Unassignment).
- Choosing a user who is not the assignee, with the pointer, or with the arrow
  keys and Enter, assigns the Ticket at once, and Unassign yourself sends
  `null`; no assignment asks for confirmation, also one that replaces another
  user (`docs/behaviors.md`, Confirmation). Typing makes no user current, so
  that Enter chooses only a user that the arrow keys made current. Choosing the
  assignee, which is already chosen, does nothing. The request sends the `id`
  of the user as `user_id`, and, as `expected_assignee_id`, the `id` of the
  assignee that the screen shows, or `null` for a Ticket that it shows
  unassigned (Sentinel `docs/features/tickets/tickets.md`, Reassignment,
  Expected assignee).
- While the assignment is in progress, the choice is busy and the other
  choices are unavailable (`docs/design-system.md`, Menus, Popovers, and
  Tooltips), the popover says "Changing the assignee." in its status region
  and cannot be closed, and Edit assignee is busy (`docs/behaviors.md`,
  Loading). Once Sentinel confirms it, the popover closes, the focus returns
  to Edit assignee, and once the read of the Ticket after it arrives, the
  screen announces it, naming the assignee that Sentinel returns: "Assigned
  to Bob Wilson.", "Assigned to you.", or "You're no longer the assignee."
  (above).
- An assignment can move a New Ticket to Analysis and change its status
  (Sentinel `docs/features/tickets/tickets.md`, Status Transitions; Automatic
  Status Evaluation). The screen then reads again the Ticket, the work of a
  maintainer on it, the users who acted on it, its audit log, and the reads
  of the Ticket list.
- When a change of layout closes the popover while the assignment is in
  progress, its failure shows in the message area in the presentation of its
  status (`docs/behaviors.md`, Default Presentation by Status), and its success
  is announced as above (`docs/design-system.md`, Detail Screens).

**Edit Coordinated Release Date**, Set Coordinated Release Date,
`PATCH /api/v1/tickets/{ticket_id}/coordinated-release-date`, in the details,
for a user who holds `manage_confidentiality`, in every status (above;
Sentinel `docs/features/tickets/tickets.md`, Coordinated Release Date; Set
Coordinated Release Date; Sentinel `docs/features/tickets/ticket-deadlines.md`,
Coordinated Release Window):

- The pencil of the Coordinated Release Date (`docs/design-system.md`, Detail
  Screens), named "Edit Coordinated Release Date", which its tooltip shows,
  while the field shows: on a confidential Ticket, and on a Ticket with a
  Coordinated Release Date, also once it is no longer confidential, since
  Sentinel changes and removes the date there. While its dialog is open, it
  stays, also when a read of the signed-in user takes
  `manage_confidentiality` away (`docs/behaviors.md`, The Signed-in User).
- It opens a dialog at most 560 px wide (`docs/design-system.md`, Dialogs),
  titled such as "Edit the Coordinated Release Date of SNTL-18". It says, in
  `fg-muted`, on a confidential Ticket, "The date and time agreed with the
  other parties at which the embargo of SNTL-18 ends. Its deadlines divide
  the time from its creation to it, and follow the SLA without it.", or, on
  a Ticket that is no longer confidential, "SNTL-18 is no longer
  confidential, but its Coordinated Release Date still decides its
  deadlines: they divide the time from its creation to it, and follow the
  SLA without it. Once removed, it can't be set again.", or, once a read
  shows it no longer confidential and without a date, as after another
  user's changes, "SNTL-18 is no longer confidential and has no Coordinated
  Release Date, so it can't receive one.". On a Ticket without deadlines,
  as an Ignored or Duplicated one, or one of severity None, which has none
  with or without a date (Sentinel
  `docs/features/tickets/ticket-deadlines.md`, Null Due Dates), the texts
  say nothing of the deadlines: the first ends after "… ends.", and the
  second is "SNTL-18 is no longer confidential. Once its Coordinated Release
  Date is removed, it can't be set again.". The texts, Remove date, and its
  confirmation follow the Ticket as the screen shows it; a confirmation of
  Remove date that is open stays, and its removal then gets the `409` of a
  Ticket that can no longer have a date (States). Then Coordinated
  Release Date, in a form (`docs/design-system.md`, Forms), a date and time
  field whose first part takes the focus as the dialog opens, with the date
  of the Ticket to the minute, or empty without one, and whose description
  names the time zone of the browser and the same instant in UTC
  (`docs/behaviors.md`, Dates and Times, Input), followed by " It has already
  passed." for an instant before the dialog opened, which Sentinel accepts,
  so that a mistyped year shows. Its calendar enables the days from that of
  the creation of the Ticket to 30 Dec 9999. Then, while the Ticket had a
  date as the dialog opened and can still have one, Remove date, a secondary
  button at the start of the buttons (`docs/design-system.md`, Dialogs);
  Cancel; and Save, a primary button.
- Save checks the field before sending it: with only some of its parts, or
  emptied, "Enter the day, the month, the year, and the time."; an instant
  before the creation of the Ticket, which Sentinel refuses, taken to the
  next whole minute, or a day after 30 Dec 9999, so that every time of the
  day is an instant that Sentinel accepts in every time zone, "Enter a date
  and time from 3 Nov 2026, 09:13 to 30 Dec 9999, 23:59." (above). It sends
  the instant in UTC as `coordinated_release_at`. A date and time unchanged,
  or a field left empty on a Ticket without a date, closes the dialog
  without a request (above).
- Remove date sends `null`. On a confidential Ticket, it asks for no
  confirmation: Save sets the date again (`docs/behaviors.md`,
  Confirmation). On a Ticket that is no longer confidential, which cannot
  receive a date again, it asks "Remove the Coordinated Release Date of
  SNTL-18?", "SNTL-18 is no longer confidential, so it can't receive a
  Coordinated Release Date again, and its deadlines then follow the SLA.
  This can't be undone.", without ", and its deadlines then follow the SLA"
  on a Ticket without deadlines, Cancel, and Remove date, a danger button.
- Save asks for no confirmation: another change reverses it. Its input is a
  field whose parts differ from those with which the dialog opened, also
  while only some of them are typed, and before discarding it the question
  says "The Coordinated Release Date of SNTL-18 isn't changed." (above). While the request is in progress, the field is
  read-only and keeps its focus.
- A change moves the deadlines of the Ticket, and a removal returns them to
  the SLA window; neither assigns the Ticket nor changes its status
  (Sentinel `docs/features/tickets/tickets.md`, Set Coordinated Release
  Date). Once Sentinel confirms the change, the dialog closes and the focus
  returns to the pencil, or moves to the screen's heading when the read
  after it no longer shows the field, as after the removal of the date of a
  Ticket that is no longer confidential (`docs/behaviors.md`,
  Accessibility, Focus after an action). The screen then reads again the
  Ticket, the work of a maintainer on it, the users who acted on it, its
  audit log, and the reads of the Ticket list.
- The outcome is announced once the read of the Ticket after it arrives
  (above), as Sentinel returns the Ticket: "Coordinated Release Date set to
  25 Nov 2026, 14:00." or "Coordinated Release Date removed.".

**Refetch**, Re-fetch CVE Data, `POST /api/v1/cves/{cve_id}/refetch`, for a
user who holds `triage_ticket` (Sentinel
`docs/features/tickets/cve-tracking.md`, Re-fetch CVE Data):

- Refetch of a source, in the place of the mark of its status
  (`docs/design-system.md`, Other Values), named after the source, such as
  "Refetch NVD", sends the request with `source`. It is offered for a source that is registered,
  refetchable, and enabled, whose status is not Pending nor one that the
  pinned contract does not list (`docs/behaviors.md`, Unknown Values): not
  for CISA KEV, which cannot fetch one CVE, nor for a disabled or retired
  source. A read that shows its source Pending removes it, also while its
  request is in progress, whose message still shows. Where the primary
  pointer does not hover, such as on a touch screen, Refetch all refetches
  the sources.
- A press of the pointer on Refetch of a source leaves the focus where it
  was. When a new read removes Refetch of a source while it has the focus, as when its source
  turns Pending after a press of the keyboard, the focus moves to the
  screen's heading (`docs/behaviors.md`, Accessibility, Focus after an
  action); otherwise the focus stays where it is, also after an assistive
  technology pressed it without moving the focus.
- Refetch all, a quiet button with `refresh-cw` at the end of the heading of
  the section (`docs/design-system.md`, Buttons and Links), sends
  the request without `source`, for every source that can be refetched,
  which Sentinel skips while its fetch is pending (Sentinel
  `docs/features/tickets/cve-service.md`, Database-Free Publication). It
  shows while a source is registered, refetchable, and enabled.
- Neither asks for confirmation (`docs/behaviors.md`, Confirmation). Each is
  busy while its request is in progress (`docs/behaviors.md`, Loading).
- Sentinel accepts the refetch with `202`, and one message says that it
  started (`docs/behaviors.md`, Outcome of a Change): "Refetch of NVD
  started." or "Refetch started.", or, when Sentinel returns no source as
  newly enqueued, "Refetch of NVD was already in progress." or "Refetch was
  already in progress."; followed by the sources that it skipped, such as
  "OSV is disabled and was skipped." or "GHSA and OSV are disabled and were
  skipped."; and by the sources whose fetch Sentinel did not confirm, such
  as "Sentinel didn't confirm the refetch of MITRE: it may still start."
  (Sentinel `docs/features/tickets/cve-service.md`, `FetchDispatchResult`).
  The message is in the `warning` tone when it names such a source, and in
  the `info` tone otherwise; after the user left the screen, it starts with
  the Ticket (above), such as "SNTL-42: Refetch of NVD started.".
- The screen then reads its data again, the sources included.

**Add SUSE assessment** and **Edit**, Set or Update SUSE CVSS Assessment,
`POST /api/v1/cves/{cve_id}/cvss/suse`, and **Delete**, Delete SUSE CVSS
Assessment, `DELETE /api/v1/cves/{cve_id}/cvss/suse/{cvss_version}`, in the
part CVSS assessments, for a user who holds `manage_cvss` (Sentinel
`docs/features/tickets/cvss-scoring.md`, Set or Update SUSE CVSS Assessment;
Delete SUSE CVSS Assessment):

- The screen changes the SUSE assessments of v3.1 and v4.0, the versions that
  can be the default CVSS version (same document, Core Distinctions). Sentinel
  accepts one of every version that it lists, and the screen shows one of
  another version without actions. It offers them on the statuses that
  accept a change (above; Sentinel `docs/features/tickets/ticket-mutations.md`,
  CVSS Status Matrix).
- Add SUSE assessment, a secondary button 32 px high with `plus` at the end of
  the line of the heading of the part, shows once the read of the assessments
  has arrived, until SUSE has assessments of both v3.1 and v4.0. Edit and
  Delete are icon buttons with `pencil` and `trash` at the end of the row of a
  SUSE assessment of these versions (`docs/design-system.md`, Tables), whose
  tooltips say "Edit" and "Delete", named such as "Edit SUSE assessment v3.1".
  Before them, the cell of the vector has 24 px of end padding rather than
  10 px, so that the cell, which the table makes a tab stop once its button has
  had the focus, keeps 24 px of its own beside the button.
- Add SUSE assessment and Edit open a dialog at most 880 px wide whose form
  holds two columns (`docs/design-system.md`, Dialogs; Forms), titled "Add
  SUSE assessment" or "Edit SUSE assessment v3.1":
  - Add starts with tabs of the versions, CVSS v3.1 and CVSS v4.0
    (`docs/design-system.md`, Dialogs). The default CVSS version,
    `default_cvss_version`, is marked with `star`, whose tooltip says "The
    default CVSS version: its SUSE assessment also sets the eligibility
    score of the Products." (Sentinel `docs/features/tickets/cvss-scoring.md`,
    Eligibility Score Resolution), and which assistive technologies read as
    "CVSS v3.1, the default version"; a default version that the pinned
    contract does not list marks no tab. Add opens on the default version
    when SUSE has no assessment of it, otherwise on the first version that
    SUSE lacks. The tab of a version of which SUSE has an assessment says
    "SUSE already has a CVSS v3.1 assessment: Edit in its row of the table
    changes it." in place of the form, and Add SUSE assessment is disabled
    there. Edit has no tabs: its version is in its title.
  - Start from, optional, a select of the assessments of the other
    providers of the version, each its provider, its score, and its severity
    with its mark, such as "NVD, 7.5 ● High", and in Edit, before them, the
    saved assessment, "SUSE, as saved, 5.5 ● Medium". It shows the
    assessment whose vector the form holds, or nothing: empty as Add opens,
    on the saved assessment as Edit opens, and empty once the vector differs
    from every assessment that it offers; of two assessments with the same
    vector, it shows the first. Choosing one takes its vector.
    Without an assessment to offer, it does not show.
  - The Base metrics of the version, in the groups of FIRST's specifications
    as the popover of a vector shows them (Content, CVSS assessments):
    Exploitability in the first column, and Scope and Impact for v3.1, or
    Vulnerable system and Subsequent system for v4.0, in the second; one
    column where the dialog is narrower. Each metric is a segmented control
    (`docs/design-system.md`, Forms) with its values from the one that
    lowers the Base score to the one that raises it, in both versions, such
    as "Physical, Local, Adjacent, Network" for Attack vector and "None, Low,
    High" for Confidentiality, named by the metric, and by its group too
    where its name repeats in the version, such as "Confidentiality
    Vulnerable system".
    Below a metric whose choice differs from the assessments of other
    providers of the version shows their values, in the order of the API,
    such as "NVD: Network · GitHub: Local", which wraps within its column.
  - Beside Start from, at the top of the second column and ending where its
    widest control ends, or after Start from in one column, the Base score
    of the vector as Sentinel calculates it, Calculate CVSS Base Score,
    `GET /api/v1/cvss/base-score` (Sentinel
    `docs/features/tickets/cvss-scoring.md`, Calculate CVSS Base Score),
    without a label: the score in `text-40`, as the calculator of FIRST shows
    it, and below it the severity of the assessment with its mark in
    `text-20`, both at weight 600 (`docs/design-system.md`, Type Scale;
    Severity). Assistive technologies read it as "Base score 9.2, Critical".
    The form reads the score of the vector as the dialog or a tab of Add
    opens, and after a change once the vector has paused for 250 ms, only
    for a vector that passes the checks of the form below and chooses every
    metric. Another vector, and one that Sentinel rejects, shows "0.0" and
    "None" in `fg-muted`, which assistive technologies read as the reason:
    "No score." followed by the message of the check, such as "No score.
    Choose the metrics, or enter the vector.", by "Choose every metric.", or
    by "Sentinel doesn't accept this vector.". While the score of a new
    vector is read, the outcome of the vector before it stays, marked as
    being updated (`docs/behaviors.md`, Loading), and a read that a newer
    vector overtakes shows nothing; the score of a vector, and the rejection
    of a vector, are read once (`docs/behaviors.md`, Loading). Its place is a
    status region, which announces each new outcome without moving the
    focus, once the vector has paused (`docs/behaviors.md`, Accessibility,
    Announcements). It does not show for a tab of a version of which SUSE
    has an assessment.
  - Vector, a single-line field in monospace, described "The metrics write
    it, and a vector entered here chooses them.": a choice of a metric writes
    the vector of the metrics chosen, in FIRST's order, and a vector that the
    user enters chooses the metrics that it names.
  - Then Cancel and the action, a primary button: "Add SUSE assessment", or
    "Save" in Edit.
- The form checks the vector without its surrounding whitespace before sending
  it, and sends it without that whitespace (Sentinel
  `docs/features/tickets/cvss-scoring.md`, Input Rules): empty, "Choose the
  metrics, or enter the vector."; more than 200 characters, "Enter at most 200
  characters."; a vector without the prefix of its version, "Enter a CVSS v3.1
  vector, which starts with CVSS:3.1/.", or in Add, for a version of which SUSE
  has an assessment, "SUSE already has a CVSS v4.0 assessment: edit it in its
  row." (above). Every other rule of the vector is Sentinel's: a vector that
  the read of its score rejects shows the error of `422 CVSS_INVALID_VECTOR`
  (States) at the field at once, without moving the focus, until the input
  changes, and the form still sends it.
- Sentinel sets or replaces the SUSE assessment of the version of the vector
  that it receives (same document, Set or Update SUSE CVSS Assessment), so Add
  reads the assessments again as it submits, and when SUSE has one of the
  version by then, sends nothing: the tab then says so in place of its form,
  and that line takes the focus. Two users who add the same version at the same
  instant can still replace one another. Edit sends only a vector of its
  version.
- Add SUSE assessment and Edit ask for no confirmation. Before discarding
  input, the question says "The SUSE assessment that you entered isn't
  added." in Add or "Your changes to this SUSE assessment aren't saved." in
  Edit (above). After Add, when the other tab holds input and SUSE lacks
  its version by the read before Add, the dialog stays open on that tab
  instead (`docs/design-system.md`, Dialogs): "SUSE assessment v3.1 added."
  shows above the tabs as a `success` message, which is announced, the tab
  of the version added drops its input and says that SUSE has it once the
  read after the change arrives, and the action of the dialog, Add SUSE
  assessment, holds the focus, also after Enter in Vector, whose form leaves
  with its tab.
- Delete asks for confirmation, since it cannot be undone in the UI and
  Sentinel calculates the severity and the eligibility again
  (`docs/behaviors.md`, Confirmation): "Delete SUSE assessment v3.1?",
  "Sentinel calculates the severity of the CVE again from the other
  assessments, and the eligibility of the Products, which can change the
  priority and the deadlines of the Ticket. This can't be undone.", with,
  before the last sentence, "Without a SUSE CVSS v3.1 assessment, the
  eligibility score of the Products is the fallback 10.0." for the assessment
  of the default CVSS version (Sentinel
  `docs/features/tickets/cvss-scoring.md`, Eligibility Score Resolution), and
  "As the last SUSE assessment of the CVE, it also returns the Ticket to
  Analysis." for the last SUSE assessment of the CVE of an Analyzed or
  Resolved Ticket (Sentinel `docs/features/tickets/tickets.md`, Gate: Analysis
  → Analyzed; Automatic Status Evaluation); Cancel, and Delete SUSE
  assessment, a danger button.
- An effective change can assign an unassigned Ticket to the user, move it
  from New to Analysis, and change its severity, its priority, its
  deadlines, the eligibility of its Products, and its status (Sentinel
  `docs/features/tickets/cvss-scoring.md`, Assessment Persistence and Ticket
  Status). The screen then reads again the Ticket, its duplicates, the work
  of a maintainer on it, the CVSS assessments, the users who acted on it,
  its access grants, its audit log, and the reads of the Ticket list.
- The outcome of each, except an Add after which the dialog stays open, is
  announced once a read of the assessments after it arrives (above): "SUSE
  assessment v3.1 added.", "SUSE assessment v3.1 changed.", or "SUSE
  assessment v3.1 deleted.".
- After Delete, once the read of the assessments after it no longer returns
  the assessment, the focus moves to the Delete of the row that takes its
  place, or to that row when it has no Delete, or to Add SUSE assessment
  when no row follows. After Add, when the read of the assessments after it
  shows the new assessment and no longer Add SUSE assessment, as SUSE then
  has both versions, the focus moves from Add SUSE assessment to the Delete
  of the new row, which reverses the change. When a read removes the row
  whose control holds the focus, or Add SUSE assessment while it holds the
  focus without a change, the focus moves to the screen's heading
  (`docs/behaviors.md`, Accessibility, Focus after an action). Neither the
  move after Delete nor the one when a read removes a row takes place once
  the user has moved the focus out of the table meanwhile (above).

**Exclude** and **Restore** of a package, Soft-Delete Package from Ticket,
`POST /api/v1/tickets/{ticket_id}/packages/{package_id}/exclude`, and Restore
Package, `POST .../packages/{package_id}/restore`; of a track, Soft-Delete
Track, `POST .../packages/{package_id}/tracks/{track_id}/exclude`, and Restore
Track, `POST .../tracks/{track_id}/restore`; of a Product, Soft-Delete
Product, `POST .../tracks/{track_id}/products/{ticket_package_product_id}/exclude`,
and Restore Product, `POST .../products/{ticket_package_product_id}/restore`;
the **affectedness** of a track, Change Track Status,
`PATCH .../packages/{package_id}/tracks/{track_id}`; and the **eligibility**
of a Product, Override Product Eligibility,
`PATCH .../products/{ticket_package_product_id}`, in the package tree
(Sentinel `docs/features/packages/package-model.md`, Axis 2: Eligibility;
Status Behavior (User-Attributed Status Change; Authorized-User Overrides
Product Eligibility; Manual Transitions); Exclusion and Actionability;
Package Eligibility (Override Model); API Endpoints):

- The screen offers them on the statuses that accept a change (above).
- For a user who holds `manage_packages`, each package and each track has
  the menu of its actions (`docs/design-system.md`, Menus, Popovers, and
  Tooltips), named such as "Actions of fictional-openssl" or "Actions of
  fictional-openssl, SUSE:FLES-15-SP7:Update", with Exclude, with `ban`, or,
  for a record that its own marker excludes, Restore, with `undo-2`. Sentinel
  accepts Exclude also below an excluded record, which records its own
  marker (same document, Manual Exclusion Markers).
- For a user who held `manage_packages` as the popover of a Product
  opened, on a Ticket whose status accepted them then (`docs/behaviors.md`,
  The Signed-in User), the popover ends with the actions of the Product, a
  menu named "Actions" below a `border` line (`docs/design-system.md`,
  Menus, Popovers, and Tooltips): Mark as eligible, for a Product that is
  not eligible, or Mark as not eligible, for one that is, each with
  `user-pen`, which sets its eligibility by hand and sends `true` or `false`
  as `eligible`; Return to automatic eligibility, with `rotate-ccw`, while
  its eligibility is set by hand, which sends `null`, after which Sentinel
  calculates it again (same document, Reset behavior); and Exclude from this
  track, with `ban`, or, for a Product that its own marker excludes,
  Restore, with `undo-2`. A hidden Product, excluded or EOL, or below a
  hidden track or package, offers them too, as Sentinel accepts them there
  (same document, Soft-Delete Product; Restore Product; Override Product
  Eligibility). The screen offers no action that sets by hand the
  eligibility that the Product has.
- The affectedness of a track is a select (`docs/design-system.md`, Forms),
  named such as "Affectedness of fictional-openssl, SUSE:FLES-15-SP7:Update:
  Affected", for a user who can set a value other than the current one,
  which it offers with the current one, in the order of the contract,
  Analysis, Affected, Not affected, Fixed, and Won't fix: Fixed with
  `admin_ticket_ops`, or with `manage_packages` on a Ticket without a CVE,
  and the others with `manage_packages` (same document, Manual Transitions;
  `docs/screen-map.md`, Roles, Principles). So a user who holds
  `admin_ticket_ops` alone sees the select with Fixed, and no menu of
  actions, and a Fixed track shows them its affectedness as text. An
  affectedness that the pinned contract does not list shows as received,
  without a select. The request sends the value chosen as `status`.
- The items of the menu of a package or a track and of the popover of a
  Product follow the record as the screen shows it, except while the change
  of one of them is in progress, which keeps its menu as it started; the
  select keeps the values that the user could set as it opened, and its
  current value, which it also offers, follows the track as the screen
  shows it. When a read turns Exclude, Exclude…, or Exclude from this track
  into Restore, or one Mark into the other, the item keeps the focus; when
  it removes the item or the value that holds the focus, such as Return to
  automatic eligibility after another user did it, or Fixed for a user who
  cannot set it, after another user changed the track from Fixed to another
  value, the menu, the one stop of the Tab key of its items, takes the focus
  in its place, with the focus ring inside it (`docs/behaviors.md`,
  Accessibility, Focus after an action; `docs/design-system.md`, Focus and
  Motion).
- None asks for confirmation, except the exclusion of a package with
  maintainers of a confidential Ticket, which ends their access to it unless
  another path gives it to them (`docs/behaviors.md`, Confirmation; Sentinel
  `docs/features/packages/package-maintainership.md`, Confidential Ticket
  Visibility): its item is "Exclude…", and it asks "Exclude
  fictional-openssh?", "The maintainers of fictional-openssh no longer see
  this confidential Ticket, unless their roles, an access grant, or another
  package that they maintain let them. Restore gives them this access
  back.", with Cancel and Exclude package, a danger button. A change of the
  affectedness asks for none, also one that the user cannot reverse, such as
  Fixed for a user who holds `admin_ticket_ops` alone, since another user
  can (`docs/behaviors.md`, Confirmation). Neither do the actions of a Product:
  its exclusion ends no access, since maintainership concerns the package
  (Sentinel `docs/features/packages/package-maintainership.md`, Confidential
  Ticket Visibility), and each can be undone in the UI, a return to
  automatic eligibility that kept the value with two changes, Mark as one
  value and then as the other.
- An item or a value chosen starts its change at once, as a menu does
  (`docs/design-system.md`, Menus, Popovers, and Tooltips; Forms;
  `docs/behaviors.md`, Loading; The Signed-in User): while it is busy,
  assistive technologies read with it, as its description, "Excluding.",
  "Restoring.", "Changing the affectedness.", "Marking as eligible.",
  "Marking as not eligible.", or "Returning to automatic eligibility.";
  meanwhile the other items of its menu are unavailable.
- An edit can assign an unassigned Ticket to the user, move it from New to
  Analysis, and change its status and its deadlines (Sentinel
  `docs/features/packages/package-model.md`, User-Attributed Status Change;
  Authorized-User Overrides Product Eligibility; Sentinel
  `docs/features/tickets/tickets.md`, Auto-Assignment on Unassigned
  Tickets; Automatic Status Evaluation). The screen then reads again the
  Ticket, the work of a maintainer on it, the users who acted on it, its
  audit log, and the reads of the Ticket list.
- The outcome is announced once the read of the Ticket after it arrives
  (above): "Package fictional-openssl excluded.",
  "Track fictional-openssl · SUSE:FLES-15-SP7:Update restored.", "Affectedness
  of fictional-openssl · SUSE:FLES-15-SP7:Update changed to Not affected.",
  with the affectedness that Sentinel returns, "Product Fictional Linux
  Enterprise Server 15 SP7 of fictional-openssl · SUSE:FLES-15-SP7:Update
  excluded.", or, with the eligibility that Sentinel returns, "Product …
  marked as not eligible." after a change by hand and "Product … returned to
  automatic eligibility, eligible." after Return to automatic eligibility.
  When Sentinel answers that the record is not actionable while "Show
  hidden" is off, as after an exclusion, the tree no longer shows it, so the
  outcome shows in the message area then instead (`docs/behaviors.md`,
  Outcome of a Change); Sentinel's answer decides, also when that read shows
  the record again, as after another user restored it meanwhile.
- After an exclusion that hides its record, once the read of the Ticket after
  it no longer shows the record, while the focus is still on its menu, on the
  name of its Product, or on the screen's heading, the focus moves: after an
  exclusion of a Product, to the name of the next Product of its track that
  shows, otherwise to the menu of the actions of its track; after an exclusion
  of a track, or of a Product whose track no longer shows, to the menu of the
  next track of its package that shows, otherwise to that of its package;
  after an exclusion of a package, or of a record whose package no longer
  shows, to the menu of the next package that shows, otherwise to "Show
  hidden", which leads to Restore (`docs/behaviors.md`, Accessibility, Focus
  after an action). A read that removes the record
  otherwise, such as a later read after one that failed, or one after an
  exclusion that failed because another user made it meanwhile, moves the
  focus to the screen's heading, as when any read removes the element with
  the focus (`docs/behaviors.md`, Accessibility, Focus after an action).
  While "Show hidden" is on, the record stays, in gray with its
  label, and the focus stays on its menu, or on the name of its Product. When
  a read removes a select or a menu of actions while it, or its open menu,
  holds the focus, as after Fixed for a user who can set no other value on the
  track, or after a read of the signed-in user took the capability away, the
  focus moves to the screen's heading once the menu has closed
  (`docs/behaviors.md`, Accessibility, Focus after an action).

**Add package**, Add Package to Ticket,
`POST /api/v1/tickets/{ticket_id}/packages`, in the package tree, for a user
who holds `manage_packages`, on a Ticket of the statuses that accept a
change (above), with the names of Search Maintained
Packages, `GET /api/v1/maintained-packages` (Sentinel
`docs/features/packages/package-model.md`, Adding Packages to a Ticket; Add
Package to Ticket; Sentinel
`docs/features/packages/maintained-package-names.md`, Purpose; Search
Maintained Packages):

- Add package, a secondary button 32 px high with `plus` (Content,
  Packages), opens a dialog at most 488 px wide whose content is a form alone
  (`docs/design-system.md`, Dialogs; Forms), titled "Add package", with one
  field, "Package name", which takes the focus as the dialog opens, described
  "The source package as SMELT names it, such as fictional-openssl. Type part
  of it to find it."; then Cancel and Add package, a primary button. When a
  read of the signed-in user takes `manage_packages` away while the dialog is
  open, the dialog stays open with its form (`docs/behaviors.md`, The
  Signed-in User), Add package goes, and the focus moves to the screen's
  heading as the dialog closes (`docs/behaviors.md`, Accessibility, Focus
  after an action).
- Package name is a combobox that searches the names of the source packages
  that SMELT maintains as the user types (`docs/design-system.md`, Forms):
  from 2 characters, the first 20 names that contain the term without regard
  to letter case, those that start with it first, as Sentinel orders them;
  "Sentinel knows no maintained package that matches." without one, and "The
  first 20 of 63 packages that match. Type more to narrow them." when more
  match. Choosing a name writes it in the field with its letter case, which
  Add Package to Ticket resolves in SMELT exactly. Typing makes no name
  current: while the menu is open, Enter chooses only a name that the arrow
  keys made current, and otherwise closes the menu, keeping the text; while
  it is closed, Enter submits the form. The names only help to find one:
  Sentinel reads them from a snapshot that it takes from SMELT once a day,
  and returns none before its first one, so the field takes a name that it
  does not suggest, and a failure of their read, which shows in the menu,
  leaves the addition possible.
- The form checks the name without its surrounding whitespace before sending it
  so, as the pinned OpenAPI document publishes it (Sentinel `docs/api-spec.md`,
  Published Input Constraints): empty, "Enter the package name."; more than 255
  characters, "Enter at most 255 characters."; and another character than
  letters, digits, ".", "_", "+", and "-", or a first character that is not a
  letter or a digit, "Enter only letters, digits, and . _ + -, starting with a
  letter or a digit.", so a name such as `libxml++` passes (above).
- Add package asks for no confirmation, also on a confidential Ticket, whose
  maintainers that it adds to the package then see the Ticket: it ends no
  one's access, and Exclude reverses it (`docs/behaviors.md`, Confirmation;
  Sentinel `docs/features/packages/package-maintainership.md`, Confidential
  Ticket Visibility). Its input is a name typed or chosen, other than
  whitespace, and before discarding it the question says "The package that
  you entered isn't added." (above). While the request is in progress, the
  field keeps the name sent, read-only, and its focus, so that an error at
  the field concerns the name that it shows.
- An addition creates the tracks and Products that Sentinel finds for the
  package in SMELT and that the package lacks, also on a package of the
  Ticket, and can add its maintainers; when it creates a track or a Product,
  it can assign an unassigned Ticket to the user and change its status and
  its deadlines, as an edit of the package tree does (above). The screen then
  reads again what an edit of the package tree affects (above).
- Its outcome shows in the message area once the read of the Ticket after it
  arrives, also when that read fails, since the tree does not show what
  Sentinel created (`docs/behaviors.md`, Outcome of a Change): "Package
  fictional-openssl: 3 tracks and 7 Products added.", "Package
  fictional-openssl: 2 Products added.", or, when Sentinel created none,
  "Package fictional-openssl already has every track and Product that
  Sentinel finds for it in SMELT, so none was added."; while "Show hidden" is
  off and that read shows the package hidden, followed by "Show hidden shows
  it, since none of its Products is actionable.". A failure after the user
  left the tab shows in the presentation of the dialog (States) after the
  package, such as "SNTL-20: Package fictional-openssl: SMELT doesn't
  maintain a package of this name. Check the name, whose letter case
  counts." (above).

**Grant access**, Grant Access, `POST /api/v1/tickets/{ticket_id}/access`,
and **Revoke access**, Revoke Access,
`DELETE /api/v1/tickets/{ticket_id}/access/{user}`, in the dialog of the
access grants of a confidential Ticket, for a user who holds
`manage_confidentiality` (Sentinel `docs/features/tickets/tickets.md`, Grant
Access; Revoke Access):

- Grant access is a form below the explanation of the dialog, above the
  grants (`docs/design-system.md`, Forms): the user field, "User", a combobox
  of users that List Users fills with the active users that match its term,
  `GET /api/v1/users` with `search` and `active=true`
  (`docs/design-system.md`, Forms; Sentinel
  `docs/features/identity/user-management.md`, List Users), in which a user
  who holds a grant shows the label "Granted" and is disabled; then Grant
  access, a primary button, which ends the line of the field
  (`docs/design-system.md`, Forms).
- Grant access sends the `id` of the user chosen; without one, it says "Choose
  a user." at the field and sends nothing; an error of the field goes as the
  user types in it or chooses a user. It asks for no confirmation: it
  ends no one's access (`docs/behaviors.md`, Confirmation). It is busy while
  its request is in progress, during which the dialog cannot be closed. Once
  Sentinel confirms it, also for a grant that existed already, the field
  empties, the focus stays where it was, on Grant access or in the field, and
  once a read of the grants after it arrives, the dialog announces it, such
  as "Access granted to Carol White.".
- The input of the dialog is a user chosen in the field and not yet
  granted, before whose discarding Close asks too, and the question says
  "The user that you chose isn't granted access." (above); a term typed
  without a choice is dropped without a question. While a grant or a
  revocation is in progress, the user chosen counts as submitted.
- Revoke access, a secondary button at the end of each grant, named after its
  user with the username, such as "Revoke access of Carol White @cwhite",
  asks for confirmation, since it ends another person's access
  (`docs/behaviors.md`, Confirmation): "Revoke access of Carol White?", "Carol
  White loses the access grant to this confidential Ticket, and no longer sees
  it unless their roles or the packages that they maintain let them.", Cancel,
  and Revoke access, a danger button. It sends the `id` of the user. Once
  Sentinel confirms it, the confirmation closes, and once a read of the
  grants after it arrives, the dialog announces it, such as "Access of Carol
  White revoked.".
- When the grant whose Revoke access has the focus leaves the list, after its
  Revoke access or because a read no longer returns it, the focus moves to
  the Revoke access of the grant that followed it, or to the user field when
  none follows, in the dialog that holds it (`docs/behaviors.md`,
  Accessibility, Focus after an action).
- The outcome of each is announced while the dialog is open
  (`docs/behaviors.md`, Accessibility, Announcements). When the read of the
  grants after it fails, the outcomes that this read releases show together
  at the top of the dialog instead, as a `success` message, which those of a
  later failed read replace, until the dialog closes. Once the dialog has
  closed, an outcome shows in the message area when its read arrives,
  whatever the outcome of that read, since nothing in the dialog announces
  it then (`docs/behaviors.md`, Outcome of a Change).
  The screen then reads again the Ticket, its access grants, the users who
  acted on it, and its audit log.

**Add reference**, Add Reference,
`POST /api/v1/tickets/{ticket_id}/references`; **Edit**, Update Reference,
`PATCH /api/v1/tickets/{ticket_id}/references/{reference_id}`; and
**Delete**, Delete Reference,
`DELETE /api/v1/tickets/{ticket_id}/references/{reference_id}`, in the tab
References, for a user who holds `manage_references` (Sentinel
`docs/features/tickets/ticket-references.md`, Add Reference; Update
Reference; Delete Reference), in every status of the Ticket (above; same
document, Manual-Zone Exception):

- Edit and Delete are offered only on a manual reference, since Sentinel
  refuses to change an automatic one with `409 RESOURCE_NOT_EDITABLE` (same
  document, Update Reference; Delete Reference): icon buttons with `pencil`
  and `trash` at the end of its row (`docs/design-system.md`, Tables), whose
  tooltips say "Edit" and "Delete", and whose names also name the reference,
  by its title in quotation marks, or without one by its address, such as
  "Edit reference “Fictional advisory”" or "Delete reference
  https://issues.example.test/tickets/12345".
- Add reference and Edit open a dialog at most 488 px wide, whose content is
  a form alone (`docs/design-system.md`, Dialogs; Forms), titled "Add
  reference" or "Edit reference", with these fields, the first of which
  takes the focus as the dialog opens:
  - Address, a single-line field for a web address, required; in Edit, the
    address of the reference as the table shows it;
  - Title, optional;
  - Type, a select: in Add reference, "Detect from the address", chosen at
    first, which sends no `type`, so that Sentinel classifies the address,
    or leaves it uncategorized (same document, Type Auto-Classification);
    then Advisory, Patch, Issue, Article, and Uncategorized, which sends
    `null`. In Edit, the select starts at the type of the reference and
    offers no Detect from the address, since Sentinel does not classify a
    reference that it updates (same section); a type that the pinned
    contract does not list is an option of its own, as received, which keeps
    the type;
  - Description, optional, a multi-line field.

  Then Cancel and the action, a primary button: "Add reference", or "Save"
  in Edit.
- The form checks before sending what the contract declares of its fields
  (same document, API Schemas; `docs/behaviors.md`, Where Errors Appear): an
  Address that is empty or holds only whitespace says "Enter the address.";
  an address of more than 2,048 characters, a title of more than 500, and a
  description of more than 2,000 say "Enter at most 2,048 characters." with
  their limit; and an address that is not a web address
  (`docs/behaviors.md`, Links to Other Sites) says "Enter a web address that
  starts with https:// or http://.". Sentinel then checks and normalizes the
  address itself (same document, URL Normalization).
- A check shows at its field when the user submits the form, and when the
  user leaves a field after changing it. The error of a field, that of a
  check or one that Sentinel returns (States), goes once the user leaves
  the field after changing it, or, at Type, chooses another type; a check
  that the new value fails shows in its place.
- Add reference sends the address without its surrounding whitespace, the title
  and the description as typed, or `null` when they are empty or hold only
  whitespace, which Sentinel does not accept (Sentinel
  `docs/features/tickets/ticket-references.md`, URL Normalization), and the
  type as chosen. Edit sends only the fields that the user changed, in the same
  way: the address without its surrounding whitespace, and a title or a
  description that is empty or holds only whitespace as `null` (Sentinel
  `docs/api-spec.md`, Partial Update Semantics).
- Add reference and Edit ask for no confirmation. A navigation that asks
  before discarding input includes another filter of the tab, and the
  question says "The reference that you entered isn't added." in Add
  reference or "Your changes to this reference aren't saved." in Edit
  (above).
- Delete asks for confirmation, since it cannot be undone in the UI
  (`docs/behaviors.md`, Confirmation): "Delete reference “Fictional
  advisory”?", "The reference is removed from this Ticket. This can't be
  undone.", Cancel, and Delete reference, a danger button.
- The outcome of each is announced once a read of the references after it
  arrives (above), naming the reference, after Add reference and Edit as
  Sentinel returns it: "Reference “Fictional advisory” added.", "Reference
  “Fictional advisory” changed.", or "Reference “Fictional advisory”
  deleted.". When the reference that Sentinel returns after Add reference or
  Edit does not match the filters that apply, the table does not show it, so
  its outcome shows in the message area instead, once the same read has
  arrived, such as "Reference “Fictional advisory” added." (same section);
  the filters that apply as the change ends decide, also those that the user
  chose while it was in progress. The screen then reads again the
  references, the audit log, the users who acted on the Ticket, and the
  Ticket.
- After Delete, once the read of the references after it no longer returns
  the reference, the focus moves to the Delete of the row that takes its
  place, or to that row when it has no Delete, or to Add reference when no
  row follows (above). A row that a read moves, such as after an Edit that
  changes the type, which orders the rows, keeps the focus on its control;
  when a read removes the row while one of its controls holds the focus,
  such as a later read after Delete, or after an Edit that the filters no
  longer match, the focus moves to the screen's heading. Neither the move
  after Delete nor the one when a read removes a row takes place once the
  user has moved the focus out of the table meanwhile (above).

## States

- **Loading.** The heading row and the tabs show at once; the panel of Overview
  shows the loading indicator until the Ticket arrives, the value of Duplicates
  until its read arrives, and the part CVSS assessments and the section Sources
  of the CVE until theirs arrives (`docs/behaviors.md`, Loading). Until the
  read of the work of a maintainer arrives, no track is marked. The popover of
  the CNA shows its title at once; its short name and its details show once Get
  CNA arrives, with the loading indicator in place of the details until then.
  Phases and the popover of a delivery show their phases at once, and the
  loading indicator in place of each request until its read arrives. The
  participants show once List Ticket Actors and, for a confidential Ticket,
  List Access Grants have arrived, with the loading indicator in their place
  until then; Access grants shows at once on a confidential Ticket, and its
  dialog shows the loading indicator in place of the grants until they arrive.
  The dialog of Add SUSE assessment and Edit shows the loading indicator in the
  place of the score until the first outcome of its vector is known (Actions).
  The popover of the assignee shows its field, Unassign yourself, and the
  signed-in user at once, from the read of the signed-in user, and the loading
  indicator below them until its other users arrive, and again while the users
  of a new term are read, which the failure of their read replaces with the
  message of its status (`docs/design-system.md`, Forms).
- **Errors.** The default presentation applies (`docs/behaviors.md`, Errors). A
  failure of a change submitted from a form, a dialog, or the popover of a
  field shows in it, which keeps the input (`docs/behaviors.md`, Where Errors
  Appear): the codes that the entries below handle at a field, and a field
  error of a `VALIDATION_ERROR` for a member of the request, at their field,
  which takes the focus, or, in a group of radio buttons, its chosen option
  (`docs/design-system.md`, Forms); every other failure at the top of the form,
  which takes the focus, in the presentation of its status, as a warning when
  Sentinel did not confirm the change (`docs/behaviors.md`, Default
  Presentation by Status; Retries and Unconfirmed Changes), such as the `409
  TICKET_NOT_MUTABLE` of a Ticket that became Ignored or Duplicated meanwhile.
  The failure of the first read of Get Ticket replaces the screen, its heading
  row and tabs included; `404 TICKET_NOT_FOUND`, for a Ticket that does not
  exist or that the user cannot see, shows Not found (`docs/behaviors.md`,
  Missing and Inaccessible Records). A later read of the Ticket that fails,
  such as when the tab returns to the foreground, keeps the Ticket shown, with
  its warning at the top of the panel of the tab, unless it is a `403` or a
  `404`, which replaces the screen. The failure of the read of the duplicates
  shows in place of their value, that of the read of the CVSS assessments in
  place of the part (`docs/design-system.md`, Tables), and that of the read of
  the sources in place of the section, without Refetch all, each with Try again
  where the failure offers it, and leaves the rest of the screen usable. When
  the read of the work of a maintainer fails, a `warning` message above the
  package tree says "The tracks that wait for you couldn't be shown.", followed
  by the message of its status, with Try again where the failure offers it, and
  the package tree stays usable; once a read of it has succeeded, a later read
  that fails keeps its marks and says "The tracks that wait for you couldn't be
  updated.", followed by the message of its status, unless it is a `403` or a
  `404`, which removes them; while it is sent again, the marks that stay shown
  are marked as being updated (`docs/behaviors.md`, Where Errors Appear;
  Loading). When Get CNA fails, whatever its status, the popover of the CNA
  says "Other details aren't available." in place of its details, as a user
  card does (`docs/design-system.md`, Menus, Popovers, and Tooltips), and
  announces it, since the popover holds the focus (`docs/behaviors.md`,
  Accessibility, Announcements). When List Submission Requests or List Release
  Requests fails, whatever its status, the place of its request in Phases or in
  the popover of a delivery says, in `fg-muted`, "The submission requests
  aren't available." or "The release requests aren't available.", which the
  popover announces, for each read that fails, as for the details of a CNA
  (`docs/design-system.md`, Menus, Popovers, and Tooltips; Track Milestones;
  `docs/behaviors.md`, Accessibility, Announcements); in Phases, the line goes
  below the name of its phase where it does not fit beside it, as beside that
  of Submission. The phases and the other requests stay shown, and the next
  opening of the popover reads them again. The screen handles no error code of
  either specifically (Sentinel
  `docs/features/packages/ibs-submission-tracking.md`, Public API). The failure
  of List Ticket Actors or of List Access Grants shows in place of the
  participants, and that of List Access Grants also in place of the grants in
  their dialog, each with Try again where the failure offers it. The screen
  handles one code of List Access Grants specifically: `409
  TICKET_NOT_CONFIDENTIAL`, for a Ticket that became non-confidential since the
  screen read it, which then has no grants (Sentinel
  `docs/features/tickets/tickets.md`, List Access Grants; Set Confidentiality):
  the participants show without grants, and the screen reads the Ticket again,
  which removes Access grants, and turns an open dialog of the access grants to
  the line that says that the Ticket is no longer confidential (Participants).
- **Errors of Grant access and Revoke access.** A failure of Grant access shows
  in its form, which keeps the user chosen (`docs/behaviors.md`, Where Errors
  Appear): the screen handles two codes specifically, at the user field, `404
  USER_NOT_FOUND`, "Sentinel doesn't know this user.", and `409 USER_INACTIVE`,
  for a user who became inactive, "This user is inactive, so they can't be
  granted access." (Sentinel `docs/features/tickets/tickets.md`, Grant Access).
  A failure of Revoke access shows at the top of its confirmation, which stays
  open, as every other failure of a form does (Errors); the screen handles no
  code of it specifically. After a `403`, the dialog keeps its form, Revoke
  access, and the error (`docs/behaviors.md`, The Signed-in User). A `409
  TICKET_NOT_CONFIDENTIAL` of either is followed by the reads that show the
  Ticket no longer confidential, so the dialog then says so in place of its
  explanation, the form, the grants, and their confirmation, and takes the
  focus (Participants).
- **Errors of Mark as duplicate…, Reopen, Revert duplicate, and Rerun
  convergence.** A failure of Mark as duplicate… shows in its form, which keeps
  the original (`docs/behaviors.md`, Where Errors Appear). The screen handles
  three codes specifically, at the field: `400 TICKET_SELF_DUPLICATE`, "A
  Ticket can't be a duplicate of itself."; `404 TICKET_NOT_FOUND`, "SNTL-99
  doesn't exist, or you don't have access to it.", which names the original
  sent, since "this Ticket" is the Ticket of the dialog, and which Sentinel
  answers alike for an original that does not exist and for one that the user
  cannot see, and also for the Ticket of the screen once the user no longer
  sees it, which the read after the change then shows as Not found
  (`docs/behaviors.md`, Missing and Inaccessible Records; Sentinel
  `docs/api-spec.md`, Ticket Accessibility Check); and `409
  TICKET_DUPLICATE_TARGET_DUPLICATED`, which names the original of the Ticket
  sent, when a read of the dialog shows it, the Tickets that the field
  suggested for the text sent or the duplicates of the Ticket, so that a user
  who cannot read the label of its disabled option learns it too: "SNTL-41 is a
  duplicate of SNTL-40: choose SNTL-40 instead.", or, for a duplicate of the
  Ticket itself, "SNTL-31 is a duplicate of this Ticket: to make it the
  original, use Revert duplicate on SNTL-31 first."; otherwise "SNTL-41 is a
  duplicate itself: choose its original instead." (Sentinel
  `docs/features/tickets/tickets.md`, Mark Ticket as Duplicate). It handles one
  more code specifically, at the top of the form, in the `danger` tone, since
  Sentinel then changed nothing: `409
  TICKET_DUPLICATE_CONCURRENT_MODIFICATION`, "A duplicate of this Ticket was
  being changed at the same time, so Sentinel changed nothing. Try again."
  (same document, Mark-as-Duplicate Operation). A failure of Mark as duplicate…
  that ends after the user left the screen (Actions) shows in the message area
  in the presentation of the dialog, except that `409
  TICKET_DUPLICATE_TARGET_DUPLICATED` then names no original of the duplicate,
  which the reads of the dialog told, such as "SNTL-30: SNTL-41 is a duplicate
  itself: choose its original instead.", and that `404 TICKET_NOT_FOUND` names
  both Tickets, since no read of the screen tells which of them Sentinel did
  not find: "SNTL-30: This Ticket or the original SNTL-21 doesn't exist, or you
  don't have access to it.". A failure of Reopen, Revert duplicate, or Rerun
  convergence shows in the message area in the presentation of its status, as a
  warning when Sentinel did not confirm the change, such as the `503
  CELERY_UNAVAILABLE` of a rerun, which may still run (Sentinel
  `docs/features/tickets/tickets.md`, Rerun Ticket Convergence). The screen
  handles one code of Reopen and of Revert duplicate specifically: `409
  TICKET_INVALID_TRANSITION`, for a Ticket that left Ignored or Duplicated
  meanwhile, as when another user reopened it, says "SNTL-17 is no longer
  Ignored." or "SNTL-22 is no longer Duplicated." in the message area in the
  `info` tone, as Sentinel answers (same document, Reopen Ticket; Revert
  Duplicate Status); after the user left the screen, it has the presentation of
  its status. The screen handles no code of Rerun convergence specifically.
- **Errors of Ignore… and Ignore as not shipped by SUSE.** A failure of Ignore…
  shows in its form, which keeps the reason (`docs/behaviors.md`, Where Errors
  Appear). The screen handles one code specifically, at Reason: `409
  TICKET_CVE_NOT_REJECTED`, for `cve_rejected` on a Ticket whose CVE is no
  longer rejected, as after a revert of the rejection since the dialog opened,
  "CVE-2099-0027 is no longer rejected. Choose another reason." (Sentinel
  `docs/features/tickets/tickets.md`, Ignore Ticket); the read of the Ticket
  after it shows the CVE published. Every other failure shows at the top of the
  form (Errors), such as the `409 TICKET_INVALID_TRANSITION` of a Ticket that
  became Analyzed meanwhile. A failure that ends after the user left the screen
  shows in the message area in the presentation of the dialog, starting with
  the Ticket (Actions). A failure of Ignore as not shipped by SUSE shows in the
  message area in the presentation of its status; the screen handles no code of
  it specifically.
- **Errors of Override priority…, Set severity…, and Associate CVE….** A
  failure shows in the form of its dialog, which keeps the input
  (`docs/behaviors.md`, Where Errors Appear). A failure of Associate CVE…
  closes its confirmation, so that the form shows it. The screen handles
  these codes specifically:
  - Set severity…: `409 TICKET_SEVERITY_DERIVED`, for a Ticket that another
    user associated with a CVE since the dialog opened, at the top of the
    form in the `danger` tone, "SNTL-21 now has a CVE, whose CVSS assessments
    set its severity." (Sentinel `docs/features/tickets/tickets.md`, Set
    Severity Manual);
  - Associate CVE…, at the field: `422 CVE_INVALID_FORMAT`, "Enter a CVE ID,
    such as CVE-2099-1234."; and `409 TICKET_CVE_CONFLICT`, for a CVE that
    another Ticket holds, "CVE-2099-0012 is already the CVE of SNTL-12.", the
    Ticket of `existing_ticket_id` as a link to its screen
    (`docs/design-system.md`, Forms), or "CVE-2099-0012 is already the CVE of
    another Ticket." when that field does not have the form `SNTL-{n}`. That
    Ticket can be one that the user does not see, whose screen then shows Not
    found, since Sentinel names it whatever its access (Sentinel
    `docs/features/tickets/tickets.md`, CVE Resolution Behavior; Identifier
    Disclosure Boundary);
  - Associate CVE…, at the top of the form in the `danger` tone: `400
    TICKET_CVE_ALREADY_SET`, for a Ticket that has a CVE since the dialog
    opened, as after another user's association or the user's own that
    Sentinel did not confirm, "SNTL-21 already has a CVE." (same document,
    Associate CVE).

  Every other failure shows at the top of the form (Errors). Override priority…
  has no code of its own (Sentinel `docs/features/tickets/tickets.md`, Set
  Priority Override). A failure that ends after the user left the screen shows
  in the message area in the presentation of the dialog, starting with the
  Ticket (Actions), the conflict without a link.
- **Errors of Make confidential… and Make non-confidential….** A failure shows
  at the top of the confirmation, which stays open, in the presentation of
  its status, as a warning when Sentinel did not confirm the change
  (`docs/behaviors.md`, Where Errors Appear; Default Presentation by Status;
  Retries and Unconfirmed Changes); the screen handles no code of Set
  Confidentiality specifically (Sentinel `docs/features/tickets/tickets.md`,
  Set Confidentiality).
- **Errors of Edit Coordinated Release Date.** A failure shows in the form of
  its dialog, which keeps the date and time (`docs/behaviors.md`, Where Errors
  Appear). The screen handles two codes specifically: `422
  TICKET_COORDINATED_RELEASE_BEFORE_CREATION`, at the field, with the message
  of the check of the creation (Actions); and `409 TICKET_NOT_CONFIDENTIAL`,
  for a Ticket that is no longer confidential and has no date, as after
  another user made it non-confidential and removed its date meanwhile, of
  Save and of Remove date alike, at the top of the form in the `danger` tone,
  since Sentinel then changed nothing, "SNTL-18 is no longer confidential and
  has no Coordinated Release Date." (Sentinel
  `docs/features/tickets/tickets.md`, Set Coordinated Release Date); the
  confirmation of a removal then closes, so that the form shows it. A field
  error of a `VALIDATION_ERROR` for `coordinated_release_at` shows at the
  field. Every other failure shows at the top of the form (Errors), or, for a
  removal that the user confirmed, at the top of its confirmation, which
  stays open. A failure that ends after the user left the screen shows in the
  message area in the presentation of the dialog, starting with the Ticket
  (Actions).
- **Errors of Edit assignee.** A failure shows in the popover, which stays open
  (`docs/behaviors.md`, Where Errors Appear; Accessibility, Announcements). The
  screen handles three codes specifically, at the search field: `404
  USER_NOT_FOUND`, "Sentinel doesn't know this user."; `409
  TICKET_ASSIGNEE_INACTIVE`, "This user is inactive, so they can't be the
  assignee."; and `400 TICKET_ASSIGNEE_NOT_ELIGIBLE`, "This user can't be the
  assignee of this Ticket." (Sentinel `docs/features/tickets/tickets.md`,
  Assign Ticket; Reassignment, Target constraint); a field error of a
  `VALIDATION_ERROR` for `user_id` also shows there. Each is announced, and
  after each, the popover reads its users again (`docs/behaviors.md`, Loading),
  and the error goes once the term changes. It handles two more codes
  specifically, at the top of the popover: `409 TICKET_ASSIGNEE_CHANGED`, for
  an assignee that changed since the screen read the Ticket, and `409
  TICKET_ASSIGNEE_NOT_CALLER`, for a Ticket that another user took before a
  self-unassignment (same document, Reassignment, Expected assignee;
  Self-Unassignment): once the read of the Ticket after it arrives, "The
  assignee changed meanwhile: the Ticket is now assigned to Bob Wilson.", "…
  assigned to you.", or "… unassigned.", and the popover then marks the
  assignee that the Ticket now has, and offers Unassign yourself only when it
  is the signed-in user; or "The assignee changed meanwhile." when that read
  fails. Every other failure shows at the top of the popover in the
  presentation of its status, as a warning when Sentinel did not confirm the
  change (`docs/behaviors.md`, Default Presentation by Status; Retries and
  Unconfirmed Changes), such as the `409 TICKET_NOT_MUTABLE` of a Ticket that
  became Ignored meanwhile.
- **Errors of Exclude, Restore, the affectedness, and the eligibility.** A
  failure shows in the message area, also one of an action of a Product, whose
  popover then closes, in the presentation of its status, as a warning when
  Sentinel did not confirm the change (`docs/behaviors.md`, Where Errors
  Appear; Default Presentation by Status; Retries and Unconfirmed Changes),
  such as the `409 TICKET_NOT_MUTABLE` of a Ticket that became Ignored
  meanwhile; a failure of the exclusion of a package that the user confirmed
  shows at the top of its confirmation, which stays open. The screen handles
  two codes specifically, which say that another user did the same meanwhile:
  `409 PACKAGE_ALREADY_EXCLUDED` of Exclude, "Package fictional-openssl is
  already excluded.", and `422 PACKAGE_NOT_EXCLUDED` of Restore, "Track
  fictional-openssl · SUSE:FLES-15-SP7:Update is no longer excluded.", each in
  the message area in the `info` tone as Sentinel answers, also after a
  confirmation, which then closes, and for a Product, such as "Product
  Fictional Linux Enterprise Server 15 SP7 of fictional-openssl ·
  SUSE:FLES-15-SP7:Update is already excluded." (Sentinel
  `docs/features/packages/package-model.md`, Soft-Delete Package from Ticket;
  Restore Package; Soft-Delete Track; Restore Track; Soft-Delete Product;
  Restore Product). Either code of the other operation, or of Change Track
  Status or Override Product Eligibility, has the presentation of its status,
  and so does either code after the user left the tab (Actions).
- **Errors of Add package.** A failure shows in its form, which keeps the name
  (`docs/behaviors.md`, Where Errors Appear). The screen handles three codes
  specifically, at the field: `422 PACKAGE_NOT_FOUND_IN_SMELT`, "SMELT doesn't
  maintain a package of this name. Check the name, whose letter case counts.";
  `422 PACKAGE_TARGETS_UNRESOLVED`, "Sentinel can't add any of the Products
  that SMELT lists for this package, so it added nothing."; and `409
  PACKAGE_ALREADY_EXCLUDED`, for a package of the Ticket that its own marker
  excludes, "This package is excluded from this Ticket: Show hidden shows it,
  and Restore in the menu of its actions includes it again." (Sentinel
  `docs/features/packages/package-model.md`, Add Package to Ticket; Interaction
  with add_package_to_ticket). It handles two more codes specifically, at the
  top of the form, in the `danger` tone with their reference rather than as a
  change that Sentinel did not confirm, since Sentinel returns them before any
  change (same document, Adding Packages to a Ticket; Sentinel
  `docs/api-spec.md`, Infrastructure Dependency Errors (HTTP 503)): `503
  SMELT_UNAVAILABLE`, "Sentinel couldn't get the tracks and Products of this
  package from SMELT, so it added nothing. Try again later.", and `503
  PRODUCT_CATALOG_NOT_READY`, "Sentinel hasn't loaded the Products from SMELT
  yet, so it added nothing. Try again later.". Every other failure, such as
  another `5xx`, shows at the top of the form (Errors). The read of the names
  of Package name shows its failure in their place, in the presentation of its
  status; the screen handles no code of Search Maintained Packages specifically
  (Sentinel `docs/features/packages/maintained-package-names.md`, Search
  Maintained Packages).
- **References.** The toolbar shows at once with the tabs, and the
  references as they arrive, without waiting for the Ticket; a failure of
  the references shows once the Ticket has arrived, so that a Ticket that
  the user cannot see shows Not found (`docs/behaviors.md`, Loading; Missing
  and Inaccessible Records). The screen handles no error code of List
  References specifically (Sentinel
  `docs/features/tickets/ticket-references.md`, List References).
- **Errors of Add reference, Edit, and Delete.** The screen handles one code
  of Add reference and Edit specifically: `409 RESOURCE_CONFLICT`, an
  address that another reference of the Ticket has once Sentinel normalizes
  it, says "This Ticket already has a reference with this address." at
  Address (Sentinel `docs/features/tickets/ticket-references.md`, Add
  Reference; Update Reference). A field error of a `VALIDATION_ERROR` for
  `url`, `title`, `type`, or `description` shows at Address, Title, Type, or
  Description. Every other failure has the default presentation, such as the
  `404 RESOURCE_NOT_FOUND` of a reference that another user deleted
  meanwhile; the screen handles no code of Delete specifically.
- **Affected versions.** The toolbar shows at once with the tabs, and the
  loading indicator in place of the entries until the Ticket, which names
  the CVE, and then the entries have arrived (`docs/behaviors.md`, Loading).
  The failure of their read shows in place of the entries, below the
  toolbar, and that of a later read as `docs/behaviors.md` (Where Errors
  Appear) states, each with Try again where the failure offers it; a `404
  CVE_NOT_FOUND` shows as a record that no longer exists or that the user no
  longer sees (`docs/behaviors.md`, Missing and Inaccessible Records). The
  screen handles no error code of Get CVE Affected Versions specifically
  (Sentinel `docs/features/tickets/cve-tracking.md`, Get CVE Affected
  Versions).
- **Audit log.** The toolbar shows at once with the tabs, and the loading
  indicator in place of the events until they arrive, while the screen
  reads the Ticket too; a failure of the events shows once the Ticket has
  arrived, so that a Ticket that the user cannot see shows Not found. Another search, filter, or page
  keeps the events shown, marked as being updated, until the new ones arrive,
  and then announces what the timeline shows, "12 events", "1–50 of 63
  events", or the message of the empty state, with the focus where it was
  (`docs/behaviors.md`, Loading; Accessibility, Focus after a navigation). A
  Ticket without events says "No events.", events that do not match say "No
  events match the search." when only a search applies and "No events match
  the filters." otherwise, with Clear filters, and a page beyond the last
  says "There are no events on this page." with "Go to the first page"
  (`docs/behaviors.md`, Empty States). The failure of the read of the events
  shows in place of the events, and that of a new read of the events shown
  above them, each with Try again where the failure offers it, and the
  failure of List Ticket Actors in the select, while that of the read of the
  first event shows nowhere (Audit log); the screen handles
  no error code specifically (Sentinel
  `docs/features/tickets/ticket-audit-log.md`, List Ticket Events; List
  Ticket Actors). When Clear filters, the pagination, or the action of an
  empty state leaves the page while it holds the focus, the focus moves to
  the screen's heading (`docs/behaviors.md`, Accessibility, Focus after an
  action).
- **Errors of Add SUSE assessment, Edit, and Delete.** The screen handles one
  code of Set or Update SUSE CVSS Assessment specifically: `422
  CVSS_INVALID_VECTOR`, a vector that Sentinel does not accept, such as one
  with a Temporal metric, says "Sentinel doesn't accept this vector. Enter a
  complete CVSS v3.1 Base vector." at Vector (Sentinel
  `docs/features/tickets/cvss-scoring.md`, Input Rules; Set or Update SUSE CVSS
  Assessment). A field error of a `VALIDATION_ERROR` for `vector_string` shows
  at Vector. Every other failure, of the change or of the read of the
  assessments before Add, shows at the top of the form (Errors). A failure of
  Delete shows at the top of its confirmation, which stays open, such as the
  `404 CVSS_ASSESSMENT_NOT_FOUND` of an assessment that another user deleted;
  the screen handles no code of it specifically. The failure of the read of the
  score of the vector shows in the place of the score, with Try again where it
  offers it while the form holds that vector, and leaves the form and its
  action usable (`docs/behaviors.md`, Where Errors Appear); the screen handles
  one code of Calculate CVSS Base Score specifically, `422
  CVSS_INVALID_VECTOR`, which shows at Vector as above and as no score in the
  place of the score (Sentinel `docs/features/tickets/cvss-scoring.md`,
  Calculate CVSS Base Score).
- **Errors of Refetch.** A failure follows the default presentation of a
  change (`docs/behaviors.md`, Errors), such as `503 CELERY_UNAVAILABLE`,
  after which the fetch may still run (`docs/behaviors.md`, Retries and
  Unconfirmed Changes). The screen handles one error code specifically:
  `503 CVE_FETCH_FAILED`, which says that no enabled source can refetch the
  CVE, so that Sentinel started nothing, shows "No enabled source can
  refetch this CVE." with its reference, in the `danger` tone rather than as
  a change that Sentinel did not confirm (Sentinel
  `docs/features/tickets/cve-tracking.md`, Re-fetch CVE Data). Like any
  other, its message names the Ticket when it shows after the user left the
  screen.
- **Reflow.** At 320 CSS px the page does not scroll horizontally, and the
  names of the package tree wrap (`docs/behaviors.md`, Accessibility, Reflow
  and text size). The column Reference of the references keeps at least
  192 px, which its frame holds at 320 CSS px, so that the table scrolls
  within its frame rather than breaking every word of the column. In
  Affected versions, the name of each source stands above its versions,
  and a value longer than its line wraps at any character.

## Cross-references

- `docs/screen-map.md` — Users and Frequent Tasks; Areas and Screens; Links
  Between Areas; Browser History; Contract URLs; Roles
- `docs/behaviors.md` — Session (The Signed-in User); Errors; Invalid Search
  Parameters; Unknown Values; Links to Other Sites; Loading and Empty States;
  Dates and Times; Confirmations and Outcomes; Accessibility; Wording;
  Representation of a User
- `docs/design-system.md` — Tones; Type Scale; Font; Focus and Motion; Main
  Content; Values; Severity; Deadline Badge; Track Milestones; Labels; Other
  Values; Buttons and Links; Lists; Tables; Timelines; Detail Screens; Forms;
  Dialogs; Messages; Loading; Empty States; Errors in Place of Content; Menus,
  Popovers, and Tooltips; Icons by Need; Representation of a User
- Sentinel `docs/features/tickets/ticket-audit-log.md` — Event Type Contract
  (Rules); Canonical Automatic Comment Vocabulary; Cross-Event Ordering,
  Locking, and Rollback; detail JSONB Schema Contract; List Ticket Events;
  List Ticket Actors
- Sentinel `docs/features/tickets/ticket-references.md` — Purpose; Data Model
  (ReferenceType; TicketReference); URL Boundary (URL Normalization); Type
  Auto-Classification; Mutability and Concurrency (Manual-Zone Exception);
  API Schemas; API Endpoints (List References; Add Reference; Update
  Reference; Delete Reference)
- Sentinel `docs/features/tickets/tickets.md` — API Lookup; Search; CVE
  Association (CVE Resolution Behavior; Associating a CVE Later); Severity
  Resolution; Status Transitions; Gate: Analysis → Analyzed; Gate: Analyzed →
  Resolved; Automatic Status Evaluation; Reassignment; Self-Unassignment;
  Auto-Assignment on Unassigned Tickets; Duplicate Handling; Ignored; Tickets
  Without CVE: Behavioral Differences; Confidential Tickets (Identifier
  Disclosure Boundary; Coordinated Release Date); Ignore Reason; Response
  Schemas (Shared Sub-Schemas; TicketDetail;
  TicketConvergenceDispatchResponse); Get Ticket; List Tickets (Duplicate
  filter); Associate CVE; Set Severity Manual; Set Priority Override; Assign
  Ticket; Ignore Ticket; Mark Ticket as Duplicate; Reopen Ticket; Revert
  Duplicate Status; Rerun Ticket Convergence; Set Confidentiality; Set
  Coordinated Release Date; Access Grant Management (List Access Grants;
  Grant Access; Revoke Access)
- Sentinel `docs/features/tickets/ticket-service.md` — `associate_cve`;
  `mark_as_duplicate`; `reopen_from_ignored()`; `revert_duplicate()`
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Actors and Phases;
  SLA Tier; Due Dates (Coordinated Release Window; Null Due Dates); Track
  Milestones (Observability of Later Phases; Completion Evidence); Ticket
  Current Phase
- Sentinel `docs/features/packages/package-model.md` — Three Orthogonal
  Dimensions; Affectedness-Delivery Independence; Status Behavior
  (User-Attributed Status Change; Authorized-User Overrides Product
  Eligibility; Manual Transitions); Exclusion and Actionability; Package
  Eligibility (Override Model); Adding Packages to a Ticket (SMELT Query
  for Package Resolution); API Endpoints (Add Package to Ticket; Soft-Delete
  Package from Ticket; Restore Package; Soft-Delete Track; Restore Track;
  Soft-Delete Product; Restore Product; Change Track Status; Override
  Product Eligibility (Reset behavior); List Ticket Packages)
- Sentinel `docs/features/packages/maintained-package-names.md` — Purpose;
  Domain Concepts (Snapshot); API Endpoints (Search Maintained Packages)
- Sentinel `docs/features/packages/ibs-submission-tracking.md` — Scope;
  Request States; Upstream Evidence (Package and Codestream Identity;
  Action-Scoped CVE Evidence); Public API (Common Query Rules; List
  Submission Requests; List Release Requests)
- Sentinel `docs/features/packages/package-maintainership.md` — Confidential
  Ticket Visibility; Maintainers in the Package Tree; Workbench Dependency
- Sentinel `docs/features/packages/maintainer.md` — Classification; Package
  Details for Ticket
- Sentinel `docs/features/packages/product-catalog.md` — Product Lifecycle
  Phases
- Sentinel `docs/features/tickets/ticket-priority.md` — Priority Levels;
  Automatic Priority Basis; Manual Override (`set_priority_override()`)
- Sentinel `docs/features/tickets/cve-tracking.md` — CVE Sources; Get CVE;
  Get CVE Affected Versions; External Identifiers; CVE Rejection Handling;
  Re-fetch CVE Data
- Sentinel `docs/features/platform/cve-record-parser.md` —
  `parse_affected_versions`
- Sentinel `docs/features/tickets/cve-sync-ghsa.md` — Field Mapping
  (Affected versions (from `.vulnerabilities[]`); Version range parsing
  rules)
- Sentinel `docs/data-model.md` — CVEAffectedVersion
- Sentinel `docs/features/tickets/cve-sync-osv.md` — Field Mapping — CVE
  Record (Phase 1) (GIT Range Event Parsing); Field Mapping — Alias Records
  (Phase 2)
- Sentinel `docs/features/tickets/cve-service.md` — Fetch Orchestration:
  `trigger_on_demand_fetch()` (Database-Free Publication;
  `FetchDispatchResult`); Service Read Contracts (CVE Affected Versions);
  CVE Source Status
- Sentinel `docs/features/tickets/cna.md` — CNA of a CVE (The CNA Entity;
  Display Name); Auto-Ignore Policy (Flag); Security; API Endpoints
  (Response Schemas; Get CNA)
- Sentinel `docs/features/tickets/cvss-scoring.md` — Core Distinctions;
  Accepted Base Vectors (Input Rules; Version Precedence; CVSS v2.0 Base
  Metrics; CVSS v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics);
  Severity; Eligibility Score Resolution; Provider Identity and Authority;
  Assessment Persistence and Ticket Status; API Endpoints (Shared Assessment
  Item; Get CVSS Assessments for a CVE; Set or Update SUSE CVSS Assessment;
  Delete SUSE CVSS Assessment; Calculate CVSS Base Score)
- Sentinel `docs/features/tickets/ticket-mutations.md` — CVSS Status Matrix;
  `set_severity_manual()`
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility; Business Rules (10); Assignment Eligibility Wire Format;
  Endpoint Permission Map (Users; CVEs; CVSS; Tickets; Ticket Packages;
  Maintained Packages; Ticket References)
- Sentinel `docs/features/identity/user-management.md` — Directory API
  endpoints (List Users)
- Sentinel `docs/api-spec.md` — Query Parameter Length Limit; Inadmissible
  Characters in Request Input; Published Input Constraints; Ticket
  Identifier Resolution; User Identifier Resolution; CVE Identifier
  Resolution; CNA Identifier Resolution; Ticket Accessibility Check; CVE
  Accessibility Check; Pagination;
  Enum Filter Validation; Date Range Interpretation; Infrastructure Dependency
  Errors (HTTP 503); Manual-Zone Mutability Guard; Partial Update Semantics;
  User References in Responses
