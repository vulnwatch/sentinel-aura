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
in the tab Overview its CVE, the CVSS assessments of its CVE, its package
tree, its details, and the sources of its CVE, which an analyst refetches.
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
user who holds `triage_ticket` (Actions; Sentinel
`docs/features/identity/rbac.md`, Endpoint Permission Map (CVEs)), and marks
for a maintainer the tracks that wait for them (Packages).

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
- Anchors: `#cve`, the CVE, `#cvss`, the CVSS assessments, `#packages`, the
  package tree, `#details`, the details, and `#sources`, the sources of the
  CVE; a Ticket without a CVE lacks the CVSS assessments and the sources. The
  reads of Overview are the Ticket, its duplicates, the CVSS assessments and
  the sources of its CVE, and, for a maintainer, their work on the Ticket
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

**Layout of Overview** (`docs/design-system.md`, Detail Screens): the CVE, the
CVSS assessments, and the package tree in the main column, in this order, and
the details and the sources of the CVE in the side column; in one column, the
details above the CVE, and the sources below the package tree. The
sources keep their place in the order of the page in both layouts, so they
stay, with the focus and a refetch in progress, when the layout changes.

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
  such as "NVD CVSS v3.1", with the vector below it, then the metrics of
  `metrics`, each by the name that Sentinel gives the metric, and its value in
  sentence case, such as `adjacent_network` as "Adjacent network", or as
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
  origin `https://www.first.org`, `https://www.first.org/cvss/calculator/3-0`,
  `3-1`, or `4-0`, with the vector as its fragment, from which the calculator
  reads it (`docs/behaviors.md`, Links to Other Sites, Composed addresses).
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

**Sources of the CVE**, the last section of the side column, for a Ticket
with a CVE, from CVE Source Status, `GET /api/v1/cves/{cve_id}/sources`, in
the order of the API, by source, as a list (Sentinel
`docs/features/tickets/cve-service.md`, CVE Source Status):

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
  it, and the CVSS assessments (`docs/behaviors.md`, Outcome of a Change).

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

## States

- **Loading.** The heading row and the tabs show at once; the panel of
  Overview shows the loading indicator until the Ticket arrives, the value of
  Duplicates until its read arrives, and the part CVSS assessments and the
  section Sources of the CVE until theirs arrives (`docs/behaviors.md`,
  Loading). Until the read of the work of a maintainer arrives, no track is
  marked.
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
  updated (`docs/behaviors.md`, Where Errors Appear; Loading).
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
  and Links; Tables; Detail Screens; Forms; Messages; Loading; Errors in
  Place of Content; Menus, Popovers, and Tooltips; Icons by Need;
  Representation of a User
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
- Sentinel `docs/features/tickets/cve-tracking.md` — CVE Sources; Get CVE;
  External Identifiers; CVE Rejection Handling; Re-fetch CVE Data
- Sentinel `docs/features/tickets/cve-service.md` — Fetch Orchestration:
  `trigger_on_demand_fetch()` (Database-Free Publication;
  `FetchDispatchResult`); CVE Source Status
- Sentinel `docs/features/tickets/cvss-scoring.md` — Core Distinctions;
  Accepted Base Vectors (Version Precedence; CVSS v2.0 Base Metrics; CVSS
  v3.0 and v3.1 Base Metrics; CVSS v4.0 Base Metrics); Severity; Eligibility
  Score Resolution; API Endpoints (Shared Assessment Item; Get CVSS
  Assessments for a CVE)
- Sentinel `docs/features/identity/rbac.md` — Scope and Confidential Ticket
  Visibility; Endpoint Permission Map (CVEs)
- Sentinel `docs/api-spec.md` — Ticket Identifier Resolution; CVE Identifier
  Resolution; CVE Accessibility Check; Pagination; Infrastructure Dependency
  Errors (HTTP 503)
