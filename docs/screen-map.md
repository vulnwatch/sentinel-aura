# Screen Map

This document defines who uses Sentinel Aura and for which tasks, the areas
and screens of the UI, how users move between them, the URLs that are part of
the contract, and what each profile sees and can do. It is a foundation
document (`docs/conventions.md`, Foundation Documents): every screen follows
it, and a screen that needs another area, another navigation entry, or another
rule for a profile changes this document first. The architecture belongs to
`docs/architecture.md`, and the cross-cutting behaviors and the design system
belong to the other foundation documents; backend behavior, the API contract,
the obligations that the contract places on clients, and authorization belong
to Sentinel (`README.md`, Specification Boundary).

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
  - [Header](#header)
  - [Links Between Areas](#links-between-areas)
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
who open it when work is pending for them. Every other employee with an
account reads it occasionally. The screens are designed for the tasks below,
grouped by the profiles of Roles.

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
  Dates, and their access grants;
- create Tickets manually and refetch CVE data.

### Package Maintainers

Several hundred developers who maintain packages, most of them without a
role: a user is a maintainer through the packages associated with them, not
through a role (Sentinel `docs/features/packages/maintainer.md`, User
Identification and Ownership). They sign in when work is pending for them:

- check their pending fixes and their submission deadlines;
- follow their deliveries in progress, with their submission and release
  requests;
- open the view of their work on one Ticket that an analyst shares, a
  confidential Ticket of one of their packages included.

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
- change the system settings, such as the default CVSS version;
- operate the fetchers: trigger, enable, disable, and configure them.

### Restricted Analysts

Mostly automation: bot accounts with the `restricted_analyst` role that work
through API keys (Sentinel `docs/features/identity/rbac.md`, Business Rules;
Sentinel `docs/features/identity/user-management.md`, Bot Accounts). Their
operators sign in to the UI to create and rotate those keys.

### Every User

Every user sees their own profile, manages their own API keys, and reviews
the identity events of their own account.

## Areas and Screens

The UI has the areas and screens below. Contract URLs states the rules of
their paths; a further path of a screen, such as a section of a detail, stays
under the path of the screen, and its screen document records it.

| Area | Screen | Path | Content |
|---|---|---|---|
| Sign-in | Login | `/login` | Local sign-in (Sentinel `docs/features/identity/local-authentication.md`, Login) |
| Home | Home | `/` | The landing of the users without the `vulnerability_analyst` role: the search and a summary of their package work (Landing) |
| Search | Search results | `/search` | The Tickets and CVEs that match a search term (Search) |
| Tickets | Ticket list | `/tickets` | The Tickets, in the views of Ticket List Views |
| Tickets | Ticket | `/tickets/{ticket_id}` | One Ticket: its CVE, package tree, references, IBS requests, and audit log, and, with `manage_confidentiality`, its access grants |
| CVEs | CVE list | `/cves` | The CVEs, with or without a Ticket |
| CVEs | CVE | `/cves/{cve_id}` | One CVE: its Ticket, CVSS assessments, sources, and affected versions |
| Packages | Package list | `/packages` | The packages of the Tickets, across Tickets |
| Products | Product list | `/products` | The Product catalog, with the lifecycle of each Product |
| My packages | My packages | `/my-packages` | The signed-in user's maintainer workbench: pending, in-progress, and completed work |
| My packages | My work on a Ticket | `/my-packages/tickets/{ticket_id}` | The signed-in user's work on one Ticket, the view that analysts share |
| Data sources | Data sources | `/data-sources` | The fetchers with their latest runs, and the status of the IBS consumer |
| Data sources | Fetcher | `/data-sources/fetchers/{fetcher_name}` | One fetcher: its run history and timeline, and, with `manage_fetchers`, its configuration and audit log |
| Data sources | Fetcher run | `/data-sources/fetchers/{fetcher_name}/runs/{run_id}` | One run of a fetcher |
| Data sources | CVE source records | `/data-sources/cve-sources` | The latest fetch status of each CVE in each source |
| Account | Profile | `/account` | The signed-in user's own profile |
| Account | API keys | `/account/api-keys` | The signed-in user's own API keys |
| Account | Identity audit log | `/account/identity-audit-log` | The identity events of the signed-in user's own account |
| Administration | Users | `/admin/users` | Every user, with the complete profile |
| Administration | User | `/admin/users/{user_id}` | One user's complete profile and its administration |
| Administration | API keys | `/admin/api-keys` | The API keys of every user |
| Administration | Identity audit log | `/admin/identity-audit-log` | The identity events of every user |
| Administration | Settings | `/admin/settings` | The system settings, their audit log, and the CVSS recalculation |

- A Ticket is created from the Ticket list.
- The UI has no screen of the user directory. The directory serves the
  pickers and filters of other screens, such as the assignee and the access
  grants of a Ticket; the complete profile of a user appears only in
  Administration (Sentinel `docs/features/identity/user-management.md`, Access
  Level Requirements).
- My packages is there for every user: Sentinel serves the workbench to every
  signed-in user (Sentinel `docs/features/packages/maintainer.md`, API
  Endpoints), and a user who maintains no package with work sees its lists
  empty.
- Data sources is open to every user, as Sentinel's fetcher monitoring is,
  while operating a fetcher and reading its configuration and audit log need
  `manage_fetchers` (Sentinel `docs/features/platform/fetcher-operations.md`,
  Purpose; Access Control). Fetcher management is therefore part of Data
  sources rather than of Administration: the same screens show a fetcher to
  every user and its actions to the users who can take them.

## Navigation

### Header

Every screen except Login has a header with:

- the product name, which leads to the landing (`/`);
- the global navigation: Tickets, CVEs, Packages, Products, My packages, Data
  sources, and Administration, in this order. Administration appears only to
  a user who holds `manage_users` or `manage_settings` (Roles); every other
  entry appears to every user;
- the search (Search), except on the Home, which presents the search as its
  main content; and
- the account menu, which shows the signed-in user and leads to Profile, API
  keys, Identity audit log, and sign-out.

The Tickets entry opens the Ticket list in its New view for a user who holds
the `vulnerability_analyst` role (Roles), and in its All view for every other
user. The Administration entry opens Users for a user who holds
`manage_users`, and Settings for every other user who sees it; from each of
its screens, the others that the user can use are one step away. Data sources
links to CVE source records.

### Links Between Areas

A screen links each record that it shows to the screen of that record:

- a Ticket and its CVE link to each other, and a duplicate Ticket links to the
  Ticket that it duplicates;
- a Ticket links to My work on that Ticket, the address that analysts share
  with the maintainers of its packages;
- an item of the Package list, of My packages, or of the search results links
  to its Ticket, and an item of My packages also to My work on that Ticket;
- a run of a CVE fetcher links to the CVE source records of its failures, the
  drill-down that Sentinel describes (Sentinel
  `docs/features/platform/fetcher-operations.md`, Get Fetcher Run Detail), and
  a CVE source record links to its CVE.

Every state of a screen that a user can return to, such as a view, a filter,
or a page of a list, is in its URL (`docs/conventions.md`, Routes), so that
back, reload, a bookmark, and a shared link show it again.

### Search

The search takes one term:

- a term that, in upper case and without surrounding whitespace, is a Ticket
  identifier or a CVE ID opens that Ticket or that CVE (Sentinel
  `docs/api-spec.md`, Ticket Identifier Resolution; CVE Identifier
  Resolution). A Ticket or CVE that does not exist or that the user cannot see
  shows as missing, with the error presentation of the UI foundations;
- every other term opens Search results, which show the first Tickets and
  CVEs that the term matches, as the searches of their lists match it: the
  Ticket search also matches package names (Sentinel
  `docs/features/tickets/tickets.md`, Search; Sentinel
  `docs/features/tickets/cve-tracking.md`, List CVEs). Each group links to its
  list with the same search, the Ticket list in its All view.

## Landing

After a sign-in, Sentinel's post-login redirect leads to the return URL that
the sign-in saved, and otherwise to "the dashboard" (Sentinel
`docs/features/identity/authentication.md`, Post-login redirect); how the UI
treats the saved value belongs to the session behavior of the UI foundations,
within the constraint of `docs/architecture.md` (Same Origin). In this UI the
dashboard is the landing, at `/`:

- for a user who holds the `vulnerability_analyst` role, `/` is replaced,
  without a new entry in the browser history, by the URL of the Ticket list in
  its New view, the queue of new Tickets, with the attention summary (Ticket
  List Views). Such a user does not see the Home;
- every other user sees the Home at `/`.

The landing depends on the role (Roles) and not on data, so the landing of a
user does not change from one day to the next.

The Home leads with the search, followed by a summary of the user's pending
and in-progress work in My packages, which links to its lists. A user without
such work sees that none is pending.

## Ticket List Views

The Ticket list offers predefined views, the same for every user who sees
them, as tabs in this order:

| View | Tickets | Shown to |
|---|---|---|
| New | Status New: the Tickets that no analyst has taken yet, because the first assignment moves a Ticket to Analysis (Sentinel `docs/features/tickets/tickets.md`, Status Transitions) | Every user |
| Assigned to me | Assigned to the signed-in user, in status Analysis or Analyzed | A user who holds the `vulnerability_analyst` role (Roles) |
| Analysis | Status Analysis | Every user |
| Analyzed | Status Analyzed | Every user |
| Unassigned | Status Analysis or Analyzed without an assignee, such as the Tickets of an analyst who was deactivated or lost the role (Sentinel `docs/features/tickets/tickets.md`, Reassignment) | Every user |
| All | Every status | Every user |

- Each tab shows the number of Tickets of its view as this table defines it,
  without the filters and search that the user adds, so that it always shows
  the size of the queue. A view without Tickets keeps its tab and shows the
  empty state of the UI foundations: the tabs keep their places, and a zero
  shows that the queue is empty.
- Each view has its URL. A Ticket list URL that names no view, or a view that
  the user is not shown, opens the All view.
- A user can refine a view with the filters, sorting, and search of the list;
  the exact filters, sorting, and columns of each view belong to the screen
  document of the Ticket list.

### Attention Summary

For a user who holds the `vulnerability_analyst` role, the Ticket list shows
above its views three counts of the Tickets that need attention:

| Count | Tickets |
|---|---|
| Active P1 | Effective priority P1, in status New, Analysis, or Analyzed (Sentinel `docs/features/tickets/ticket-priority.md`, Persistence and Effective Priority) |
| Triage overdue | Status New or Analysis with the triage due date past (Sentinel `docs/features/tickets/ticket-deadlines.md`, Ticket-Level Overdue Filter) |
| Delivery overdue | Status Analyzed, with a submission, UM, or QA milestone past due on at least one track (same section) |

- Each count links to the All view of the Ticket list, refined to those
  Tickets. A count of zero stays.
- Triage overdue and Delivery overdue select different statuses, so they never
  count the same Ticket. A Ticket in status New or Analysis whose later
  milestones are past due counts as Triage overdue, because its triage due date
  comes first (Sentinel `docs/features/tickets/ticket-deadlines.md`, Due
  Dates). Active P1 measures priority, not time, and can include Tickets of
  the other two counts.
- Delivery overdue does not divide the Tickets by phase: a milestone that is
  not completed leaves every later milestone not completed too (Sentinel
  `docs/features/tickets/ticket-deadlines.md`, Track Milestones), so a count
  per milestone would count a Ticket that waits for its submission under UM
  and QA as well.

## Contract URLs

The paths of Areas and Screens and `/auth/callback` are part of the contract:
users bookmark and share them, and changing one changes this document first.

- `/auth/callback` is fixed by Sentinel, which registers it as the address to
  which the identity provider returns the browser (`docs/architecture.md`, Same
  Origin); what the UI does there follows Sentinel's SSO frontend flow
  (Sentinel `docs/features/identity/sso-authentication.md`, Frontend flow).
  SSO is deferred in Sentinel, and the pinned contract has none of its
  operations (Sentinel `docs/features/identity/sso-authentication.md`,
  Status): Login offers local sign-in only, and the path stays reserved,
  without a screen.
- A Ticket is addressed by its `SNTL-{n}` identifier and a CVE by its CVE ID,
  in the canonical forms that the API uses (Sentinel `docs/api-spec.md`, Ticket
  Identifier Resolution; CVE Identifier Resolution). A user is addressed by
  their `id`, because a username is a display value that can change (Sentinel
  `docs/api-spec.md`, User References in Responses). A fetcher is addressed by
  its name and a run by its `id`, as the API addresses them.
- No path of the UI is `/api` or under `/api/`, which the host routes to the
  API (`docs/architecture.md`, Same Origin).
- The search parameters of a screen, such as its view, filters, sorting, and
  page, belong to its screen document.
- A path that matches no screen shows as missing, with the error presentation
  of the UI foundations.
- Every path except Login and `/auth/callback` requires a session: the UI has
  no guest or anonymous mode, because every read of application data requires
  authentication (Sentinel `docs/features/identity/rbac.md`, Access Levels). A
  visitor without a session is led to Login and, after signing in, back to the
  path that they opened (Sentinel `docs/features/identity/authentication.md`,
  Post-login redirect), as the session behavior of the UI foundations defines.

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
  of a new Ticket or the Fixed status of a track, appears only to a user who
  meets it (Sentinel `docs/features/identity/rbac.md`, Endpoint Permission Map;
  Business Rules). A condition on the state of a resource, such as a Ticket in
  status Ignored, is not a capability: the screen document states how its
  actions reflect it.
- **Visibility grants no action.** A user who sees a confidential Ticket
  through an access grant or package maintainership gains no capability from
  it (Sentinel `docs/features/identity/rbac.md`, Scope and Confidential Ticket
  Visibility).
- **Navigation follows the same rule.** A navigation entry appears only to a
  user who can use its area (Header). A user who opens the path of a screen
  without the capability that its operations require sees the API's refusal,
  with the error presentation of the UI foundations.
- **A role decides only where Sentinel's rule is about a role.** Only holders
  of the `vulnerability_analyst` role can be assigned a Ticket (Sentinel
  `docs/features/identity/rbac.md`, Business Rules), so that role decides the
  landing (Landing), the view that the Tickets entry opens, the Assigned to me
  view, the attention summary, and the actions that make the signed-in user
  the assignee of a Ticket. Everything else depends on capabilities.

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
| Reader | A user without a role: no capability, and scope `non_confidential` (Sentinel `docs/features/identity/rbac.md`, Access Levels) | Every area except Administration, without actions besides those of their own account. Confidential Tickets only through an access grant or package maintainership. Lands on the Home |
| Package maintainer | Not a role: a user associated with the packages of Tickets (Sentinel `docs/features/packages/maintainer.md`, User Identification and Ownership) | Their work in My packages, and the confidential Tickets of their packages. Their actions come from their roles alone |
| Vulnerability analyst | The `vulnerability_analyst` role: the capabilities of Ticket work, confidentiality included, and scope `all` | The queue of new Tickets as landing, with the attention summary and the Assigned to me view, and the actions of its capabilities on Tickets and CVEs |
| Restricted analyst | The `restricted_analyst` role: the capabilities of Ticket work without confidentiality, and scope `non_confidential` | The actions of its capabilities on the Tickets that the user sees. Lands on the Home; its users are mostly bot accounts, which use the UI for their API keys |
| Administrator | The `admin` role: the capabilities of user, settings, and fetcher administration and of setting any track to Fixed, without those of Ticket work, and scope `all` | Administration, the fetcher management of Data sources, and the actions of its other capabilities; Ticket work needs the analyst role too. Lands on the Home unless the user also holds the `vulnerability_analyst` role |

### Capabilities of the Signed-in User

The UI reads the roles of the signed-in user from Get Current User (Sentinel
`docs/features/identity/authentication.md`, Get Current User), the source of
every element that depends on the `vulnerability_analyst` role. The contract of
the pinned Sentinel version does not return the user's capabilities, and the UI
does not derive them from the roles, which would copy Sentinel's role
definitions and its union rule. Every element that depends on a capability
therefore waits for a pinned Sentinel version that returns them (Open
Decisions); the elements that depend on the `vulnerability_analyst` role do
not.

## Open Decisions

A decision that is not taken yet is listed here, with who takes it, and every
design that depends on it waits for it.

- **The capabilities of the signed-in user.** Sentinel decides how a client
  learns them, and the pinned contract does not provide them (Capabilities of
  the Signed-in User). The actions, navigation entries, and parts of screens
  that depend on a capability wait for a pinned Sentinel version that provides
  them; this entry is then removed, and Capabilities of the Signed-in User
  states how the UI learns them.
