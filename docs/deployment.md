# Deployment

This document owns Sentinel Aura's CI pipeline, including the conventions that
every workflow follows, the automated dependency updates, and the local Git
hooks that complement the pipeline. The rules for shell code in workflows,
scripts, and hooks belong to `docs/conventions.md` (Shell Scripting); the rules
for branches, commits, and pull requests belong to `docs/conventions.md` (Git
Conventions).

## Contents

- [CI Pipeline](#ci-pipeline)
  - [Workflow Inventory](#workflow-inventory)
  - [Workflow Conventions](#workflow-conventions)
  - [Dependency Updates](#dependency-updates)
  - [Local Git Hooks](#local-git-hooks)

## CI Pipeline

Continuous integration runs entirely on GitHub Actions. This section is the
authoritative reference for the workflows that exist, the checks that block a
merge, the conventions that every workflow follows, and the local Git hooks
that run a subset of the checks before a change reaches CI.

### Workflow Inventory

| Workflow | Trigger | Purpose | Blocking |
|----------|---------|---------|----------|
| `ci.yml` | Push to `master`, pull request to `master`, manual | `Shell Lint` job: `shellcheck` and `shfmt` on every tracked shell script and Git hook, and `actionlint` on every workflow (`docs/conventions.md`, Shell Scripting). `UI Checks` job: the type check, lint, format check, and unit and component tests of the UI (`docs/conventions.md`, Code Conventions), run through `scripts/tooling.sh` like every Node.js command (`docs/architecture.md`, Development Environment), then a check that `node_modules/` holds no file in the working tree | Yes |
| `pr-metadata.yml` | Pull request to `master` opened, edited, reopened, or synchronized | `PR Metadata` job: validates the title format and length and the issue linkage (`docs/conventions.md`, Pull Request Requirements) with `scripts/check-pr-metadata.sh` | Yes |
| `renovate-validation.yml` | Pull request opened, synchronized, or reopened; manual | Validates `renovate.jsonc` and performs a read-only Renovate dependency lookup (Dependency Updates) | No |

**Blocking** means that the job is a required status check of the `master`
branch protection: a pull request cannot merge until `Shell Lint`,
`UI Checks`, and `PR Metadata` pass on its latest commit, and its branch must
be up to date with `master`. A non-blocking workflow shows a red status when
it fails, but never prevents a merge.

`scripts/check-pr-metadata.sh` reads the pull request fields from environment
variables, so it also runs locally:

```bash
PR_TITLE='docs: describe the empty state of the CVE list' \
    PR_BODY='Closes #42' scripts/check-pr-metadata.sh
```

The script validates the title of a Renovate pull request (author
`renovate[bot]`, branch `renovate/*`) and of a release-please pull request
(branch `release-please--*`), but exempts both from the issue linkage, as
`docs/conventions.md` (Issues and work units) allows.

**Static Application Security Testing (SAST).** CodeQL runs through GitHub's
repository-level default setup, not through a workflow of this repository.

### Workflow Conventions

**Pinned action references.** Every `uses:` reference MUST be pinned by full
commit SHA, with a trailing `# vX.Y.Z` comment naming the version that the SHA
corresponds to (for example `actions/checkout@<sha> # v7.0.1`). Mutable
references (`@main`, `@master`, any branch name) and tag references (`@v7`, or
an exact release tag such as `@v7.0.1`) MUST NOT be used: the upstream
maintainer can move a tag to different content, but not a commit SHA.

**Pinned tools.** A tool that a workflow installs itself — downloaded
directly, run as a container image, or requested through an action's
`version:` input — MUST be pinned to an explicit version and never resolve to
the latest release. A container image is pinned by version and digest. Every
pinned version is tracked by Renovate (Dependency Updates).

**Checkout credentials.** Every `actions/checkout` step sets
`persist-credentials: false`: no workflow pushes to the repository, so the
token stays out of the working copy's Git configuration.

**Least-privilege permissions.** Every workflow MUST declare an explicit
top-level `permissions:` block that is empty (`{}`) or read-only, rather than
relying on the repository default. A job that needs write access declares it in
its own `permissions:` block, scoped to that job only.

**Timeouts.** Every job MUST declare `timeout-minutes`, sized to the job, so
that a hung step cannot hold a runner until GitHub's default limit of six
hours.

**Concurrency.** A workflow that only validates uses a concurrency group with
`cancel-in-progress: true`, so that a newer run of the same pull request or
ref supersedes an older one. A workflow that creates a release or publishes an
artifact MUST NOT cancel a run in progress, because an interrupted release or
publication leaves an indeterminate state.

**No secrets in workflow files.** Credentials MUST be supplied through GitHub
Secrets and referenced through `${{ secrets.* }}`, never written as literals.
A literal value is permitted only for an obviously non-production test fixture
that is self-evidently unusable outside CI. GitHub secret scanning with push
protection and the optional `gitleaks` pre-commit hook (Local Git Hooks) detect
known credential formats; no workflow scans for secrets, so this convention is
otherwise enforced by review.

**Shell inside workflows.** Shell embedded in `run:` steps follows
`docs/conventions.md` (Shell Scripting), including the `actionlint` validation
and the extraction into `scripts/` of any block that grows beyond simple
orchestration.

### Dependency Updates

The hosted Mend Renovate GitHub App reads `renovate.jsonc` from the repository
root and opens the dependency-update pull requests; no workflow of this
repository runs the bot or creates its pull requests. It tracks:

- the SHA-pinned actions, through the `github-actions` manager, which updates
  the SHA and its version comment together;
- the Renovate image of `renovate-validation.yml`, by version and digest,
  through a custom regex manager;
- the tooling image of `scripts/tooling.sh`, by version and digest, through a
  custom regex manager; and
- the versions of the tools that a workflow downloads (`shellcheck`, `shfmt`,
  and `actionlint` in `ci.yml`), through a custom regex manager that reads a
  `# renovate: datasource=<datasource> depName=<name>` hint comment placed
  directly above each `<NAME>_VERSION: "<version>"` line of the workflow's
  `env:` block, for example
  `# renovate: datasource=github-releases depName=rhysd/actionlint`. The value
  holds the version without the `v` prefix of the release tag. A new tool that
  a workflow downloads follows the same pattern, so that Renovate tracks it
  from the start.

Renovate opens no routine update pull request for the npm dependencies of
`package.json`: a package rule disables them, because `renovate.jsonc` does
not configure the minimum release age that their routine updates require
(`docs/architecture.md`, Build Tool, Package Manager, and Node.js). Their
vulnerability-fix pull requests still open, because `vulnerabilityAlerts`
enables them, and any other change runs `scripts/tooling.sh npm` in a pull
request.

Routine updates follow the `schedule:earlyMondays` schedule and use the
`ci(deps):` title prefix, or `chore(deps):` for the tooling image, which is
not used only by CI; neither carries a release signal
(`docs/conventions.md`, Versioning). Renovate never merges its own pull
requests: `automerge` is disabled, and each one is merged like any other pull
request, after the repository owner authorizes the merge.

Known vulnerabilities are handled by two complementary mechanisms:

- **GitHub Dependabot alerts** (with the Dependency graph) monitor the
  dependencies as advisories are published. Dependabot security updates stay
  disabled, so that Renovate remains the only component that creates
  dependency pull requests.
- **Renovate vulnerability-fix pull requests** (`vulnerabilityAlerts`) are
  raised from those alerts immediately, outside the weekly schedule, labeled
  `security`, with the `fix(deps):` prefix, so that a merged security fix is a
  patch release signal. This requires the Mend Renovate App to have read access
  to Dependabot alerts.

`renovate-validation.yml` is an advisory check. It runs on every pull request
rather than on a list of Renovate-managed paths, validates `renovate.jsonc` in
strict mode, and performs a read-only lookup with the official Renovate
container, pinned by version and digest, authenticated by the workflow's
read-only `GITHUB_TOKEN`. `scripts/check-renovate-log.sh` fails the job when
the lookup reports a warning for any dependency. The workflow cannot create
branches or pull requests and is not a required check: a failure is visible as
a red status without blocking the merge.

### Local Git Hooks

The repository ships Git hooks in `.githooks/` that give fast feedback before a
commit or a push reaches CI. Activate them once in each clone:

```bash
git config --local core.hooksPath .githooks
```

The setting applies to this clone only. Git uses one hooks directory at a
time, so hooks configured globally through `core.hooksPath` do not run in this
clone while the local setting is active. To deactivate the repository's hooks:

```bash
git config --local --unset core.hooksPath
```

| Hook | Checks |
|------|--------|
| `commit-msg` | The first line of the message follows the Conventional Commits format and the breaking-marker rule and stays under 72 characters (`docs/conventions.md`, Commit Messages). Messages that Git generates (`Merge`, `Revert`, `fixup!`, `squash!`) are skipped |
| `pre-commit` | `shellcheck` and `shfmt` on the staged shell scripts and hooks, `actionlint` on the staged workflows, and `gitleaks` on the staged changes |
| `pre-push` | Blocks pushes to `master` and pushes of tags (`docs/conventions.md`, Git Conventions) |

The hooks are a supplementary safety net: they can be bypassed, while CI and
the branch protection of `master` cannot. The shell and workflow checks of
`pre-commit` read the working-tree content of the staged files; `gitleaks`
scans the staged content. The tools of `pre-commit` are optional: a missing
tool produces a warning and the commit proceeds.

| Tool | Version | Used by |
|------|---------|---------|
| [shellcheck](https://www.shellcheck.net/) | The version that `ci.yml` pins | `pre-commit`; `actionlint` also runs it on workflow `run:` blocks |
| [shfmt](https://github.com/mvdan/sh) | The version that `ci.yml` pins, to avoid formatting drift | `pre-commit` |
| [actionlint](https://github.com/rhysd/actionlint) | The version that `ci.yml` pins | `pre-commit` |
| [gitleaks](https://github.com/gitleaks/gitleaks) | 8.19.0 or later, which provides the `git` command | `pre-commit` |

Renovate updates the versions that `ci.yml` pins (Dependency Updates); after
such an update is merged, update the local tools to match.

**Secret scanning.** `gitleaks git --staged` scans the staged changes with
`.gitleaks.toml`, which extends gitleaks' default rule set. It is local only:
no workflow scans for secrets, and GitHub secret scanning with push protection
is the server-side check. A confirmed false positive of a non-secret value is
allowlisted in `.gitleaks.toml` by a regular expression — never by path — with
a comment that explains why the value is not a secret.
