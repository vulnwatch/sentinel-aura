# Screen Map

This document defines who uses Sentinel Aura and for which tasks, the areas
and screens of the UI, how users move between them, the URLs that are part of
the contract, and what each profile sees and can do. It is a foundation
document (`docs/conventions.md`, Foundation Documents): every screen follows
it, and a screen that needs another area, another navigation entry, or another
rule for a profile changes this document first. The architecture belongs to
`docs/architecture.md`, the cross-cutting behaviors to `docs/behaviors.md`, and
the design system to `docs/design-system.md`; backend behavior, the API
contract, the obligations that the contract places on clients, and
authorization belong to Sentinel (`README.md`, Specification Boundary).

Every rule taken from Sentinel is summarized next to the Sentinel section that
states it, and that section remains authoritative (`docs/conventions.md`,
Sentinel Cross-references). What each screen shows and does in detail belongs
to its screen document (`docs/conventions.md`, Screen Documents).

## Contents

- [Users and Frequent Tasks](#users-and-frequent-tasks)
  - [Vulnerability Analysts](#vulnerability-analysts)
  - [Package Maintainers](#package-maintainers)
  - [Readers](#readers)
  - [Administrators](#administrators)
  - [Restricted Analysts](#restricted-analysts)
  - [Every User](#every-user)
- [Areas and Screens](#areas-and-screens)
- [Navigation](#navigation)
  - [Sidebar](#sidebar)
  - [Links Between Areas](#links-between-areas)
  - [Browser History](#browser-history)
  - [Search](#search)
- [Landing](#landing)
- [Ticket List Views](#ticket-list-views)
  - [Attention Summary](#attention-summary)
- [Contract URLs](#contract-urls)
- [Roles](#roles)
  - [Principles](#principles)
  - [Profiles](#profiles)
  - [Capabilities of the Signed-in User](#capabilities-of-the-signed-in-user)
- [Open Decisions](#open-decisions)

## Users and Frequent Tasks

Sentinel Aura is for internal use (`docs/architecture.md`, Scope and System
Boundary). Two groups do most of the work in it: a small team of
vulnerability analysts, who work in it all day, and many package maintainers,
who open it when work is pending for them. Administrators and restricted
analysts have tasks of their own, and every other employee with an account
reads it occasionally. The screens are designed for the tasks below, grouped
by the profiles of Roles.

### Vulnerability Analysts

The security team: about fifteen people who hold the `vulnerability_analyst`
role and work in Sentinel all day. Their most frequent tasks:

- work the queue of new Tickets: take them, or ignore them, or mark them as
  duplicates;
- analyze the packages, tracks, and Product eligibility of their Tickets;
- maintain severities, SUSE CVSS assessments, priority overrides, and
  references;
- follow the deadlines of their Tickets, and chase the maintainers, the SUSE
  maintenance update team (UM), or QA when a delivery is late;
- manage the confidentiality of embargoed Tickets, their Coordinated Release
  Dates, and their access grants, and make a Ticket non-confidential once its
  Coordinated Release Date has passed, which Sentinel never does by itself
  (Sentinel `docs/features/tickets/tickets.md`, Coordinated Release Date);
- create Tickets manually and refetch CVE data.

### Package Maintainers

Several hundred developers who maintain packages, most of them without a
role: a user is a maintainer through the packages associated with them, not
through a role (Sentinel `docs/features/packages/maintainer.md`, User
Identification and Ownership). They sign in when work is pending for them:

- check their pending fixes and their submission deadlines;
- follow their deliveries in progress, with their submission and release
  requests;
- open a Ticket that an analyst shares, a confidential Ticket of one of their
  packages included, and see their work on it.

### Readers

Every other employee with an account, without a role, among them release and
maintenance managers and product and program managers. They sign in
occasionally:

- search for a CVE, a Ticket, or a package;
- see SUSE's status for a CVE: its Ticket, the affected Products and
  codestreams, and whether the fix is released;
- open the links that colleagues share.

### Administrators

A few members of the security team, who often hold the `vulnerability_analyst`
role too. Besides the tasks of an analyst, they occasionally:

- manage users: create local users, assign roles, unlock accounts, reset
  passwords, and deactivate and reactivate users;
- review and revoke the API keys of every user, and review the identity audit
  log;
- operate the fetchers: trigger, enable, disable, and configure them.

### Restricted Analysts

Users with the `restricted_analyst` role, which grants the capabilities of
Ticket work without access to embargoed data (Sentinel
`docs/features/identity/rbac.md`, Business Rule 14; Role Origins and
Coexistence):

- people, such as the members of an external group mapped to the role, who
  work the non-confidential Tickets as vulnerability analysts do: they take
  them from the queue of new Tickets and own them. A confidential Ticket that
  an access grant or package maintainership shows them they can work on, but
  never own (same document, Business Rule 10);
- bot accounts, which work through API keys and own no Ticket (Sentinel
  `docs/features/identity/user-management.md`, Bot Accounts). Their
  operators sign in to the UI to create and rotate those keys.

### Every User

Every user sees their own profile, manages their own API keys, and reviews
the identity events of their own account. Every user also finds the other
users in the directory and sees, for each of them, their entry in the
directory, the Tickets assigned to them, and the Tickets of the packages that
they maintain, such as to follow the work of a colleague.

## Areas and Screens

The UI has the areas and screens below. Contract URLs states the rules of
their paths; a further path of a screen, such as a section of a detail, stays
under the path of the screen, and its screen document records it.

| Area | Screen | Path | Content |
|---|---|---|---|
| Sign-in | Sign in | `/login` | Local sign-in (Sentinel `docs/features/identity/local-authentication.md`, Login) |
| Tickets | Ticket list | `/tickets` | The Tickets, in the views of Ticket List Views; the landing (Landing) |
| Tickets | Ticket | `/tickets/{ticket_id}` | One Ticket: its CVE, with the CVE's CVSS assessments, sources, and affected versions; its package tree, references, IBS requests, and audit log; the signed-in user's own work on it, when they maintain one of its packages; and, with `manage_confidentiality`, its access grants |
| My packages | My packages | `/my-packages` | The signed-in user's maintainer workbench: pending, in-progress, and completed work |
| Users | Users | `/users` | The user directory, and, with `manage_users`, the complete profile of each user and the creation of a local user |
| Users | User | `/users/{user_id}` | One user: their directory entry, the Tickets assigned to them, and the Tickets of the packages that they maintain; with `manage_users`, also the complete profile, its administration, and the user's API keys and identity events |
| Fetchers | Fetchers | `/fetchers` | The fetchers, with their state and latest runs, and the status of the IBS consumer |
| Fetchers | Fetcher | `/fetchers/{fetcher_name}` | One fetcher: its runs, as a history and over time, and, with `manage_fetchers`, its configuration and audit log |
| Fetchers | Fetcher run | `/fetchers/{fetcher_name}/runs/{run_id}` | One run of a fetcher |
| Account | Account | `/account` | The signed-in user's own account, in three tabs with a path each: Profile at `/account`, API keys at `/account/api-keys`, and Identity audit log at `/account/identity-audit-log`, the identity events of the account |
| Administration | API keys | `/admin/api-keys` | The API keys of every user |
| Administration | Identity audit log | `/admin/identity-audit-log` | The identity events of every user |

- A Ticket is created from the Ticket list.
- A CVE has no screen of its own: its data shows on the screen of its Ticket.
  Sentinel creates a Ticket for every CVE that it ingests and associates a CVE
  with one Ticket at most (Sentinel `docs/features/tickets/cve-service.md`,
  Ticket Creation Decision; Sentinel `docs/features/tickets/tickets.md`, CVE
  Association), and the work on a CVE, such as its SUSE CVSS assessment, is
  work on its Ticket (same document, Gate: Analysis → Analyzed). The address
  of a CVE leads to the screen of its Ticket (Contract URLs). A CVE without a
  Ticket therefore shows nowhere, although the API returns it to every user
  (Sentinel `docs/features/tickets/cve-tracking.md`, List CVEs): Sentinel
  gives it a Ticket at its next ingestion, and an analyst can create one for
  it (Sentinel `docs/features/tickets/tickets.md`, CVE Resolution Behavior).
- The Ticket screen shows a user who maintains one of its packages their work
  on the Ticket, as Sentinel classifies it for each maintainer (Sentinel
  `docs/features/packages/maintainer.md`, Package Details for Ticket), so that
  analysts share the address of the Ticket with its maintainers.
- My packages is there for every user: Sentinel serves the workbench to every
  signed-in user (Sentinel `docs/features/packages/maintainer.md`, API
  Endpoints), and a user who maintains no package with work sees its lists
  empty.
- Users is open to every user, as Sentinel's user directory is, while the
  complete profile of a user, its administration, and the API keys and
  identity events of every user need `manage_users` (Sentinel
  `docs/features/identity/user-management.md`, Access Level Requirements;
  Sentinel `docs/features/identity/api-key-management.md`, List All API Keys;
  Sentinel `docs/features/identity/identity-audit-log.md`, List Identity Audit
  Events). User administration is therefore part of Users rather than of
  Administration: the same screens show a user to every user and the complete
  profile and the actions to the users who can take them. The directory also
  serves the pickers and filters of other screens, such as the assignee of a
  Ticket, which offers only the users who can be its assignee (Roles,
  Principles), and its access grants.
- Fetchers is open to every user, as Sentinel's fetcher monitoring is, while
  operating a fetcher, reading the details of the error of a run, and reading
  its configuration and audit log need `manage_fetchers` (Sentinel
  `docs/features/platform/fetcher-operations.md`, Purpose; Access Control).
  Fetcher management is therefore part of Fetchers rather than of
  Administration: the same screens show a fetcher to every user and its
  actions to the users who can take them.

## Navigation

### Sidebar

Every screen has a sidebar along its left edge, except Sign in and a screen
that shows while no signed-in user is known, such as the error of the first
read of the signed-in user (`docs/behaviors.md`, Session State). The sidebar
holds, from top to bottom:

- the product name, which leads to the landing (`/`);
- the search (Search);
- the global navigation: Tickets, My packages, Users, Fetchers, and
  Administration, in this order. Administration appears only to a user who
  holds `manage_users` (Roles); every other entry appears to every user;
- the button that collapses or expands the sidebar; and
- the account menu, which shows the signed-in user, leads to Account and to
  its API keys (Areas and Screens), offers the choice of theme
  (`docs/behaviors.md`, Preferences), and offers Sign out.

The My packages entry shows the number of the signed-in user's pending work,
the tracks that wait for the user's submission (Sentinel
`docs/features/packages/maintainer.md`, Pending), read from Pending Packages,
`GET /api/v1/my/packages/pending`, with `per_page=1`, as `meta.total` (same
document, Pending Packages). It shows no number while the user has no pending
work, so that the entry calls a maintainer's attention only when work waits,
also on a screen far from My packages: a user becomes a maintainer only once
Sentinel associates them with a package of a Ticket (Sentinel
`docs/features/packages/maintainer.md`, User Identification and Ownership),
which can happen months after the user first signed in. The sidebar reads the
number when it first shows, when the tab returns to the foreground after
being hidden, after every change (`docs/behaviors.md`, Outcome of a Change),
and with every read of the pending work of My packages, so that the entry is
as current as that list. A failed read follows `docs/behaviors.md` (Where
Errors Appear).

The sidebar is expanded, with the name of each entry, or collapsed to icons,
each of which shows its name on hover and on keyboard focus
(`docs/design-system.md`, Sidebar). From a window width of 1024 CSS pixels it
follows the user's preference (`docs/behaviors.md`, Preferences). Below that
width it is always collapsed, so that the content keeps its room, and its
expand button opens the expanded sidebar over the content, as a dialog that
takes the focus. Escape, its close button, or a click outside it closes it
and returns the focus to the expand button, and so does a new message in the
message area, such as the failure of a Sign out from it, so that the message
shows (`docs/behaviors.md`, Outcome of a Change). A navigation from it, such
as an entry, the search, or an item of the account menu, closes it, also to
the URL that shows, and the focus follows the navigation
(`docs/behaviors.md`, Accessibility). Opening it changes no preference, and a
window that grows past that width closes it, with the focus on the screen's
heading. Once it closes, in any of these ways, only the expand button opens
it again.

An entry is marked as current while the path of the URL is the path under
which every screen of its area lies (Areas and Screens), `/tickets`,
`/my-packages`, `/users`, `/fetchers`, or `/admin`, or a path under it, such
as Tickets at `/tickets/SNTL-42`. The screen of Account and the address of a
CVE (Contract URLs) belong to no entry. The Tickets entry opens the Ticket
list in its New view for a user who holds `triage_ticket` (Roles), and in its
All view for every other user. The Administration entry opens API keys, and
Identity audit log is one step away from it.

### Links Between Areas

A screen links each record that it shows to the screen of that record:

- a duplicate Ticket links to the Ticket that it duplicates;
- an item of My packages links to its Ticket;
- a user links to their screen, User (`docs/behaviors.md`, Representation of
  a User), which links to the Ticket list refined to the Tickets assigned to
  the user and to the Tickets of the packages that they maintain (Sentinel
  `docs/features/tickets/tickets.md`, List Tickets);
- Fetchers links to each fetcher, and a fetcher to each of its runs.

A CVE has no screen (Areas and Screens), so a CVE ID that a screen shows next
to its Ticket is not a link to the address of the CVE, which would lead to the
same Ticket.

### Browser History

- Every state of a screen that a user can return to, such as a view, a
  filter, or a page of a list, is in its URL (`docs/conventions.md`, Routes),
  so that back, reload, a bookmark, and a shared link show it again.
- A navigation away from an address to which back must not return replaces
  that address in the browser history instead of adding an entry, so that
  back never leads to an address that only leads away again. These
  navigations are Sign in in place of a screen that needs a session or of the
  screen from which the user signed out; the saved URL or the landing in place
  of Sign in; the landing in place of `/`; the landing of another user who
  signed in; the Ticket of a CVE in place of the address of the CVE (Contract
  URLs); and a screen's default in place of a search parameter that it
  does not accept or that names that default, or its own form of a value in
  place of another form (`docs/behaviors.md`, Session; Invalid Search
  Parameters).

### Search

The search takes one term:

- a term that, in upper case and without surrounding whitespace, is a Ticket
  identifier opens that Ticket, and one that is a CVE ID opens the address of
  that CVE, which leads to its Ticket (Contract URLs; Sentinel
  `docs/api-spec.md`, Ticket Identifier Resolution; CVE Identifier
  Resolution). A Ticket that does not exist or that the user cannot see shows
  as missing (`docs/behaviors.md`, Missing and Inaccessible Records);
- every other term opens the Ticket list in its All view with that search,
  which matches the identifiers, CVE IDs, package names, and external
  identifiers of the Tickets (Sentinel `docs/features/tickets/tickets.md`,
  Search).

The search finds Tickets only: a reader looks for SUSE's status of a CVE,
which its Ticket holds (Users and Frequent Tasks), and Users has a search of
its own.

## Landing

The landing is the screen to which `/` leads, as the product name in the
sidebar does, and which Sign in opens after a sign-in when it has no saved URL
to return to (`docs/behaviors.md`, Return After Sign-in). `/` leads to the URL
of the view of the Ticket list that the Tickets entry opens (Sidebar), in
place of `/` in the browser history (Browser History):

- for a user who holds `triage_ticket`, the New view, the queue of new
  Tickets (Ticket List Views);
- for every other user, the All view, with the attention summary and the
  search of the list.

The landing depends on a capability (Roles) and not on data, so the landing
of a user does not change from one day to the next. The UI has no other start
page: a maintainer learns of pending work from the number of the My packages
entry, which the sidebar of every screen shows (Sidebar).

## Ticket List Views

The Ticket list offers predefined views, the same for every user who sees
them, as tabs in this order:

| View | Tickets | Shown to |
|---|---|---|
| New | Status New: the Tickets that no analyst has taken yet, because the first assignment moves a Ticket to Analysis (Sentinel `docs/features/tickets/tickets.md`, Status Transitions) | Every user |
| Unassigned | Status Analysis or Analyzed without an assignee: the Tickets awaiting an assignee. Their assignee returned them; Sentinel unassigned them because their assignee could no longer own them, after a deactivation, a marking as a bot account, a role removal, or the Ticket becoming confidential; or they came back from Resolved, Ignored, or Duplicated without an assignee who can own them, such as an unassigned Ticket that a user who cannot be its assignee reopened or reverted, or that Sentinel reopened from Ignored (Sentinel `docs/features/tickets/tickets.md`, Architectural Invariant; Reassignment; Self-Unassignment; Ignored; Assign Ticket; Reopen Ticket; Revert Duplicate Status; Set Confidentiality) | Every user |
| Analysis | Status Analysis | Every user |
| Analyzed | Status Analyzed | Every user |
| All | Every status | Every user |
| Assigned to me | Assigned to the signed-in user, in status Analysis or Analyzed | A user who can be the assignee of a Ticket (Roles) |
| Embargo | Confidential, in every status: the Tickets under embargo, and those whose Coordinated Release Date has passed, which an analyst has yet to make non-confidential (Sentinel `docs/features/tickets/tickets.md`, Coordinated Release Date; List Tickets) | A user who holds `manage_confidentiality` (Roles) |

- New and Unassigned are the queues of the Tickets that wait for someone to
  take them, which analysts work until they are empty. A line sets them apart
  from the views that follow, which are not expected to be empty
  (`docs/design-system.md`, Lists); Assigned to me is among the views that
  follow, because its Tickets stay assigned through Analysis and Analyzed,
  and so is Embargo, because its Tickets stay confidential until an analyst
  makes them non-confidential.
  Assigned to me and Embargo, the views that not every user is shown, come
  last, in this order, so that every other view keeps its place for every
  user, also when a read of the signed-in user adds or removes one of them
  during a session (`docs/behaviors.md`, The Signed-in User).
- Each tab shows the number of Tickets of its view as this table defines it,
  without the filters and search that the user adds, so that it always shows
  the size of the queue. A view without Tickets keeps its tab and shows an
  empty state (`docs/behaviors.md`, Empty States): the tabs keep their places,
  and a zero shows that the queue is empty.
- Each view has its URL. A Ticket list URL that names no view, or a view that
  the user is not shown, opens the All view.
- A user can refine a view with the filters, sorting, and search of the list;
  the exact filters, sorting, and columns of each view belong to the screen
  document of the Ticket list.

### Attention Summary

The Ticket list shows, above its views and in the order of this table, counts
of the Tickets that need attention, among the Tickets that the API returns to
the user (Roles, Principles): Embargo expired to a user who holds
`manage_confidentiality` (Roles), and the others to every user.

| Count | Tickets |
|---|---|
| Active P1 | Effective priority P1, in status New, Analysis, or Analyzed (Sentinel `docs/features/tickets/ticket-priority.md`, Persistence and Effective Priority) |
| Embargo expired | Confidential, in every status, with a Coordinated Release Date at or before the instant at which Sentinel evaluates the read: the Tickets whose embargo has ended and that an analyst has yet to make non-confidential (Sentinel `docs/features/tickets/tickets.md`, Coordinated Release Date; List Tickets, Embargo filters) |
| Triage overdue | Current phase Triage, past due: in status New or Analysis, with the triage due date past |
| Submission overdue | Current phase Submission, past due: a maintainer's submission of the fix is late |
| UM overdue | Current phase UM, past due: the release request of the SUSE maintenance update team is late |
| QA overdue | Current phase QA, past due: the release of the update after QA is late, past the final release deadline, which is the Coordinated Release Date of a Ticket that has one (Sentinel `docs/features/tickets/ticket-deadlines.md`, Deadline Window) |

- The current phase of a Ticket is the earliest phase of its remediation that
  is not completed, among the phases that Sentinel observes, and Sentinel
  states whether it is past due (Sentinel
  `docs/features/tickets/ticket-deadlines.md`, Actors and Phases; Ticket
  Current Phase). Each overdue count holds the Tickets whose current phase is
  its phase and past due, which Sentinel lists when its `current_phase` and
  `overdue` filters both name that phase (same document, Relation to the
  Overdue Filter).
- Each count links to the All view of the Ticket list, refined to those
  Tickets, except Embargo expired, which links to the Embargo view (Ticket
  List Views), refined to them, so that the list shows their Coordinated
  Release Dates. A count of zero stays.
- A Ticket has one current phase, so the four overdue counts never count the
  same Ticket: a Ticket counts once, under its current phase, even when a
  later phase is past due too, on the same track or on another; the package
  tree of the Ticket shows the phase of each track. Every track of a Ticket
  has the one deadline window of the Ticket, up to the deadline of the SLA,
  which Sentinel applies to every Product, or up to the Coordinated Release
  Date of the Ticket, so no phase is due before an earlier one, and together
  the four counts hold every Ticket that Sentinel's `overdue` filter matches
  (same document, SLA Tier; Deadline Window; Relation to the Overdue
  Filter). Active P1 measures priority, not time, and can include Tickets of
  the other counts.
- Embargo expired measures the confidentiality that remains after the
  Coordinated Release Date, which is not a phase of the remediation, so it is
  not an overdue count. It can include Tickets of the other counts, such as
  one whose update is not released by that date, which is also its final
  release deadline (Sentinel `docs/features/tickets/ticket-deadlines.md`,
  Deadline Window), and it counts a Ticket in every status, because its
  confidentiality and its date stay editable in every status (Sentinel
  `docs/features/tickets/tickets.md`, List Tickets, Embargo filters).
- A Ticket without a current phase counts in no overdue count: one without an
  SLA, and one in status Analyzed whose remaining work Sentinel cannot
  observe, such as one without a CVE (same document, Rules). A track whose
  later phases Sentinel cannot observe does not hold back the current phase,
  so it can still wait in a phase before the one under which its Ticket
  counts (same document, Observable Bottleneck Only).

## Contract URLs

The paths of Areas and Screens, `/auth/callback`, and the address of a CVE,
`/cves/{cve_id}`, are part of the contract: users bookmark and share them, and
changing one changes this document first.

- `/auth/callback` is fixed by Sentinel, which registers it as the address to
  which the identity provider returns the browser (`docs/architecture.md`, Same
  Origin). The requests that the UI sends there follow Sentinel's browser flow
  of SSO (Sentinel `docs/features/identity/sso-authentication.md`, Frontend
  flow), while what it shows and where it leads belong to the UI. SSO is
  deferred in Sentinel, and the pinned contract has none of its operations
  (Sentinel `docs/features/identity/sso-authentication.md`, Status): Sign in
  offers local sign-in only, and the path is reserved: no screen uses it, so
  it shows as missing, like every path that matches no screen.
- `/cves/{cve_id}`, the address of a CVE, leads to the screen of its Ticket,
  in place of itself in the browser history (Browser History). Anyone can
  make it, such as in a message or in another tool, from a CVE ID, which
  every security tool knows, and the search and a screen that knows only a
  CVE ID open a Ticket through it. It reads the CVE (Sentinel
  `docs/features/tickets/cve-tracking.md`, Get CVE), whose `ticket` names its
  Ticket, and meanwhile shows as the Ticket screen shows while it reads its
  Ticket, under the heading "Ticket" (`docs/behaviors.md`, Accessibility,
  Focus after a navigation), which the Ticket screen then keeps without
  moving the focus again. A CVE that does not exist, one that the user cannot
  see, and one without a Ticket show as missing alike (`docs/behaviors.md`,
  Missing and Inaccessible Records); every other failure of the read shows as
  that of the read of a screen (`docs/behaviors.md`, Where Errors Appear).
- A Ticket is addressed by its `SNTL-{n}` identifier and a CVE by its CVE ID,
  in the canonical forms that the API uses (Sentinel `docs/api-spec.md`, Ticket
  Identifier Resolution; CVE Identifier Resolution). A user is addressed by
  their `id`, because a username is a display value that can change (Sentinel
  `docs/api-spec.md`, User References in Responses). A fetcher is addressed by
  its name and a run by its `id`, as the API addresses them.
- No path of the UI is `/api` or under `/api/`, which the host routes to the
  API (`docs/architecture.md`, Same Origin).
- The search parameters of a screen, such as its view, filters, sorting, and
  page, belong to its screen document; which view a Ticket list URL opens
  when it names none, or one that the user is not shown, belongs to Ticket
  List Views, and what a screen does with a value that it does not accept to
  `docs/behaviors.md` (Invalid Search Parameters).
- A path that matches no screen shows as missing (`docs/behaviors.md`,
  Missing and Inaccessible Records).
- Every path except Sign in and `/auth/callback` requires a session: the UI
  has no guest or anonymous mode, because every read of application data
  requires authentication (Sentinel `docs/features/identity/rbac.md`, Access
  Levels). A visitor without a session is led to Sign in and, after signing
  in, back to the path that they opened, as `docs/behaviors.md` (Session)
  defines.

## Roles

### Principles

- **The API decides.** Sentinel decides what each user may see and do, and
  what the UI shows only guides its users (`docs/architecture.md`, Scope and
  System Boundary). Every action is a request that the API accepts or
  refuses, and the UI shows the outcome.
- **The UI shows what the API returns.** Lists and details show the records
  that the API returns to the signed-in user. The UI neither hides nor adds
  records by profile, and never reveals a record that the API conceals: a
  Ticket or a CVE that the user cannot see is indistinguishable from one that
  does not exist (Sentinel `docs/api-spec.md`, Anti-Enumeration Boundary).
- **What needs a capability is hidden without it.** An action, or a part of a
  screen, appears only to a user who holds a capability that Sentinel requires
  for its operation (Sentinel `docs/features/identity/rbac.md`, Permission
  Matrix, and the specification that owns the operation). Without it, the
  element is hidden, not shown disabled: most users hold no capability, and
  disabled controls would fill their read-only screens with actions that they
  can never take. The action of an operation that accepts alternative
  capabilities appears to a user who holds any of them, and a request field or
  value with a capability requirement of its own, such as the confidentiality
  of a new Ticket or each status of a track, appears only to a user who meets
  it (Sentinel `docs/features/identity/rbac.md`, Endpoint Permission Map;
  Business Rules). A condition on the state of a resource, such as a Ticket in
  status Ignored, is not a capability: the screen document states how its
  actions reflect it.
- **Visibility grants no action.** A user who sees a confidential Ticket
  through an access grant or package maintainership gains no capability from
  it (Sentinel `docs/features/identity/rbac.md`, Scope and Confidential Ticket
  Visibility).
- **Navigation follows the same rule.** A navigation entry appears only to a
  user who can use its area (Sidebar). A user who opens the path of a screen
  without the capability that its operations require sees the API's refusal
  (`docs/behaviors.md`, Default Presentation by Status).
- **No element depends on a role.** Elements follow capabilities, and an
  element that concerns the ownership of a Ticket follows the user's
  assignment eligibility, as Sentinel reports it (Capabilities of the
  Signed-in User). The eligibility is a rule that names no role: a user can
  be the assignee of a Ticket when active, not a bot account, holding
  `triage_ticket`, and, for a confidential Ticket, with scope `all`; an
  access grant or package maintainership never makes a user the assignee
  (Sentinel `docs/features/identity/rbac.md`, Business Rule 10). So:
  - the landing (Landing) and the view that the Tickets entry opens
    (Sidebar) follow `triage_ticket`, the capability with which the queue of
    new Tickets is worked;
  - the Embargo view (Ticket List Views) and the Embargo expired count
    (Attention Summary) show to a user who holds `manage_confidentiality`,
    the capability with which the embargoes are worked, such as making a
    Ticket non-confidential and setting its Coordinated Release Date
    (Sentinel `docs/features/identity/rbac.md`, Capabilities). List Tickets
    lists and counts these Tickets without a capability (Sentinel
    `docs/features/tickets/tickets.md`, List Tickets, Embargo filters), but
    a user without it cannot act on them; the All view still shows them to
    every user who sees them (The UI shows what the API returns);
  - the Assigned to me view (Ticket List Views) shows to a user who can be
    the assignee of a Ticket: one whose assignment eligibility is `all` or
    `non_confidential`;
  - the action that assigns a Ticket to the signed-in user is offered to a
    user who holds `triage_ticket`, the capability of its operation (Sentinel
    `docs/features/tickets/tickets.md`, Assign Ticket), and whose assignment
    eligibility admits the Ticket: `all` for a confidential Ticket, `all` or
    `non_confidential` for every other Ticket;
  - the assignee picker of a Ticket offers the users that List Users returns
    with `assignment_eligibility=all` for a confidential Ticket, and with
    `assignment_eligibility=all&assignment_eligibility=non_confidential` for
    every other Ticket (Sentinel `docs/features/identity/user-management.md`,
    List Users), so it never offers a bot account, nor, for a confidential
    Ticket, a user who sees it only through an access grant or package
    maintainership.

  A value of the assignment eligibility that the pinned contract does not
  list admits no Ticket (`docs/behaviors.md`, Unknown Values). The
  eligibility only guides what the UI shows: the API decides each assignment
  (The API decides).

### Profiles

Sentinel grants capabilities and a scope through roles. A user holds no role,
one, or several, and then receives the union of their capabilities and the
least restrictive scope (Sentinel `docs/features/identity/rbac.md`,
Capabilities; Scope; Predefined Roles). The UI therefore shows each user the
elements of every capability that they hold, whichever role grants it.
Predefined Roles states the capabilities of each role; the In Sentinel column
below only summarizes them.

| Profile | In Sentinel | In the UI |
|---|---|---|
| Reader | A user without a role: no capability, and scope `non_confidential` (Sentinel `docs/features/identity/rbac.md`, Access Levels) | Every area except Administration, without actions besides those of their own account. Confidential Tickets only through an access grant or package maintainership. Lands on the All view of the Ticket list |
| Package maintainer | Not a role: a user associated with the packages of Tickets (Sentinel `docs/features/packages/maintainer.md`, User Identification and Ownership) | Their work in My packages and on the screen of each Ticket of their packages, and the confidential Tickets of their packages. Their actions come from their roles alone |
| Vulnerability analyst | The `vulnerability_analyst` role: the capabilities of Ticket work, confidentiality included, and scope `all`. A person who holds it can be the assignee of every Ticket (Sentinel `docs/features/identity/rbac.md`, Business Rule 10) | The queue of new Tickets as landing, the Embargo view and the Embargo expired count, and the actions of its capabilities on Tickets and CVEs; for a person, also the Assigned to me view |
| Restricted analyst | The `restricted_analyst` role: the capabilities of Ticket work without confidentiality, and scope `non_confidential`. A person who holds it can be the assignee of every non-confidential Ticket, a bot account of none (same rule) | The queue of new Tickets as landing, and the actions of its capabilities on the Tickets that the user sees; for a person, also the Assigned to me view. A bot account uses the UI for its API keys |
| Administrator | The `admin` role: the capabilities of user, settings, and fetcher administration and of setting any track to Fixed, without those of Ticket work, and scope `all` | Administration, the user administration of Users, the fetcher management of Fetchers, and the actions of its other capabilities; Ticket work needs an analyst role too. Lands on the All view of the Ticket list unless the user also holds an analyst role |

### Capabilities of the Signed-in User

The UI reads the capabilities and the assignment eligibility of the
signed-in user from Get Current User (Sentinel
`docs/features/identity/authentication.md`, Get Current User): the
capabilities are the source of every element that depends on a capability,
and the assignment eligibility of every element that depends on whether the
user can be the assignee of a Ticket (Principles). Sentinel resolves the
capabilities from the roles with the union rule of its role definitions, and
the assignment eligibility from the roles, the active status, and the bot
marker with its rule of who can be an assignee, so the UI derives neither,
which would copy those definitions and that rule (Sentinel
`docs/features/identity/rbac.md`, Assignment Eligibility Wire Format). The
UI reads the signed-in user again during a session as `docs/behaviors.md`
(The Signed-in User) defines, so that a change of the user's roles or bot
marker reaches an open tab. Users, which reads the complete profiles with
`manage_users` and the directory otherwise (Areas and Screens), reads again
when a read of the signed-in user changes `manage_users` (`docs/behaviors.md`,
Loading).

The capabilities and the assignment eligibility only guide what the UI shows
(Principles). They grant nothing, and a value read earlier can be out of
date: every operation still checks its own authorization, and every
assignment the eligibility of its assignee, and Sentinel applies a change of
the user's roles from the user's next request, so the API can refuse an
action that the UI shows (Sentinel `docs/features/identity/authentication.md`,
Get Current User). The refusal shows as `docs/behaviors.md` (Default
Presentation by Status) defines, and after a `403` the UI reads the signed-in
user again (`docs/behaviors.md`, The Signed-in User). The capabilities state
neither the user's scope nor a permission that depends on a record, such as
an access grant or package maintainership, and the assignment eligibility
states only for which Tickets the user can be the assignee (same Sentinel
section).

## Open Decisions

No decision is open. A decision that is not taken yet is listed here, with who
takes it, and every design that depends on it waits for it.
