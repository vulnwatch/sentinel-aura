# Conventions

## Contents

- [Document Scope, Authority, and Navigation](#document-scope-authority-and-navigation)
- [General Principles](#general-principles)
- [Cross-Cutting Rules](#cross-cutting-rules)
  - [Example Data in Documentation](#example-data-in-documentation)
  - [Dependency Admission](#dependency-admission)
- [Shell Scripting](#shell-scripting)
- [Git Conventions](#git-conventions)
  - [Workflow](#workflow)
    - [Issues and work units](#issues-and-work-units)
  - [Pull Request Requirements](#pull-request-requirements)
  - [Issue and PR Body Formatting](#issue-and-pr-body-formatting)
  - [Branch Naming](#branch-naming)
  - [Commit Messages](#commit-messages)
  - [Versioning](#versioning)
- [Specification Writing](#specification-writing)
  - [Specification Ownership](#specification-ownership)
  - [Foundation Documents](#foundation-documents)
  - [Screen Documents](#screen-documents)
  - [Sentinel Cross-references](#sentinel-cross-references)
  - [Roadmap Independence](#roadmap-independence)

## Document Scope, Authority, and Navigation

This document defines Sentinel Aura's technical, documentation, and Git
conventions. It owns reusable engineering patterns, naming, repository
workflow, and specification-writing rules, including the format of the
foundation and screen documents. UI behavior belongs to the foundation and
screen documents; backend behavior, the API contract, and the obligations that
the contract places on clients belong to Sentinel's specifications (`README.md`,
Specification Boundary).

Summaries and examples here explain how to apply a convention; they do not
replace a more specific owning contract. When this document names such an
authority, follow that authority for behavior and use this document for the
shared implementation or writing pattern. `AGENTS.md` defines when each
section and related authority must be loaded.

## General Principles

- All code, comments, and documentation MUST be in English
- Follow the principle of least surprise: code should do what a reader expects
- Prefer explicit over implicit
- Keep functions short and focused on a single responsibility
- Use Sentinel only through its API, as its contract defines it. Never depend
  on backend behavior that Sentinel's specifications and the pinned OpenAPI
  document do not state (`AGENTS.md`, Sentinel as an External Authority)

## Cross-Cutting Rules

### Example Data in Documentation

All examples, API response samples, test fixtures, screenshots, and
documentation snippets MUST use fictional placeholder data. Never copy real
personal identifiers — names, email addresses, usernames, Distinguished Names,
or any other PII — from a Sentinel deployment or any other external system
into the repository, an issue, or a pull request.

Approved placeholder patterns:

| Type          | Examples                                             |
|---------------|------------------------------------------------------|
| Person names  | `John Doe`, `Alice Smith`, `Bob Wilson`              |
| Usernames     | `jdoe`, `asmith`, `bwilson`                          |
| Emails        | `john.doe@suse.com`, `alice.smith@example.com`       |
| Groups        | `pkg-maintainers`, `kernel-team`                     |
| Group emails  | `pkg-maintainers@suse.de`                            |
| External IDs  | `ext-12345`, `00000000-0000-0000-0000-000000000001` |
| IPv4 addresses | RFC 5737 TEST-NET ranges: `192.0.2.0/24`, `198.51.100.0/24`, `203.0.113.0/24` |

When documenting an API response, first sanitize it by replacing all real
identifiers with fictional equivalents before inserting it into a document.
Capture screenshots from an environment that contains only fictional data;
never attach a screenshot that shows real personal identifiers.

### Dependency Admission

A new dependency is added only after the repository owner's explicit
decision. A new dependency is a third-party component that a change would
declare, pin, install, or load for the first time: for example an npm
package, at run time or for development, including another package of a
family already in use; a container image; a GitHub Action; a tool that CI, a
Git hook, or a script runs; or an asset that the UI would load from a third
party. The packages that a dependency brings with it are part of its
footprint, not separate admissions. The same decision is needed before a
document under `docs/` prescribes a new dependency; naming one in a tracking
issue is not that decision.

No further decision is needed for the dependencies of the UI stack that
`docs/architecture.md` (Approved Dependencies) lists, for any other
dependency that a merged document under `docs/` prescribes, or for a
component that the repository already declares or pins. Updates, version
changes, and removals of declared dependencies are outside this rule;
Renovate and the normal review process handle them (`docs/deployment.md`,
Dependency Updates).

The request for the decision states:

- the current requirement that the dependency serves, not an anticipated one;
- why the web platform, the language, or an already declared dependency does
  not suffice;
- where it runs or ships: the browser, the released image, CI, or the tooling
  only;
- its maintenance: release activity, maintainers and governance, and whether
  its releases carry provenance attestations;
- its transitive footprint: the packages that it adds, and whether any of them
  has install scripts; and
- its license, which must be compatible with the Apache License 2.0.

The pull request that adds the dependency records the justification and the
decision, and adds a dependency of the UI stack to Approved Dependencies. Two
exceptions to the package manager settings (`docs/architecture.md`, Build
Tool, Package Manager, and Node.js) require the same decision and
justification: allowing the install scripts of a dependency, and installing a
version younger than the minimum release age other than through a
vulnerability-fix update.

## Shell Scripting

This section governs standalone shell scripts, Git hooks, and shell embedded
in CI workflows. Shell in this repository is limited to repository
orchestration and developer or CI tooling; application logic is never written
in shell.

### Scope

These rules apply to:

- Standalone scripts under `scripts/`
- Git hooks under `.githooks/`
- Shell embedded in `run:` steps of `.github/workflows/*.yml`

### Interpreter and Safety

- **Shebang**: `#!/usr/bin/env bash`. Scripts target Bash and use Bash
  features (`[[ ]]`, `BASH_SOURCE`, arrays); POSIX `sh` is not assumed
- **Strict mode**: every script MUST start with `set -euo pipefail`
  immediately after the shebang/header comment, so failures, unset
  variables, and broken pipes abort the script instead of propagating
  silently
- **Quoting**: quote all variable expansions (`"${var}"`). The only
  accepted exception is an intentional word-split of an assembled command
  string, which MUST carry a narrowly-scoped, justified
  `# shellcheck disable=SC2086` directive
- **Diagnostics and exit codes**: write error and warning messages to
  stderr; reserve stdout for results. Return a non-zero exit code on
  failure and propagate the exit code of the meaningful inner command
  when the script is a wrapper

### Static Analysis — shellcheck

All shell scripts MUST pass `shellcheck` with no findings.

- Suppressions MUST be **inline**, **narrowly scoped** (a single check
  ID, applied to the smallest possible span — a command or a function),
  and **justified** with a trailing comment explaining why the finding is
  a false positive or an accepted trade-off. Example:

  ```bash
  # shellcheck disable=SC2317  # body is reachable: invoked indirectly via 'trap teardown EXIT'
  teardown() {
      ...
  }
  ```

- Blanket, file-level, or unexplained disables are not allowed. A
  repository-wide `.shellcheckrc` MUST NOT be used to hide findings
  globally

### Formatting — shfmt

All shell scripts MUST be formatted with `shfmt` using the flags
`-i 4 -ci` (4-space indentation, indented switch cases). Verify with
`shfmt -i 4 -ci -d <files>` (diff mode) and fix with
`shfmt -i 4 -ci -w <files>`.

### Workflow Shell — actionlint

Shell embedded in GitHub Actions `run:` steps is validated by
`actionlint`, which checks workflow syntax and runs `shellcheck` on each
`run:` block. Keep embedded shell short; when a `run:` block grows beyond
simple orchestration, extract it into a script under `scripts/` (which is
then covered by the standalone `shellcheck` and `shfmt` rules) and invoke that
script from the workflow.

### Naming and Structure

- **Files**: `kebab-case.sh` for standalone scripts. Git hooks use the fixed
  names Git requires (`pre-commit`, `commit-msg`, `pre-push`) with no
  extension
- **Functions**: `snake_case`; **constants/globals**: `UPPER_SNAKE_CASE`
- Provide a header comment describing purpose and usage, and route
  subcommand dispatch through a `main` function
- **English only** (`AGENTS.md`, Stop conditions before retained work) applies
  to all comments and messages

### File Placement

- `scripts/` — repository-level orchestration and developer or CI tooling
- `.githooks/` — Git hooks (activation covered in `docs/deployment.md`, Local
  Git Hooks)

See the placement table in `AGENTS.md` (Stop conditions before retained work)
for the authoritative mapping.

### Enforcement

- **CI**: the `Shell Lint` job of `.github/workflows/ci.yml` is the
  authoritative gate. It discovers every tracked `*.sh` file and every file
  under `.githooks/` with `git ls-files`, so new scripts and hooks are covered
  automatically, runs `shellcheck` and `shfmt -i 4 -ci -d` on them, and runs
  `actionlint` on the workflows. The workflow pins the tool versions
  (`docs/deployment.md`, Workflow Conventions)
- **Pre-commit hook**: `.githooks/pre-commit` runs the same checks on the
  staged files as a fast local safety net, and warns instead of failing when a
  tool is not installed (`docs/deployment.md`, Local Git Hooks)

## Git Conventions

### Workflow

Sentinel Aura uses GitHub Flow: `master` is always the stable branch. All
changes are developed on short-lived topic branches and merged via pull
request.

**Branch lifecycle**: create from `origin/master`, push regularly, open
a draft PR early, mark ready when implementation, verification evidence,
and applicable reviewer work are complete, squash-merge after approval,
branch auto-deleted.

#### Issues and work units

GitHub Issues are the canonical work item for every substantive,
human-directed repository change — including work an automation agent
performs on a person's request. Specifications, issues, pull requests, and
Projects each own a distinct concern:

| Owner | Owns |
|---|---|
| Foundation and screen documents (`docs/`) | UI behavioral and structural contracts |
| Sentinel's specifications | Backend behavior, the API contract, and client obligations |
| Issues | The problem or outcome, bounded scope, acceptance criteria, owning-specification links, direct blockers |
| Pull requests | Implementation evidence: tests, screenshots, manual verification, reviewer results, risks |
| Projects | Optional, initiative-scoped presentation of live status — never an additional completion gate |

Before creating a topic branch, search open issues in this repository.
Reuse a suitable issue only when all of the following hold: its outcome,
scope, acceptance criteria, and owning specifications cover the requested
change; it is a concrete work item and not a phase/initiative/parent issue;
it has no active linked branch or pull request; and its direct blockers are
resolved. Otherwise create a new issue with the sections Outcome or problem,
Owning specifications, Scope, Acceptance criteria, Verification, and Direct
blockers, which the Work item issue form provides — no separate approval is
needed merely to create the tracking object. The acceptance criteria of a UI
feature are agreed with the repository owner before implementation starts;
they replace a separate specification pull request (Specification Writing,
Screen Documents).

A capability that the UI needs and Sentinel's API lacks is never tracked as
implementation work here: it becomes an issue in `vulnwatch/sentinel`
(`AGENTS.md`, Sentinel as an External Authority), and the issue in this
repository that depends on it declares it as a direct blocker.

**Blocker linkage**: when an issue has direct blockers, declare them both
in the issue's "Direct blockers" section and via GitHub's native
`blocked_by` issue relationship (UI "Add blocked by" command, or the
GraphQL `addBlockedBy` mutation). The free-text section keeps the blocker
readable without leaving the issue body; the native relationship links
both issues bidirectionally, surfaces in each issue's sidebar, and warns
against closing an issue while an open blocker remains.

**Exemptions** — an issue is not required for:

- a pull request generated and maintained exclusively by Renovate or
  release-please (human-directed scope added to such a PR removes the
  exemption);
- pure exploration that creates no retained branch, commit, PR, or
  tracked-file change; or
- a genuinely cosmetic change limited to spelling, punctuation,
  whitespace, comments, or formatting, with no change to behavior,
  requirements, identifiers, commands, paths, or configuration.

When uncertain, create an issue.

**Single active branch**: develop one dependent work unit at a time.
Multiple branches may exist for genuinely independent concerns (for example,
a dependency update and a UI feature), but dependent work is not stacked
across unmerged branches.

**Work unit boundary**: the normal implementation unit is one tracking
issue, one topic branch created from the current `origin/master`, and one
squash-merged pull request. A milestone or roadmap phase groups multiple
work units; it is never itself a long-lived implementation branch. Start
a dependent work unit only after every direct blocker PR has merged, then
branch from the updated `origin/master`.

**Issue linkage**: every non-exempt pull request uses `Closes #<issue>` in
its body so merge completion closes the tracking issue. Exempt
human-authored PRs declare `N/A - <specific reason>` instead; approved
automated PRs (Renovate, release-please) are exempt entirely. Pull Request
Requirements defines the accepted formats. If a gap in the foundation
documents blocks implementation, resolve it in a separate documentation
issue, branch, and merged PR before creating or resuming the implementation
branch — unless the combined-PR exception in `AGENTS.md` (GitHub and release
workflow) applies.

**No direct pushes to `master`**: all changes arrive via squash merge
of a reviewed PR. The pre-push hook enforces this locally; server-side, the
`master` branch protection requires a pull request with passing required
status checks (`docs/deployment.md`, Workflow Inventory) and applies to
administrators as well.

**No force pushes**: never rewrite published branch history.

**No manual tags**: tags are created exclusively by release-please. The
pre-push hook blocks tag pushes locally.

**Squash merge**: the only allowed merge method. The PR title becomes
the commit message on `master`.

**Branch deletion**: branches are deleted automatically after merge.

### Pull Request Requirements

- **Title**: Conventional Commits format (Commit Messages), under 72
  characters.
- **Description**: at minimum: issue linkage, owning documents (foundation
  and screen documents of this repository and the Sentinel specifications
  relied on), scope summary, test evidence, screenshots when required,
  delegated decisions, reviewer results, manual verification notes. The pull
  request template provides these sections.
- **Issue linkage**: `Closes #<issue>` for normal work, `N/A - <specific
  reason>` for an exempt human-authored PR under "Issues and work units"
  in Workflow. Use an `- Issue linkage:` field, or a standalone
  `Closes #<issue>` line anywhere in the body; when the body contains the
  field, the field holds the linkage. Approved automated PRs (Renovate,
  release-please) are exempt from this field.
- **PR Metadata check**: the required `PR Metadata` check validates the title
  and the issue linkage as defined above (`docs/deployment.md`, Workflow
  Inventory).
- **Screenshots**: a PR that changes what the UI shows includes screenshots
  of the affected screens, taken with fictional data (Example Data in
  Documentation), and updates the affected screen document with what was
  built. The repository owner approves such a change by looking at the
  result.
- **Delegated decisions**: record the interface details and other decisions
  taken under delegation (`AGENTS.md`, Delegated decisions), with the options
  considered and the choice.
- **Sentinel version**: a PR that changes the supported Sentinel version
  shows the resulting API changes in its diff and states which screens they
  affect.
- **Manual verification**: record the exercised behavior and observed result.
  If no meaningful manual path exists, record `N/A` with a reason.
- **CI**: all checks must pass on the latest commit before merge is
  requested.
- **Reviewers**: applicable reviewer agents must be invoked and
  findings addressed (`AGENTS.md`, Reviewer Trigger Matrix).
- **Human approval**: the repository owner must explicitly authorize
  the merge by referencing the PR number.

### Issue and PR Body Formatting

Issue descriptions and pull request bodies are rendered as HTML by
GitHub's web UI, which wraps text to the viewport width automatically.
Do NOT hard-wrap lines in issue or PR bodies at a fixed column width
(72, 80, or any other limit) — let the browser handle wrapping. A
paragraph should be written as a single unwrapped line (or with one
sentence per line, if preferred for diff readability); it must not be
manually broken into fixed-width lines.

The 72-character hard-wrapping convention remains scoped to:

- The first line (subject) of commit messages — a Git convention
  respected by `git log`, terminal pagers, and `gh` output
- Files in the repository read in editors or terminals (source code,
  Markdown documentation, configuration), which follow standard prose
  wrapping for documentation and the line length of their own conventions
  for code

### Branch Naming

| Prefix | Use |
|--------|-----|
| `feature/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code refactoring |
| `chore/` | Infrastructure, configuration, dependencies |
| `ci/` | CI/CD pipeline changes |
| `test/` | Test-only changes |

### Commit Messages

- Use conventional commits format: `type: description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`
- Use `!` only with `feat` or `fix` to signal a breaking change:
  `feat!: description`, `fix(scope)!: description`
- Keep the first line under 72 characters
- Use imperative mood: "add feature" not "added feature"
- The `commit-msg` hook validates the type, the breaking marker, and the
  length of the first line (`docs/deployment.md`, Local Git Hooks)
- Examples:
  - `feat: add CVE severity filtering to the ticket list`
  - `fix: show the session expiration notice after a 401 response`
  - `feat!: remove the legacy ticket export view`
  - `docs: describe the empty state of the CVE list`
  - `test: cover the login error messages`

### Versioning

PR titles become commit subjects on `master` through squash merge and therefore
carry the release signal used by release-please, which owns versions and tags:

| Commit type | Release signal |
|-------------|----------------|
| `fix` | Patch |
| `feat` | Minor |
| `fix!`, `feat!` | Breaking release; the resulting version depends on whether the project is pre-1.0 or stable |
| `docs`, `chore`, `ci`, `test`, `refactor` | No release on their own; `!` is not permitted |

The complete Semantic Versioning interpretation, changelog policy, and version
source of truth belong to the release process, at the location that the
`AGENTS.md` placement table assigns to it.

## Specification Writing

### Specification Ownership

This repository specifies the UI: navigation, screens, presentation, and
client-side behavior. Its documents never define backend behavior, the API
contract, or an obligation that the contract places on clients; they
reference the owning Sentinel specification instead of restating it
(Sentinel Cross-references). Client-side behavior that Sentinel's
specifications already describe remains authoritative there until a change
moves it to this repository (`README.md`, Specification Boundary).

UI documents are of two kinds:

| Document | Owns | Changed by |
|---|---|---|
| Foundation documents | The UI as a whole: architecture, screen map, roles, cross-cutting behaviors, design system | A documentation pull request merged before the code that depends on it (specification first) |
| Screen documents | What one screen or area does, as built | The pull request that builds or changes the screen |

Both describe observable behavior and its constraints, not implementation:
they name no component, file, library API, or internal state unless that name
is itself part of the contract (for example, a URL that users can bookmark).
An architecture decision is such a contract for what it chooses: it names the
technologies, tools, and mechanisms that it selects and the files that carry
them.

### Foundation Documents

The UI foundations are written once, before any feature code, and cover:

- **Screen map and navigation**: the screens and areas, how users move between
  them, and the URLs that are part of the contract
- **Roles**: what each Sentinel role sees and can do, expressed in terms of
  Sentinel's authorization model rather than a copy of it
- **Cross-cutting behaviors**: session handling, error presentation, loading
  and empty states, date and time display, accessibility requirements, and
  wording
- **Design system**: the visual language and the reusable interface patterns

A screen follows the foundations. A screen that needs to depart from a
cross-cutting behavior changes the foundations first.

### Screen Documents

A feature has no separate specification pull request. Its issue holds a short
description and acceptance criteria agreed with the repository owner; the pull
request implements the feature, shows screenshots, and creates or updates the
screen document with what was built; the owner approves by looking at the
result.

A screen document is short. It states what a reader needs to understand and
verify the screen, references the foundations instead of restating their
defaults, and omits sections that do not apply:

- **Purpose**: what the screen is for and who uses it
- **Access**: the roles that can open it and what each role sees or can do
  when that differs
- **Navigation**: how users reach the screen and where it leads, including its
  URL when the URL is part of the contract
- **Content**: what the screen shows and the Sentinel API operations that
  provide it (method and path), including the filtering, sorting, and
  pagination it exposes
- **Actions**: what users can do, the operation each action calls, any
  confirmation, and the visible result
- **States**: loading, empty, and error states, with the Sentinel error codes
  that the screen handles specifically, when they differ from the foundations'
  defaults
- **Cross-references**: the Sentinel specification sections and foundation
  sections the screen relies on

Interface details that neither the foundations nor Sentinel's contract cover
are delegated decisions (`AGENTS.md`, Delegated decisions): the screen document
records the outcome, and the pull request records the choice.

### Sentinel Cross-references

Reference a Sentinel contract by its path relative to the Sentinel repository
root and its section name, for example Sentinel
`docs/features/identity/authentication.md` (Session cookie). Cite section
names, not line numbers. Do not copy Sentinel's rules into this repository; a
short summary that helps the reader is allowed only next to the reference, and
the referenced section remains authoritative.

### Roadmap Independence

Behavioral documents — the foundation documents, the screen documents, and the
architecture and deployment documents of this repository — describe what the
UI does. They MUST remain fully valid regardless of implementation
sequencing: which phase is in progress, which work item introduced a
behavior, or whether a given planning artifact still exists.

**Forbidden** in behavioral documents:

- A roadmap phase label used to scope, justify, or explain a documented
  boundary (e.g., "Phase 3 owns...", "Excluded from Phase N",
  "(Phase N+)")
- A work-item, piece, or gate identifier cited as the reason for a behavior
  or a scope boundary
- A cross-reference into a roadmap or planning document as the
  explanation for why something is or is not specified here
- A reviewer-finding identifier (e.g., "G-01", "GAP-3") or a reference
  to a "Reviewer Findings" section that does not exist in the document
  itself

**Allowed**:

- "Phase" or "step" as a generic English word for a step within a flow or
  lifecycle (e.g., "step 2 of the login flow")
- A scope statement expressed purely in ownership terms, with a
  cross-reference to the actual owner (e.g., "The session cookie is defined
  in Sentinel `docs/features/identity/authentication.md` (Session cookie),
  not here") — without naming a roadmap phase or work-item ID

**Where this information belongs instead**:

- The GitHub issues and milestones that track an execution roadmap, when
  one is in use — they own macro-area and work-item sequencing, dependency
  rationale, and deferrals between work items; no repository planning file
  duplicates them
- The GitHub issue tracking a specific work item — its description and
  comments are the right place to record phase-specific notes,
  implementation decisions, and notes on how reviewer findings were
  addressed for that piece of work (see Workflow — Issues and work units)

**Rationale**: work-item identifiers get renumbered as a roadmap
evolves, and planning artifacts are retired once fully consumed. A document
that cites a phase number, work-item ID, or planning document by name
will silently go stale when the roadmap changes shape or the planning
document disappears, with no code or behavioral change to signal the
drift. The information worth keeping — which document owns which
behavior — is always expressible as a cross-reference, independent of any
roadmap state.
