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
| `ci.yml` | Push to `master`, pull request to `master`, manual | `Shell Lint` job: `shellcheck` and `shfmt` on every tracked shell script and Git hook, and `actionlint` on every workflow (`docs/conventions.md`, Shell Scripting). `UI Checks` job: `scripts/sentinel-contract.sh verify`, which checks that the pinned OpenAPI document is identical to the release asset of the supported Sentinel version (`docs/architecture.md`, Backend Contract); the dependency audit when the run can change the dependencies (Dependency audit); the generation of the API client, which fails the job when the result differs from the committed client (`docs/architecture.md`, API Client Generation); then the type check, lint, format check, and unit and component tests of the UI (`docs/conventions.md`, Code Conventions), run through `scripts/tooling.sh` like every Node.js command (`docs/architecture.md`, Development Environment), then a check that `node_modules/` holds no file in the working tree. `Coverage Upload` job: uploads the coverage report of the tests to Codecov (Coverage reporting) | Yes |
| `pr-metadata.yml` | Pull request to `master` opened, edited, reopened, or synchronized | `PR Metadata` job: validates the title format and length and the issue linkage (`docs/conventions.md`, Pull Request Requirements) with `scripts/check-pr-metadata.sh` | Yes |
| `renovate-validation.yml` | Pull request opened, synchronized, or reopened; manual | Validates `renovate.jsonc` and performs a read-only Renovate dependency lookup (Dependency Updates) | No |

**Blocking** means that the workflow yields a required status check of the
`master` branch protection: a pull request cannot merge until `Shell Lint`,
`UI Checks`, `PR Metadata`, and the `codecov/patch` status that Codecov
publishes for the upload of `Coverage Upload` (Coverage reporting) pass on its
latest commit, and its branch must be up to date with `master`. A non-blocking
workflow shows a red status when it fails, but never prevents a merge.

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

**Coverage reporting.** The tests of `UI Checks` measure coverage with
Istanbul (`docs/architecture.md`, Static Checks and Tests), and when they pass
the job retains the Clover report as a seven-day workflow artifact; it never
receives `CODECOV_TOKEN`, because it runs the code of the dependencies. The
separate `Coverage Upload` job, which runs after a successful `UI Checks`,
uploads only that report to Codecov, with a pinned Codecov CLI version
(Dependency Updates) and the `CODECOV_TOKEN` repository secret, the upload
token that Codecov issues for the repository. On a pull request, a failed
upload fails the job, which can be re-run on its own while the artifact is
retained; on a push to `master` or a manual run it does not fail the run, so
that a Codecov outage does not mark `master` red after a merge. The repository
`codecov.yml` makes the resulting `codecov/patch` status informational, so it
always passes and no coverage threshold gates a merge, and has Codecov publish
it as soon as the upload is processed rather than waiting for, or failing
because of, the other checks. `codecov/patch` is a required check, so a pull
request cannot merge before its coverage report is visible; while Codecov
cannot process uploads, merges wait until it recovers. `codecov.yml` disables
the `codecov/project` status, which the organization's Codecov plan does not
publish, and maps the paths of the report, which the tooling container writes
under `/work/`, to the repository's.

**Dependency audit.** `scripts/tooling.sh audit` runs `npm audit signatures`,
which verifies the registry signatures and the provenance attestations of the
installed packages, and `npm audit`, which reports the known vulnerabilities
of the locked dependency set, development dependencies included; each fails on
any finding. `UI Checks` runs it, as a blocking step, only when the run can
change or ship the locked dependency set: a pull request or push that changes
`package.json`, `package-lock.json`, or `.npmrc`, a release-please pull
request, a manual run, or a run whose changed files cannot be determined.
`scripts/dependency-audit-scope.sh` takes that decision. Other changes skip
the audit, so a vulnerability disclosed against an unchanged lockfile reaches
the repository as a Dependabot alert and a fix (Dependency Updates) rather
than as a failure of unrelated work, while a dependency change cannot merge
with a known vulnerability.

**Static Application Security Testing (SAST).** CodeQL runs through GitHub's
repository-level default setup, not through a workflow of this repository. It
analyzes the JavaScript and TypeScript of the UI and the workflows, on every
pull request and push to `master` and weekly.

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
ref supersedes an older one. A workflow that creates a release or publishes a
release artifact MUST NOT cancel a run in progress, because an interrupted
release or publication leaves an indeterminate state.

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
  custom regex manager;
- the versions of the tools that a workflow downloads (`shellcheck`, `shfmt`,
  and `actionlint` in `ci.yml`), through a custom regex manager that reads a
  `# renovate: datasource=<datasource> depName=<name>` hint comment placed
  directly above each `<NAME>_VERSION: "<version>"` line of the workflow's
  `env:` block, for example
  `# renovate: datasource=github-releases depName=rhysd/actionlint`. The value
  holds the version without the `v` prefix of the release tag. A new tool that
  a workflow downloads follows the same pattern, so that Renovate tracks it
  from the start;
- the `version:` inputs of actions that the `github-actions` manager does not
  track (the Codecov CLI of `codecov/codecov-action` in `ci.yml`), through a
  custom regex manager that reads the same hint comment placed directly above
  the input; the value is the release tag;
- the npm dependencies of `package.json` and the lockfile, through the `npm`
  manager; and
- the supported Sentinel version of `contract/sentinel-version`, from
  Sentinel's GitHub Releases, through a custom regex manager (Sentinel
  version).

**npm dependencies.** Their routine updates wait for the minimum release age
of `docs/architecture.md` (Build Tool, Package Manager, and Node.js), and
Renovate opens none before it. Minor and patch updates are grouped into one
pull request, and each major update gets its own, or one per monorepo when the
`config:recommended` preset groups the packages of one project. A weekly lock
file maintenance pull request regenerates `package-lock.json`, which keeps the
transitive dependencies current, within npm's own minimum release age.
Renovate does not update the Node.js line of `package.json`, which follows the
tooling image (`docs/architecture.md`, Build Tool, Package Manager, and
Node.js).

The tooling image and `@playwright/test` are updated in one `Playwright` pull
request, because the browsers of the image must be the ones that the package
expects. The image has no release timestamp, so Renovate raises its update at
once and adds the package to the same pull request when the package reaches
the minimum release age; until then `UI Checks` fails, and the pull request is
not merged.

Renovate updates the lockfile with the npm line of the tooling image
(`constraints.npm` in `renovate.jsonc`, which Renovate does not update either:
it changes by hand with the Node.js line) and with its own copy of the
settings of `.npmrc` (`npmrc` in `renovate.jsonc`), kept in sync with it. The
copy differs in one setting,
`allow-remote=all`: under `allow-remote=none`, the
`npm install --package-lock-only` command that updates the lockfile refuses
the registry tarball of a package that declares `bundleDependencies`, such as
a platform package of Tailwind CSS (npm/cli#9800). Installs still use
`.npmrc`, so `UI Checks` refuses a lockfile that records a dependency fetched
from a URL. The copy is removed once an npm release of that line fixes the
bug.

**Orval.** Its updates get their own pull request, outside the group of minor
and patch updates, because a new version can generate a different API client
and the Mend Renovate App cannot run the generator on its branches. A
maintainer runs `scripts/tooling.sh generate` on the branch of the pull
request and commits the result; until then `UI Checks` fails if the generated
client changes (Workflow Inventory).

**Sentinel version.** Renovate proposes a new supported Sentinel version once
its GitHub Release is published, outside the weekly schedule, because the UI
release deployed on a Sentinel host must support the Sentinel version
deployed there (`docs/architecture.md`, Backend Contract). Its pull request
changes only `contract/sentinel-version`, so `UI Checks` fails until a
maintainer completes it on its branch:

1. `scripts/sentinel-contract.sh update` replaces the pinned OpenAPI document
   with the release asset of the new version;
2. `scripts/tooling.sh generate` regenerates the API client;
3. the code and the screen documents follow the changed operations, read in
   Sentinel's specifications at the tag of the new version (`AGENTS.md`,
   Sentinel as an External Authority); and
4. the pull request states which screens the API changes affect
   (`docs/conventions.md`, Pull Request Requirements).

Its title uses the `feat(deps):` prefix, a minor release signal, because every
change of the supported version carries one (`docs/architecture.md`, Backend
Contract).

Routine updates follow the `schedule:earlyMondays` schedule and use the
`ci(deps):` title prefix, or `chore(deps):` for the tooling image and the npm
dependencies, which are not used only by CI; neither carries a release signal
(`docs/conventions.md`, Versioning). Renovate never merges its own pull
requests: `automerge` is disabled, and each one is merged like any other pull
request, after the repository owner authorizes the merge.

Known vulnerabilities are handled by these complementary mechanisms:

- **GitHub Dependabot alerts** (with the Dependency graph) monitor the
  dependencies as advisories are published. Dependabot security updates stay
  disabled, so that Renovate remains the only component that creates
  dependency pull requests.
- **Renovate vulnerability-fix pull requests** (`vulnerabilityAlerts`) are
  raised from those alerts immediately, outside the weekly schedule and
  without Renovate's minimum release age, labeled `security`, with the
  `fix(deps):` prefix, so that a merged security fix is a patch release
  signal. This requires the Mend Renovate App to have read access to
  Dependabot alerts. Renovate raises them only for the dependencies that
  `package.json` declares. A vulnerable transitive dependency whose fixed
  version lies within the ranges that its dependents allow gets its fix from
  the next lock file maintenance pull request, once the fixed version reaches
  the minimum release age, or earlier by hand (below); a fix outside those
  ranges needs an update of the dependency that requires it. A lock file
  maintenance pull request that delivers a security fix is merged with a
  `fix(deps):` title, so that it is a patch release signal too.
- **A fix younger than the minimum release age** cannot be resolved by npm,
  which applies the age when Renovate updates the lockfile: Renovate then
  reports an artifact update problem on the pull request, or opens none until
  the fixed version reaches the age. A maintainer delivers it earlier from a
  branch, excluding only the fixed package from the age
  (`docs/architecture.md`, Build Tool, Package Manager, and Node.js), and
  merges the pull request with a `fix(deps):` title. For a direct dependency:

  ```bash
  scripts/tooling.sh npm install --min-release-age-exclude=<package> <package>@<version>
  ```

  For a transitive dependency, within the ranges that its dependents allow:

  ```bash
  scripts/tooling.sh npm update --min-release-age-exclude=<package> <package>
  ```

- **The dependency audit** of `UI Checks` (Workflow Inventory, Dependency
  audit) blocks a dependency change that leaves a known vulnerability in the
  locked dependency set. It audits the whole set, so while any advisory is
  open, every dependency pull request fails, a fix pull request for another
  advisory included. A maintainer then combines the pending fixes in one
  branch with the commands above and merges it with a `fix(deps):` title. An
  advisory without a fix that the dependency ranges allow holds every
  dependency change and every release-please pull request back until one is
  available.

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
