# Sentinel Aura Agent Instructions

`sentinel-aura` is the web user interface for Sentinel (`vulnwatch/sentinel`),
the security update management platform for SUSE and openSUSE-based Linux
distributions. Sentinel provides the backend, the REST API, and the domain and
API contract specifications; this repository provides the browser interface
and owns its specifications (`README.md`, Specification Boundary). The
repository is developed by LLM agents under the rules in this file.

This file is the always-on operational policy for OpenCode agents. It owns
safety gates, workflow, reviewer triggers, and authority routing. It summarizes
but does not replace these authorities:

- Sentinel's specifications and the pinned OpenAPI document own backend
  behavior and the API contract, including the obligations that the contract
  places on clients (see Sentinel as an External Authority).
- The **foundation documents** of this repository own the UI as a whole: the
  documents under `docs/` that define its architecture (`docs/architecture.md`)
  and its UI foundations (screen map and navigation, what each role sees,
  cross-cutting behaviors such as session, errors, loading, dates,
  accessibility, and wording, and the design system).
- The **screen documents** under `docs/` record what each screen or area does,
  as built and approved.
- `docs/conventions.md` owns technical, documentation, and Git conventions,
  including the format of foundation and screen documents.
- The **deployment document**, at the location that the placement table below
  assigns, owns the CI pipeline, the workflow conventions, and the release
  process.
- `.opencode/README.md` catalogs the OpenCode agents and their configuration.

When authorities conflict, stop and report the conflict rather than choosing
silently. Sentinel's contract governs backend behavior and client obligations;
no document of this repository overrides it. Within this repository, a screen
document governs its screen, while the foundation documents and
`docs/conventions.md` govern their stated shared concerns.

## Sentinel as an External Authority

Sentinel is an external, read-only authority. Agents read its specifications
from a local clone of `vulnwatch/sentinel` next to this repository, at
`../sentinel`:

- `../sentinel/docs/features/**` owns domain behavior, including client-facing
  rules such as `../sentinel/docs/features/identity/authentication.md`
  (Frontend session behavior);
- `../sentinel/docs/api-spec.md` owns the general API conventions;
- the other cross-cutting documents in `../sentinel/docs/` own the contracts
  their names indicate; and
- `../sentinel/docs/architecture.md` (System Boundary) owns the boundary
  between the two repositories.

Each Sentinel release publishes its OpenAPI document as the release asset
`sentinel-<version>.openapi.json` (`../sentinel/docs/deployment.md`, API
Documentation Publication). This repository declares the exact Sentinel version
it supports and keeps a copy of that version's OpenAPI document: that copy is
the **pinned OpenAPI document** (`docs/architecture.md`, Backend Contract).
Moving to another Sentinel version is always an explicit pull request whose
diff shows the API changes.

**Which version to read.** Read Sentinel's specifications at the release that
this repository declares as supported, through its tag `v<version>`. While no
supported version is declared, read Sentinel's `master` through
`origin/master`. Before relying on the clone, verify with read-only Git
commands that this revision is present and current; `git -C ../sentinel fetch`
is permitted for that purpose. The user may be working in the clone, so its
checkout is not the revision to read: read the files directly only when the
revision is checked out and the worktree is clean, and otherwise read them with
`git -C ../sentinel show <ref>:<path>`, never by changing the checkout. If the
clone is missing or the revision is not available after a fetch, stop and ask
the user to update the clone. State the revision read to every reviewer that
reads Sentinel.

**Read-only.** Never modify Sentinel from this repository: no edits, commits,
branch switches, resets, stashes, or pushes in the clone, and no branches or
pull requests in `vulnwatch/sentinel`. Fetching is the only permitted Git
operation that writes to the clone.

**Backend behavior is never invented.** A need that Sentinel's specifications
and the pinned OpenAPI document do not cover is a backend gap, never a
delegated decision. Stop, identify the missing capability and the Sentinel
specification that would own it, and propose an issue in `vulnwatch/sentinel`,
where Sentinel's spec-first process applies. Open that issue only after the
user explicitly confirms its content. Work that depends on the capability waits
until a Sentinel release provides it and this repository moves to that release.

Client-side behavior that Sentinel's specifications already describe remains
authoritative there until a change moves it to this repository (`README.md`,
Specification Boundary).

## Always-on Safety Kernel

### Explicit loading and workspace awareness

Ordinary references to files do not load them. Explicitly read every authority
required by the routing rules below, including Sentinel's documents in the
clone. Read only what the task needs, but read the complete named section,
including its nested subsections and any authority that it directly requires.
Do not recursively follow merely informational links.

For localized work, the unit of required reading is the **complete governing
contract**, not mechanically the entire file that contains it. A complete
governing contract includes:

- the document's scope and authority rules that determine how to interpret the
  affected content;
- the complete affected section, including nested subsections;
- applicable defaults, invariants, exceptions, and definitions declared
  elsewhere in the same document;
- sections of directly invoked authorities needed to interpret or change the
  contract; and
- relevant reverse references whose callers, consumers, or dependent contracts
  could be affected by the change.

Use contents tables, heading searches, symbol searches, and references to locate
these parts before reading them. Search results and summaries are navigation
aids, not substitutes for reading the resulting contract. Expand to the
complete document when the contract boundary is unclear, the change affects a
document-wide invariant, or targeted inspection reveals broader coupling.

Inspect the actual filesystem, not only tracked files. Ignored and untracked
files may contain important local work. Read an existing file before
overwriting or modifying it.

Routes are cumulative: apply every matching route. If the scope expands, route
again and complete the additional reads before proceeding in the expanded
area. Plan, Explore, primary agents, and fresh reviewer subagents each route
independently; never assume that a child session inherited a parent's reads.

### Change-scoped review and incremental follow-up

For a review tied to a change, start from the declared scope and diff, then read
the complete governing contracts and implementation dependencies needed to
assess that change. Use targeted repository-wide searches to discover reverse
references, duplicate registrations, callers, consumers, and invariant impact;
do not turn those searches into exhaustive file reads unless a match or an
applicable contract requires it. A specialist review is not a whole-repository
audit unless its trigger, the change's demonstrated impact, or the user
explicitly requires one. If the impact cannot be bounded confidently, expand
the review rather than assuming locality.

The declared scope is the caller's stated task together with the tracking
issue's Scope, Acceptance criteria, and later scope decisions when an issue
exists. The diff shows the submitted change but does not override an explicit
scope commitment or deferral.

The primary agent may resume the same reviewer child session for a follow-up to
the same work item when the reviewer role, repository base, declared scope, and
applicable authorities are unchanged and the prior context remains available.
Pass the new diff or changed material and the previous findings; the reviewer
must reread changed contracts and code, verify the resolutions, and check the
delta for regressions. Start a fresh reviewer session when any validity
condition fails, the earlier context was compacted or is uncertain, or the
review scope changed materially. Session reuse never allows a reviewer to rely
on the primary agent's unverified summary or skip a mandatory review.

Reviewer reports prioritize findings and evidence. Keep positive summaries to
one concise statement and omit empty optional finding categories unless the
specialist output contract requires a fixed table or section. Always retain the
reviewed scope, material limitations, concrete evidence for each finding, and
the required verdict or recommendation.

### Stop conditions before retained work

Before implementing or changing UI behavior, read the tracking issue's
acceptance criteria, the governing foundation documents, the affected screen
document when one exists, and the complete governing contracts in Sentinel for
every API operation and client obligation that the change consumes, including
the pinned OpenAPI document when one exists.

The mandatory specification stop covers backend behavior and the foundation
documents. If the work requires inventing backend behavior, API semantics, a
client obligation, a security or authorization requirement, a cross-cutting
behavior that the foundation documents own, or an architectural boundary, stop
and identify the exact gap, plausible resolutions, the smallest recommended
resolution, completed work, and blocked work. Wait for the user's decision. A
backend gap is resolved in Sentinel (Sentinel as an External Authority); a
foundation gap is resolved in this repository's documents, specification
first. Equivalent internal mechanisms that preserve every contract are
implementation choices, not specification gaps.

**Delegated decisions.** The user delegates to the planning and implementing
agent the decisions that the foundation documents, Sentinel's contract, or the
tracking issue leave open or state inaccurately, because that agent's granular
view of the code and contracts often supports a sounder choice than their
authors had. Evaluate the plausible options and their project impact, choose
the most correct one, and record it. Delegated decisions are not specification
gaps. Delegation covers:

- **interface details** that the foundation documents and Sentinel's contract
  do not cover, such as layout, component choice, and wording within the
  foundations' rules; record them in the pull request, which shows screenshots
  and updates the screen document with what was built;
- **issue-level choices** — interpretation of scope within the issue outcome,
  ordering, placement of complete functions, and internal mechanisms; record
  them in a tracking-issue comment (a read-only planning session presents them
  in its plan, and the implementing agent records them); and
- **refinements of an existing contract of this repository** — resolving an
  ambiguity, inconsistency, or missing detail inside a contract that a
  document under `docs/` already states; align the document in the same
  PR under the combined-PR exception, and disclose each alignment in the plan
  or, when found during implementation, in the pre-PR report.

Delegation never covers backend behavior or API contract semantics, a client
obligation that Sentinel defines, a security or authorization model, an
architectural boundary, or a new cross-cutting behavior of the foundation
documents; those remain specification gaps and stop the work. When uncertain
whether a decision is delegated, treat it as a gap. A plan that takes delegated
decisions presents them in a **Decisions** section listing the options
considered, their impact, and the choice. Reviewer triggers for an aligned
document still apply.

Delegation does not cover a new direct dependency either. Before adding one,
present the justification that `docs/conventions.md` (Dependency Admission)
requires and wait for the user's explicit decision; the same applies to the
package manager exceptions that section names.

Before writing any file, verify its placement against the actual repository and
the authoritative conventions. Core locations are:

| Content | Location |
|---|---|
| Agent policy | `AGENTS.md` |
| Architecture, conventions, foundation documents, and screen documents | `docs/` |
| CI pipeline, workflow conventions, and release process | `docs/deployment.md` |
| OpenCode agents, prompts, and configuration | `.opencode/`, `opencode.json` |
| GitHub workflows, issue forms, and pull request template | `.github/` |
| Git hooks | `.githooks/` |
| Repository orchestration and developer or CI scripts | `scripts/` |

A location in this table may not exist yet; the first change that needs it
creates it. Backend behavior, the API contract, and client obligations are
never placed in this repository: they belong to Sentinel. If a requested
location is wrong, stop, identify the correct location, and ask whether to use
it.

All repository file content must be in English regardless of conversation
language; converse in the user's language when practical. All examples,
fixtures, snippets, comments, screenshots, and test data must use fictional
personal identifiers. Before retaining data from an external system, sanitize
every personal identifier; if uncertain whether a value is personal, treat it
as such.

Before consolidating, extracting, or generalizing a rule, inspect all likely
owners and duplicates, explain whether the rule is screen-specific or
cross-cutting, present the smallest placement options, and obtain explicit user
confirmation. Do not generalize from one speculative use case.

### Git and irreversible operations

Never push to `master`, force-push, create or push tags, bypass hooks, execute
`git reset --hard` or `git clean -fd`, perform another destructive Git
operation, or merge a PR without explicit authorization in the current
conversation. Tags are owned by release-please. Never modify Sentinel (Sentinel
as an External Authority).

Whenever reading an issue or PR, read both its description and comments; either
view alone is incomplete. Use `gh` for GitHub work.

Concrete modification intent, before the first retained edit, automatically
starts the complete work-item and topic-branch workflow in
`docs/conventions.md` (Git Conventions): fetch `origin/master`, inspect and
report worktree conflicts, select or create the issue, and create or confirm the
correct topic branch from current `origin/master`. Pure exploration, analysis,
brainstorming, and review without retained changes do not create an issue or
branch. Never edit on `master`.

Before the first push, report the branch and scope. Before opening a PR, report
the intended Conventional Commits title and PR body, changed files,
`@spec-conformance-reviewer` verdict, and any unresolved findings or risks.
Before merge, present the PR number and title, CI status, reviewer results, and
unresolved risks, then wait for an instruction that explicitly names that PR.
Approval of changes is not merge authorization. After a confirmed squash
merge, synchronize and prune local refs and delete the merged local topic
branch; this specific cleanup is permitted despite the general destructive-Git
gate above.

### Quality and findings

Every code change must add or update tests for its changed behavior; a
demonstrably non-behavioral change may rely on existing coverage. Run focused
checks first, then every complete suite and static check that the repository
defines for the changed artifacts. Do not skip required tests at the user's
request; explain the requirement. Do not declare completion while required
tests, static checks, reviewers, or contract verification remain incomplete.

Invoke every reviewer selected by the trigger matrix below, from the primary
agent's own session, after any delegated Task work has returned. OpenCode's
Task tool enforces a subagent nesting limit (by default `1`): a session started
via Task cannot itself invoke another subagent, and its own attempt to call
Task fails with a depth-limit error. A task must never route around this — for
example by shelling out to a new OpenCode process such as `opencode run` — to
simulate invoking a reviewer or another subagent; that is a prohibited
workaround. If delegated work implicates a reviewer trigger, the task must
report that in its result text instead of attempting to invoke it.

After a task returns, the primary agent is responsible for validating the
delegated changes, either by inspecting them directly, by invoking the
reviewers the trigger matrix requires for that kind of change, or both. The
trigger matrix's own conditions remain the sole authority on which reviewers
are mandatory for a given change; delegating work to a task neither adds nor
removes that obligation, and only the primary agent may invoke a reviewer.

Reviewer findings are hypotheses: independently verify each against the actual
authority and scenario. Discard speculative, already handled, obvious,
over-documenting, or disproportionate findings. Use the smallest sufficient
correction. A resolution that adds a document, state, abstraction, dependency,
configuration option, workflow branch, or substantial specification machinery
requires a user decision before implementation. Confirmed Critical or High
security findings are mandatory and cannot be discarded as disproportionate.
Do not implement discarded findings; mention materially important discards and
their rationale in the PR summary.

## Cumulative Authority Routing

Complete applicable reads before the first concrete recommendation, retained
edit, reviewer finding, or governed workflow action. Minimal inspection needed
to classify the task may occur first. For localized work, read the complete
governing contract as defined above. Read the complete document for a new
screen or area, an architectural boundary, a broad refactor, a genuinely
cross-cutting change, or whenever the governing contract cannot be bounded
confidently.

### UI and backend contract

- **UI behavior or implementation:** read the tracking issue's acceptance
  criteria, the governing foundation documents, and the affected screen
  document; in Sentinel, read the complete governing contract of every
  operation and client obligation that the change consumes, the general
  conventions in `../sentinel/docs/api-spec.md` that apply to them, and the
  pinned OpenAPI document when one exists. Recheck them during conformance
  review.
- **Need for an API capability:** search Sentinel's specifications and the
  pinned OpenAPI document before concluding that the capability is absent; if
  it is absent, apply the backend-gap rule in Sentinel as an External
  Authority.
- **Session, authentication, or cross-origin behavior:** read
  `../sentinel/docs/features/identity/authentication.md` (Session cookie,
  Frontend session behavior, Cross-Origin Request Protection) and
  `../sentinel/docs/api-spec.md` (Cross-Origin Request Protection) before
  proceeding.
- **Architecture-affecting work:** before work that changes or depends on the
  UI's scope or system boundary, its link to Sentinel's contract, how it is
  built, packaged, served, or hosted, how it reaches the API (URLs, proxies,
  origins, and the session cookie), its technology stack, or another decision
  that `docs/architecture.md` records or leaves open, read complete
  `docs/architecture.md` and the Sentinel sections it cites for the affected
  constraints.
- **Repository boundary or ownership between the two repositories:** read
  `README.md` (Specification Boundary), `docs/architecture.md` (Authority
  Between the Repositories), and `../sentinel/docs/architecture.md` (System
  Boundary) before recommending a placement.
- **Supported Sentinel version change:** read Sentinel as an External
  Authority and `docs/architecture.md` (Backend Contract); the pull request
  diff shows the API changes, and every screen that consumes a changed
  operation is rechecked against the new contract.

### Repository tooling

- **Shell script, hook, workflow, CI-consumed script, or release
  configuration:** read complete Shell Scripting and Git Conventions in
  `docs/conventions.md`, and the CI pipeline and workflow conventions at the
  location given by the placement table when that document exists, before
  proceeding. Inspect interacting workflows as one pipeline and update affected
  workflows in the same PR.
- **New direct dependency or package manager exception:** read Dependency
  Admission in `docs/conventions.md` and the Technology Stack section of
  `docs/architecture.md`, including Approved Dependencies, before proposing
  or adding it.

### Specifications, policy, and OpenCode

- **Foundation or screen document writing:** read complete Specification
  Writing in `docs/conventions.md`, the affected document, and the Sentinel
  contracts it relies on before recommending or editing.
- **Roadmap language in behavioral documentation:** read Roadmap Independence
  in `docs/conventions.md` before proceeding. Planning identifiers belong in
  issues, not behavioral authorities.
- **Rule placement or generalization:** apply the always-on placement stop
  above and read Specification Writing plus every candidate owner before
  presenting options.
- **OpenCode agent, prompt, command, skill, configuration, or policy:** read
  affected definitions, `opencode.json`, and `.opencode/README.md`; load the
  `customize-opencode` skill before proceeding. Validate resolved configuration
  and restart OpenCode before behavioral conclusions because configuration-time
  files are not hot-reloaded.
- **Reviewer work:** read the reviewer's definition, the applicable trigger
  below, every route matching the reviewed change, the issue/PR including
  comments, changed files, and the complete governing contracts before
  producing findings or a verdict. Apply Change-scoped review and incremental
  follow-up; reviewer-specific broader reads still take precedence.

### GitHub and release workflow

- **Issue selection, branch, commit, push, PR, release, or merge:** before the
  first such action, read complete Git Conventions in `docs/conventions.md` and
  the always-on Git gates. A concrete work item normally uses one issue, one
  branch from current `origin/master`, and one squash-merged PR.
- **Specification gap workflow:** a backend gap never uses this workflow; it
  becomes a Sentinel issue. For a foundation gap, read the complete Git
  Conventions and Specification Writing in `docs/conventions.md` before
  creating a branch. The default is a documentation issue/PR merged first,
  followed by a separate implementation issue/branch from updated
  `origin/master`. A combined PR is permitted only when the documentation
  change is a limited refinement of an existing contract discovered during
  work-item planning or implementation rather than a new cross-cutting
  behavior, forms the same logical unit as the code, and has no in-flight
  dependents that require it to land first. Use the implementation branch and
  disclose the combined approach in the PR. If the user requests combination
  despite a failed condition, name the failure and trade-off and obtain
  explicit confirmation before proceeding. A feature needs no separate
  specification PR: its issue holds the description and acceptance criteria
  agreed with the owner, and its PR updates the screen document with what was
  built.

## Reviewer Trigger Matrix

Run these reviewers after the relevant work and before completion. Apply stated
skip rules in the named authority; cosmetic changes do not trigger a review
unless the reviewer definition says otherwise.

| Change | Required reviewer |
|---|---|
| Every PR, before opening and again before marking a substantively changed draft ready | `@spec-conformance-reviewer` |
| Workflow, hook, CI-consumed script, or release-please configuration | `@cicd-reviewer` |
| Significant change to documented behavior, a foundation or screen document, agent policy or OpenCode documentation, or multiple documents | `@docs-reviewer` |
| New foundation or screen document, substantive change to the rules, flows, or terminology of one, or change of the supported Sentinel version | `@spec-coherence-reviewer`; skip an isolated change with no impact on related documents or on what the document relies on in Sentinel's contract |
| New or substantially changed foundation or screen document, including an architecture decision | `@design-reviewer` |
| New or substantially changed foundation or screen document that specifies UI behavior | `@spec-gap-analyzer`; skip `docs/architecture.md`, which specifies no screen behavior. High gaps block the work that depends on the document, Medium gaps are resolved in the same PR, and Low gaps may be deferred; an API gap follows the backend-gap rule in Sentinel as an External Authority |
| Foundation or screen document that adds potentially shared rules or content related to several documents | `@docs-placement-reviewer` |

For a repository-wide coherence or gap analysis, invoke the relevant reviewer
once per document in independent sessions. Follow each reviewer definition's
scope and output contract.

## Completion and Pull Requests

For every code change, satisfy every test and check that the repository defines
for the changed artifacts. For documentation, run the checks that the
repository defines for documentation. After OpenCode tooling changes, verify
`.opencode/README.md`, resolved agents and configuration, and restart behavior.
A pull request that changes what the UI shows includes screenshots with
fictional data and updates the affected screen document with what was built.

Do not call work complete until applicable authorities, tests, checks,
reviewers, and Sentinel contract verification are satisfied and all accepted
findings are resolved. Class A, class B, and contract-touching class D
conformance findings block completion.
