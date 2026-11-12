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

The Ticket screen shows one Ticket: its heading row with its main values; in
the tab Overview its CVE, the CVSS assessments of its CVE, its package tree,
its details, the sources of its CVE, which an analyst refetches, and who is
involved in it, with the access grants of a confidential Ticket, which an
analyst who manages confidentiality grants and revokes; and in the tab Audit
log its history, which an analyst searches and filters to reconstruct who
changed what and what Sentinel did by itself.
Vulnerability and restricted analysts work in it all day; every other user
reads it, as a package maintainer does a Ticket of one of their packages that
an analyst shares, and finds in its package tree the tracks that wait for
them (`docs/screen-map.md`, Users and Frequent Tasks; Areas and Screens). It
shows the same Ticket to every user who can see it.

## Access

Every signed-in user opens it; reading it needs no capability. It shows a
Ticket that Get Ticket returns to the user, whose scope, access grants, and
package maintainership decide which confidential Tickets they are (Sentinel
`docs/features/tickets/tickets.md`, Get Ticket; Sentinel
`docs/features/identity/rbac.md`, Scope and Confidential Ticket Visibility).
The screen is the same for every user, except that it offers Refetch to a
user who holds `triage_ticket`, and Grant access and Revoke access to a user
who holds `manage_confidentiality` (Actions; Sentinel
`docs/features/identity/rbac.md`, Endpoint Permission Map (CVEs; Tickets)),
and marks for a maintainer the tracks that wait for them (Packages). Every
user who sees a confidential Ticket sees its access grants, whatever their
capabilities (Sentinel `docs/features/tickets/tickets.md`, List Access
Grants).

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
- The row wraps when the width runs short.

**Tabs**, named "Ticket" for assistive technologies: Overview and Audit
log.

**Layout of Overview** (`docs/design-system.md`, Detail Screens): the CVE, the
CVSS assessments, and the package tree in the main column, in this order, and
the details, the sources of the CVE, and the participants in the side column;
in one column, the details above the CVE, and the sources and the
participants below the package tree. The sources and the participants keep
their place in the order of the page in both layouts, so they stay, with the
focus, a refetch in progress, and an open dialog of the access grants, when
the layout changes.

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
  - EPSS: Score and Percentile, each cut to five decimals, with at least two,
    and Assessed, a date.

  Without an SSVC assessment or an EPSS score, an absent value.
- A Ticket without a CVE shows the heading "CVE" and "No CVE.".
- Absent values show as such (`docs/behaviors.md`, Absent Values).

**CVSS assessments**, the second part of the main column, for a Ticket with a
CVE, from Get CVSS Assessments for a CVE, `GET /api/v1/cves/{cve_id}/cvss`,
read-only (Sentinel `docs/features/tickets/cvss-scoring.md`, Get CVSS
Assessments for a CVE; Shared Assessment Item). A score shows with one
decimal and tabular figures; a CVSS version shows with a "v", such as "v3.1",
so that it is not read as a score, and a version that the pinned contract
does not list shows as received, without the "v" (`docs/behaviors.md`,
Unknown Values).

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
- Its tracks are a list below the band, 12 px apart, each with a border line
  at its left, on one line that wraps where it is too narrow: its reference
  at weight 500; "Needs your action" when it waits for the signed-in user
  (below); and at the end, in `text-14`, its pipeline or its delivery, then,
  12 px later, its affectedness, in a place at least 104 px wide, wider than
  Not affected, so that the pipelines and the affectedness of the tracks line
  up. IBS and Git tracks show alike.
  - The affectedness is a value with the dot of its tone
    (`docs/design-system.md`, Other Values): Analysis `info`, Affected
    `warning`, Not affected and Fixed `success`, Won't fix `neutral`.
  - The pipeline of its phases shows when the track has work and due dates
    (`docs/design-system.md`, Track Milestones), named such as "Phases of
    fictional-openssl, SUSE:FLES-15-SP7:Update: …". The track has no
    deadline badge: its pipeline and Phases show its deadlines
    (`docs/behaviors.md`, Deadlines). A track has work when it is actionable
    and in Analysis, or Affected or Fixed with a Product that is actionable
    and eligible; a track without work, Not affected and Won't fix included,
    shows no pipeline, and a Ticket without due dates shows no pipeline.
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
    Independence).
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
  eligibility set by hand"; and the label Not eligible. Its details (below)
  show its release: "Released" with the date and time of `released_at` on a
  released Product, and on an actionable, eligible Product of a track in
  Analysis, Affected, or Fixed, "Not released" where Sentinel observes the
  QA of the track, or "Not observed" where it does not. A Product that does
  not take part or is not eligible, or whose track has no due dates, has no
  release unless it is released.
- A Product that keeps the Ticket from Resolved also shows its release at
  the end of its line: on a Ticket with a CVE, an actionable, eligible
  Product of an actionable Fixed track, with a release that is not
  "Released" (Sentinel `docs/features/tickets/tickets.md`, Gate: Analyzed →
  Resolved). It shows `triangle-alert` at 14 px in `warning-icon`, then,
  4 px later, "Not released", or "Release not observed" where Sentinel does
  not observe the QA of the track, such as below a Git track, in `text-13`,
  weight 500, `warning-on-soft`, so that an analyst sees which Product the
  Ticket waits for. Another Product shows no release on its line; a Product
  of a track without due dates, which has no release, shows none either.
- The name of a Product opens its details (`docs/design-system.md`, Menus,
  Popovers, and Tooltips): its CPE in monospace below the name, then
  Eligibility, "Eligible" or "Not eligible", followed by " · automatic", or
  " · set by hand" after `user-pen`; Lifecycle, the phase of `lifecycle_phase`
  (Pre-release, General support, Extended support, Reactive support, EOL),
  or "Not available" without lifecycle data; Release, where it has one
  (above), "Released" with its date and time, "Not released", or "Not
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
  Hat, OSV, CISA KEV, or EPSS (Sentinel
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
  | `status_change` | "changed the status from Analysis to Analyzed"; into Ignored with a reason in `detail`, "ignored the Ticket as Not shipped, from New", the reason being Not shipped, CVE rejected, CNA policy, or Other (Sentinel `docs/features/tickets/tickets.md`, Ignore Reason), which the comments `CVE rejected` and `CNA auto-ignore policy` then do not follow, while they follow the sentence of an event without a reason |
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
  the `info` tone otherwise. A message that shows after the user left the
  screen starts with the Ticket, as a link to its screen, such as "SNTL-42:
  Refetch of NVD started.".
- Whatever its outcome, the screen then reads its data again, the sources
  included.

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
  access, a primary button, at the end of the form.
- Grant access sends the `id` of the user chosen; without one, it says "Choose
  a user." at the field and sends nothing; an error of the field goes as the
  user types in it or chooses a user. It asks for no confirmation: it
  ends no one's access (`docs/behaviors.md`, Confirmation). It is busy while
  its request is in progress, during which the dialog cannot be closed. Once
  Sentinel confirms it, also for a grant that existed already, the field
  empties, the focus stays where it was, on Grant access or in the field, and
  the dialog announces it, such as "Access granted to Carol White."
  (`docs/behaviors.md`, Outcome of a Change).
- While the field holds a user chosen and not yet granted, Close and Escape
  ask "Discard changes?", "The user that you chose isn't granted access.",
  with Keep editing and Discard (`docs/behaviors.md`, Confirmation); a term
  typed without a choice is dropped without a question.
- Revoke access, a secondary button at the end of each grant, named after its
  user with the username, such as "Revoke access of Carol White @cwhite",
  asks for confirmation, since it ends another person's access
  (`docs/behaviors.md`, Confirmation): "Revoke access of Carol White?", "Carol
  White loses the access grant to this confidential Ticket, and no longer sees
  it unless their roles or the packages that they maintain let them.", Cancel,
  and Revoke access, a danger button. It sends the `id` of the user. While it
  is in progress, the confirmation cannot be closed. Once Sentinel confirms
  it, the confirmation closes, and once a read of the grants after it
  arrives, whatever its outcome, the dialog announces it, such as "Access of
  Carol White revoked.".
- When the grant whose Revoke access has the focus leaves the list, after its
  Revoke access or because a read no longer returns it, the focus moves to
  the Revoke access of the grant that followed it, or to the user field when
  none follows, in the dialog that holds it (`docs/behaviors.md`,
  Accessibility, Focus after an action).
- The outcome of each is announced in a status region of the dialog, which the
  rest of the page cannot hold while the dialog is open. Whatever the outcome,
  the screen then reads again the Ticket, its access grants, the users who
  acted on it, and its audit log.

## States

- **Loading.** The heading row and the tabs show at once; the panel of
  Overview shows the loading indicator until the Ticket arrives, the value of
  Duplicates until its read arrives, and the part CVSS assessments and the
  section Sources of the CVE until theirs arrives (`docs/behaviors.md`,
  Loading). Until the read of the work of a maintainer arrives, no track is
  marked. The popover of the CNA shows its title at once; its short name and
  its details show once Get CNA arrives, with the loading indicator in place
  of the details until then. The participants show once List Ticket Actors
  and, for a confidential Ticket, List Access Grants have arrived, with the
  loading indicator in their place until then; Access grants shows at once on
  a confidential Ticket, and its dialog shows the loading indicator in place
  of the grants until they arrive.
- **Errors.** The default presentation applies (`docs/behaviors.md`, Errors).
  The failure of the first read of Get Ticket replaces the screen, its heading
  row and tabs included; `404 TICKET_NOT_FOUND`, for a Ticket that does not
  exist or that the user cannot see, shows Not found (`docs/behaviors.md`,
  Missing and Inaccessible Records). A later read of the Ticket that fails,
  such as when the tab returns to the foreground, keeps the Ticket shown, with
  its warning at the top of the panel of the tab, unless it is a `403` or a
  `404`, which replaces the screen. The failure of the read of the duplicates
  shows in place of their value, that of the read of the CVSS assessments in
  place of the part (`docs/design-system.md`, Tables), and that of the read
  of the sources in place of the section, without Refetch all, each with Try
  again where the failure offers it, and leaves the rest of the screen
  usable. When the read of the work of a maintainer fails, a `warning`
  message above the package tree says "The tracks that wait for you couldn't
  be shown.", followed by the message of its status, with Try again where
  the failure offers it, and the package tree stays usable; once
  a read of it has succeeded, a later read that fails keeps its marks and
  says "The tracks that wait for you couldn't be updated.", followed by the
  message of its status, unless it is a `403` or a `404`, which removes them;
  while it is sent again, the marks that stay shown are marked as being
  updated (`docs/behaviors.md`, Where Errors Appear; Loading). When Get CNA
  fails, whatever its status, the popover of the CNA says "Other details
  aren't available." in place of its details, as a user card does
  (`docs/design-system.md`, Menus, Popovers, and Tooltips), and announces it,
  since the popover holds the focus (`docs/behaviors.md`, Accessibility,
  Announcements). The failure of List Ticket Actors or of List Access Grants
  shows in place of the participants, and that of List Access Grants also in
  place of the grants in their dialog, each with Try again where the failure
  offers it. The screen handles one code of List Access Grants specifically:
  `409 TICKET_NOT_CONFIDENTIAL`, for a Ticket that became non-confidential
  since the screen read it, which then has no grants (Sentinel
  `docs/features/tickets/tickets.md`, List Access Grants; Set
  Confidentiality): the participants show without grants, and the screen
  reads the Ticket again, which removes Access grants, and turns an open
  dialog of the access grants to the line that says that the Ticket is no
  longer confidential (Participants).
- **Errors of Grant access and Revoke access.** A failure of Grant access
  shows in its form, which keeps the user chosen (`docs/behaviors.md`, Where
  Errors Appear): the screen handles two codes specifically, at the user
  field, `404 USER_NOT_FOUND`, "Sentinel doesn't know this user.", and
  `409 USER_INACTIVE`, for a user who became inactive, "This user is inactive,
  so they can't be granted access." (Sentinel
  `docs/features/tickets/tickets.md`, Grant Access); a field error of a
  `VALIDATION_ERROR` for `user` also shows at the field; the field then takes
  the focus. Every other failure shows at the top of the form, which takes
  the focus, in the presentation of its status, as a warning when Sentinel
  did not confirm the change (`docs/behaviors.md`, Default Presentation by
  Status; Retries and Unconfirmed Changes). A failure of Revoke access shows
  in the same way at the top of its confirmation, which stays open; the
  screen handles no code of it specifically. After a `403`, the dialog keeps
  its form, Revoke access, and the error (`docs/behaviors.md`, The
  Signed-in User). A `409 TICKET_NOT_CONFIDENTIAL` of either is followed by
  the reads that show the Ticket no longer confidential, so the dialog then
  says so in place of its explanation, the form, the grants, and their
  confirmation, and takes the focus (Participants).
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
  and text size).

## Cross-references

- `docs/screen-map.md` — Users and Frequent Tasks; Areas and Screens; Links
  Between Areas; Browser History; Contract URLs; Roles
- `docs/behaviors.md` — Errors; Invalid Search Parameters; Unknown Values;
  Links to Other Sites; Loading and Empty States; Dates and Times;
  Confirmations and Outcomes; Accessibility; Wording; Representation of a
  User
- `docs/design-system.md` — Font; Focus and Motion; Main Content; Values;
  Severity; Deadline Badge; Track Milestones; Labels; Other Values; Buttons
  and Links; Lists; Tables; Timelines; Detail Screens; Forms; Dialogs;
  Messages; Loading; Empty States; Errors in Place of Content; Menus,
  Popovers, and Tooltips; Icons by Need; Representation of a User
- Sentinel `docs/features/tickets/ticket-audit-log.md` — Event Type Contract
  (Rules); Canonical Automatic Comment Vocabulary; Cross-Event Ordering,
  Locking, and Rollback; detail JSONB Schema Contract; List Ticket Events;
  List Ticket Actors
- Sentinel `docs/features/tickets/ticket-references.md` — ReferenceType
- Sentinel `docs/features/tickets/tickets.md` — API Lookup; Status
  Transitions; Gate: Analyzed → Resolved; Duplicate Handling; Confidential Tickets (Identifier
  Disclosure Boundary; Coordinated Release Date); Ignore Reason; Response
  Schemas (Shared Sub-Schemas; TicketDetail); Get Ticket; List Tickets
  (Duplicate filter); Set Confidentiality; Access Grant Management (List
  Access Grants; Grant Access; Revoke Access)
- Sentinel `docs/features/tickets/ticket-deadlines.md` — Due Dates (Null Due
  Dates); Track Milestones (Observability of Later Phases; Completion
  Evidence); Ticket Current Phase
- Sentinel `docs/features/packages/package-model.md` — Three Orthogonal
  Dimensions; Affectedness-Delivery Independence; Exclusion and
  Actionability; List Ticket Packages
- Sentinel `docs/features/packages/package-maintainership.md` — Maintainers
  in the Package Tree; Workbench Dependency
- Sentinel `docs/features/packages/maintainer.md` — Classification; Package
  Details for Ticket
- Sentinel `docs/features/packages/product-catalog.md` — Product Lifecycle
  Phases
- Sentinel `docs/features/tickets/ticket-priority.md` — Automatic Priority
  Basis; Manual Override
- Sentinel `docs/features/tickets/cve-tracking.md` — CVE Sources; Get CVE;
  External Identifiers; CVE Rejection Handling; Re-fetch CVE Data
- Sentinel `docs/features/tickets/cve-service.md` — Fetch Orchestration:
  `trigger_on_demand_fetch()` (Database-Free Publication;
  `FetchDispatchResult`); CVE Source Status
- Sentinel `docs/features/tickets/cna.md` — CNA of a CVE (The CNA Entity;
  Display Name); Auto-Ignore Policy (Flag); Security; API Endpoints
  (Response Schemas; Get CNA)
- Sentinel `docs/features/tickets/cvss-scoring.md` — Core Distinctions;
  Accepted Base Vectors (Version Precedence; CVSS v2.0 Base Metrics; CVSS
  v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics); Severity; Eligibility
  Score Resolution; API Endpoints (Shared Assessment Item; Get CVSS
  Assessments for a CVE)
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility; Endpoint Permission Map (CVEs; Tickets)
- Sentinel `docs/features/identity/user-management.md` — Directory API
  endpoints (List Users)
- Sentinel `docs/api-spec.md` — Query Parameter Length Limit; Inadmissible
  Characters in Request Input; Ticket Identifier Resolution; User Identifier
  Resolution; CVE Identifier Resolution; CNA Identifier Resolution; CVE
  Accessibility Check; Pagination; Enum Filter Validation; Date Range
  Interpretation; Infrastructure Dependency Errors (HTTP 503)
