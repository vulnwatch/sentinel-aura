# Deployment

This document owns Sentinel Aura's CI pipeline, including the conventions that
every workflow follows, the automated dependency updates, and the local Git
hooks that complement the pipeline, and its release process, including how a
deployment verifies a release. The structure of the tooling and the rules for
shell code in workflows, scripts, and hooks belong to `docs/conventions.md`
(Shell Scripting); the rules for branches, commits, and pull requests belong
to `docs/conventions.md` (Git Conventions).

## Contents

- [CI Pipeline](#ci-pipeline)
  - [Workflow Inventory](#workflow-inventory)
  - [Workflow Conventions](#workflow-conventions)
  - [Dependency Updates](#dependency-updates)
  - [Local Git Hooks](#local-git-hooks)
- [Release Process](#release-process)
  - [Versions](#versions)
  - [Supported Sentinel Version](#supported-sentinel-version)
  - [Release Chain](#release-chain)
  - [Image](#image)
  - [Supply-Chain Artifacts](#supply-chain-artifacts)
  - [Publication and Immutability](#publication-and-immutability)
  - [Verifying a Release](#verifying-a-release)
  - [Secrets and Settings](#secrets-and-settings)

## CI Pipeline

Continuous integration runs entirely on GitHub Actions. This section is the
authoritative reference for the workflows that exist, the checks that block a
merge, the conventions that every workflow follows, and the local Git hooks
that run a subset of the checks before a change reaches CI.

### Workflow Inventory

| Workflow | Trigger | Purpose | Blocking |
|----------|---------|---------|----------|
| `ci.yml` | Push to `master`, pull request to `master`, manual | `Shell Lint` job: `scripts/lint-shell.sh`, which runs `shellcheck` and `shfmt` on every tracked shell script, library, and Git hook, and `actionlint` on every workflow, each from its official image, pinned by version and digest (`docs/conventions.md`, Shell Scripting). `UI Checks` job: the dependency audit when the run can change the dependencies (Dependency audit), then `scripts/ci.sh ui-checks` (Local run): `scripts/sentinel-contract.sh verify`, which checks that the pinned OpenAPI document is identical to the release asset of the supported Sentinel version and that the version's image tag names the pinned image digest (`docs/architecture.md`, Backend Contract); the generation of the API client, which fails the job when the result differs from the committed client (`docs/architecture.md`, API Client Generation); then the type check, lint, format check, and unit and component tests of the UI (`docs/conventions.md`, Code Conventions), run through `scripts/tooling.sh` like every Node.js command (`docs/architecture.md`, Development Environment); then the build and the test of the image that serves the UI in production (Image test), and the generation and check of its SBOM (Release Process, Supply-Chain Artifacts); then a check that `node_modules/` holds no file in the working tree. `End-to-End Tests` job: `scripts/ci.sh e2e` (Local run): `scripts/dev-env.sh e2e`, which builds the image that serves the UI in production and runs the end-to-end tests against it in Chromium and Firefox (End-to-end tests), then `scripts/dev-env.sh test`, which checks the development proxy (End-to-end tests). `Coverage Upload` job: uploads the coverage report of the tests to Codecov (Coverage reporting) | Yes |
| `pr-metadata.yml` | Pull request to `master` opened, edited, reopened, or synchronized | `PR Metadata` job: validates the title format and length and the issue linkage (`docs/conventions.md`, Pull Request Requirements) with `scripts/check-pr-metadata.sh` | Yes |
| `renovate-validation.yml` | Pull request opened, synchronized, or reopened; manual | Validates `renovate.jsonc` and performs a read-only Renovate dependency lookup (Dependency Updates) | No |
| `image-scan.yml` | Weekly schedule, manual | `Image Scan` job: builds the image that serves the UI in production from the branch of the run, `master` unless a manual run names another, and scans its operating system packages for known vulnerabilities with `scripts/image.sh scan`. `Scan Tracking Issue` job, on `master` only: opens, updates, or closes the issue that tracks the fixable HIGH and CRITICAL ones (Image vulnerability scan) | No |
| `release-please.yml` | Successful `ci.yml` run of a push to `master` | `Release Please` job: opens or updates the release pull request, and, once it is merged, creates the version tag and the draft GitHub Release (Release Process, Release Chain) | No |
| `release.yml` | Push of a version tag | `Build Release Image` job: builds and tests the image of the tagged commit and generates its SBOM. `Publish Release` job: publishes the image, its SBOM, and its attestations, then the GitHub Release (Release Process, Release Chain) | No |

**Blocking** means that the workflow yields a required status check of the
`master` branch protection: a pull request cannot merge until `Shell Lint`,
`UI Checks`, `End-to-End Tests`, `PR Metadata`, and the `codecov/patch`
status that Codecov publishes for the upload of `Coverage Upload` (Coverage
reporting) pass on its latest commit, and its branch must be up to date with
`master`. A non-blocking workflow shows a red status when it fails, but never
prevents a merge.

**Local run.** The `UI Checks` and `End-to-End Tests` jobs run their checks
through `scripts/ci.sh` (Workflow Conventions, Checks in a script), which also
runs them locally, for one job or for all of them. `scripts/ci.sh all`, the
check to run before pushing (`docs/conventions.md`, Checks), runs the checks
of the three jobs, including `scripts/lint-shell.sh` as `Shell Lint` runs it,
and fails when any of them fails.

The checks read the working tree and change no tracked file, so the command
runs before a commit. The dependency audit runs locally as for a pull request
(Dependency audit). `scripts/ci.sh` does not run what needs a CI run:
`PR Metadata`, which needs the pull request; `renovate-validation.yml`; the
image scan; the upload of `Coverage Upload`; and the release workflows. The
SBOM check needs `jq` on the host, which `CONTRIBUTING.md` (Development
Setup) lists.

`scripts/check-pr-metadata.sh` also runs locally, on its own, outside a pull
request. It validates the title of a Renovate pull request (author
`renovate[bot]`, branch `renovate/*`) and of a release-please pull request
(branch `release-please--*`), but exempts both from the issue linkage, as
`docs/conventions.md` (Issues and work units) allows. When such a pull request
gains human-directed scope, its `Closes #<issue>` line is checked in review,
not by the script.

**Coverage reporting.** The tests of `UI Checks` measure coverage with
Istanbul (`docs/architecture.md`, Static Checks and Tests), and when every
check of the job passes, the job retains the Clover report as a seven-day
workflow artifact; it never receives `CODECOV_TOKEN`, because it runs the code
of the dependencies. The separate `Coverage Upload` job, which runs after a
successful `UI Checks`, uploads only that report to Codecov, with a pinned
Codecov CLI version (Dependency Updates) and the `CODECOV_TOKEN` repository
secret, the upload token that Codecov issues for the repository. On a pull
request, a failed upload fails the job, which can be re-run on its own while
the artifact is retained; on a push to `master` or a manual run it does not
fail the run, so that a Codecov outage does not mark `master` red after a
merge. The repository `codecov.yml` makes the resulting `codecov/patch` status
informational, so it always passes and no coverage threshold gates a merge,
and has Codecov publish it as soon as the upload is processed rather than
waiting for, or failing because of, the other checks. `codecov/patch` is a
required check, so a pull request cannot merge before its coverage report is
visible; while Codecov cannot process uploads, merges wait until it recovers.
`codecov.yml` disables the `codecov/project` status, which the organization's
Codecov plan does not publish, and maps the paths of the report, which the
tooling container writes under `/work/`, to the repository's.

**Dependency audit.** `scripts/tooling.sh audit` runs `npm audit signatures`,
which verifies the registry signatures and the provenance attestations of the
installed packages, and `npm audit`, which reports the known vulnerabilities
of the locked dependency set, development dependencies included; each fails on
any finding. `UI Checks` runs it, as a blocking step before its other checks,
only when the run can change or ship the locked dependency set: a pull request
or push that changes `package.json`, `package-lock.json`, or `.npmrc`, a
release-please pull request, a manual run, or a run whose changed files cannot
be determined. `scripts/dependency-audit-scope.sh` takes that decision;
locally, `scripts/ci.sh ui-checks` takes it as for a pull request. Other
changes skip the audit, so a vulnerability disclosed against an unchanged
lockfile reaches the repository as a Dependabot alert and a fix (Dependency
Updates) rather than as a failure of unrelated work, while a dependency
change cannot merge with a known vulnerability.

**Image test.** `scripts/image.sh build` runs the production build through
`scripts/tooling.sh`, then builds the image of `docs/architecture.md`
(Packaging and Serving), with its labels (Release Process, Image), from the
`Containerfile`, so Node.js never enters the image. `scripts/image.sh test`
runs that image with the settings of the Pod Security `restricted` profile,
without a network, and fails unless:

- the image carries exactly the labels that the build sets, with their
  values;
- the image declares a numeric non-root user, no process of the container
  runs as root, and the image holds no Node.js;
- the web root holds exactly the production build, and nginx has no server
  but the one of `nginx/default.conf`;
- every path outside the asset directory, `/auth/callback`, `/health`,
  `/ready`, and the asset directory without its trailing slash included, gets
  the entry document with `Cache-Control: no-cache`, also when the request
  names another host;
- a file of the asset directory gets its content, its type, and a year of
  immutable caching, and a missing file and the directory itself get a `404`;
- every response carries each security header of `docs/architecture.md`
  (Security Headers) exactly once, with the documented Content Security
  Policy, a `Permissions-Policy` that only disables features, no
  `Strict-Transport-Security`, and no `Location`; and
- the access log records a request but not the value of its `Cookie` header.

The script checks the labels, the user, the content, the processes, and the
access log through Docker; the `image` project of the end-to-end tests checks
the responses, in the network namespace of the container, where
`scripts/tooling.sh e2e` runs it and reaches nginx on the loopback interface
(`docs/conventions.md`, End-to-End Tests).

**End-to-end tests.** The `End-to-End Tests` job runs beside `UI Checks`,
through `scripts/ci.sh e2e` (Local run). `scripts/dev-env.sh e2e` builds the
image as `scripts/image.sh build` does, then, for Chromium and then Firefox,
creates an end-to-end environment with Docker Compose: a new backend from
Sentinel's image at the supported version and pinned digest, loaded with the
example dataset, the UI's image, and the reverse proxy in front of them, whose
network namespace the tests share (`docs/architecture.md`, Development
Environment). It runs the tests of `test/e2e/` except those of the UI's
image alone, `image.spec.ts`; the tests compare the reference screenshots in
Chromium (`docs/conventions.md`, End-to-End Tests). It then removes the
environment. Next, `scripts/dev-env.sh test` checks the development proxy
against a backend of its own: that no container of the backend publishes a
port, and that the development server publishes its port on the loopback
interface only; then, with the `dev-server` project of the end-to-end tests,
in the network namespace of the development server, the same-origin checks
that the browsers run against the reverse proxy (`docs/conventions.md`,
End-to-End Tests). The job needs no permission beyond reading the
repository, and no secret:

- when a check fails, it retains `test-results/e2e/` — the report of each
  Playwright project, in `test-results/e2e/<project>/report/`, with the
  screenshots that differ from their references and the traces of the
  failed tests — as the seven-day workflow artifact `e2e-results`. The
  traces hold the session cookies of the run's dataset backends, which no
  longer exist; and
- on a pull request whose tests pass, it retains the production build, with
  `contract/sentinel-version` and `contract/sentinel-image-digest`, as the
  seven-day workflow artifact `ui-preview`, which `scripts/dev-env.sh
  preview` downloads (`docs/architecture.md`, Development Environment, Local
  preview). A rerun of the job replaces it, so a maintainer reruns it to
  preview a pull request whose artifact expired.

**Image vulnerability scan.** `image-scan.yml` builds the image every Monday
from `master`, and on demand from the branch of the run, and scans it with
Trivy for known vulnerabilities of its operating system packages; the npm
dependencies have the dependency audit. `scripts/image.sh scan` runs Trivy
from its official image, which the script pins by version and digest, in a
container with the runner's user and group IDs and without capabilities,
which reads an archive of the UI's image, receives neither the Docker socket
nor a token, and writes its reports to its output. The scan is advisory: a
finding never fails the run, and only a scan that does not complete does. The
`Image Scan` job, which runs the scanner, only reads the repository; it hands
the report of the fixable HIGH and CRITICAL vulnerabilities to the `Scan
Tracking Issue` job, the only one that can write issues, where
`scripts/image-scan-issue.sh` opens an issue labeled `security` that lists
them, or updates the open one, and closes it once a scan finds none. The issue
tracks the image of `master`: a manual run on another branch, such as the
branch of a Renovate pull request, scans the image of that branch but skips
the `Scan Tracking Issue` job. Every run retains the complete report, with
every severity and the vulnerabilities without a fix, as a 90-day workflow
artifact. A fix usually arrives as a Renovate pull request that updates the
base image of the `Containerfile` (Dependency Updates), which a maintainer
merges with a `fix(deps):` subject, so that it is a patch release signal
(`docs/conventions.md`, Workflow, Squash merge); until the base image
contains the fix, the issue stays open. nginx itself comes from nginx.org's
package repository, not from Alpine's, so the scan does not match nginx's own
advisories: a security release of nginx arrives as a Renovate update of the
base image, which a maintainer merges with a `fix(deps):` subject as well.

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

**Pinned tools.** A tool that a workflow installs, itself or through a script
that it runs — downloaded directly, run as a container image, or requested
through an action's `version:` input — MUST be pinned to an explicit version
and never resolve to the latest release. A container image is pinned by
version and digest. Every pinned version is tracked by Renovate (Dependency
Updates).

**Checkout credentials.** Every `actions/checkout` step sets
`persist-credentials: false`: no workflow pushes to the repository through
Git, and release-please, which creates tags and branches, does so through
GitHub's API (Release Process), so the token stays out of the working copy's
Git configuration.

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
release or publication leaves an indeterminate state. Nor does the image
scan, so that a run that is writing its tracking issue finishes first.

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

**Checks in a script.** The jobs of `ci.yml` run their checks through a script
that also runs them locally, never as steps of their own, so that the list of
checks exists once and a branch that passes them locally does not fail them in
CI: `Shell Lint` runs `scripts/lint-shell.sh`, and `UI Checks` and `End-to-End
Tests` run `scripts/ci.sh` (Workflow Inventory, Local run). The workflow keeps
what the script must not receive or cannot decide: a step that needs a secret
or a write permission, a condition on the event of the run and the check that
it gates, such as the dependency audit scope and the audit, and the steps that
use an action, such as the artifact uploads. The script receives neither a
secret nor a write permission.

### Dependency Updates

The hosted Mend Renovate GitHub App reads `renovate.jsonc` from the repository
root and opens the dependency-update pull requests; no workflow of this
repository runs the bot or creates its pull requests. It tracks:

- the SHA-pinned actions, through the `github-actions` manager, which updates
  the SHA and its version comment together;
- the base image of the `Containerfile`, by version and digest, through the
  `dockerfile` manager;
- the PostgreSQL, Redis, and nginx images of `compose.yaml`, which runs the
  backend of local development, the end-to-end tests, and the local preview
  (`docs/architecture.md`, Development Environment), by version and digest,
  through the `docker-compose` manager. It skips Sentinel's image, whose
  version and digest `scripts/dev-env.sh` takes from `contract/` (Sentinel
  version), and the UI's image, which is built locally. The nginx image of
  `compose.yaml` is the base image of the `Containerfile`, and both are
  updated in one `nginx` pull request;
- the Renovate image of `renovate-validation.yml`, by version and digest,
  through a custom regex manager;
- the tooling image of `scripts/tooling.sh`, by version and digest, through a
  custom regex manager;
- the images of `shellcheck`, `shfmt`, and `actionlint` in
  `scripts/lint-shell.sh` and the Trivy image of `scripts/image.sh`, which
  scans the image and generates its SBOM, by version and digest, through a
  custom regex manager;
- the `version:` inputs of actions that the `github-actions` manager does not
  track (the Codecov CLI of `codecov/codecov-action` in `ci.yml`), through a
  custom regex manager that reads a
  `# renovate: datasource=<datasource> depName=<name>` hint comment placed
  directly above the input, for example
  `# renovate: datasource=github-releases depName=codecov/codecov-cli`; the
  value is the release tag. A new such input follows the same pattern, so that
  Renovate tracks it from the start;
- the npm dependencies of `package.json` and the lockfile, and the versions
  that the overrides of `package.json` force (below), through the `npm`
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
Node.js), nor the major version of `@types/node`, the types of the Node.js of
that line: both change by hand, together.

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

**Reference screenshots.** An update that changes how the UI renders, such as
one of the tooling image and its browsers, Tailwind CSS, or React Aria, fails
`End-to-End Tests` while a reference screenshot differs (`docs/conventions.md`,
End-to-End Tests). A maintainer checks the differences in the `e2e-results`
artifact (Workflow Inventory, End-to-end tests), runs
`scripts/dev-env.sh update-screenshots` on the branch of the pull request,
and commits the result, which the pull request diff then shows. Like the
regeneration of an Orval update, the commit only regenerates files from the
updated dependency.

**Local backend.** `End-to-End Tests` runs `scripts/dev-env.sh test` on every
pull request, so an update of `vite`, the tooling image, or an image of
`compose.yaml` that breaks the development proxy or the backend of local
development fails it (Workflow Inventory, End-to-end tests).

**Sentinel version.** Renovate proposes a new supported Sentinel version once
its GitHub Release is published, outside the weekly schedule, because the UI
release deployed on a Sentinel host must support the Sentinel version
deployed there (`docs/architecture.md`, Backend Contract; Release Process,
Supported Sentinel Version). No minimum release age delays it, and when
Renovate limits the pull requests that it opens in an hour, it opens this one
before the others (`prPriority` in `renovate.jsonc`). The Mend Renovate App
runs on the repository every few hours; a maintainer starts a run at once
with the checkbox at the end of the Dependency Dashboard issue. Its pull
request changes only `contract/sentinel-version`, so `UI Checks` fails until
a maintainer completes it on its branch:

1. `scripts/sentinel-contract.sh update` replaces the pinned OpenAPI document
   with the release asset of the new version, and the pinned image digest
   with the one that its tag names, then regenerates the API client;
2. the code and the documents of this repository follow what changed between
   the two versions: the operations of the pinned OpenAPI document, and the
   Sentinel sections that the documents cite, read at the tag of the new
   version (`AGENTS.md`, Sentinel as an External Authority);
3. `End-to-End Tests` passes against backends of the new version: the
   end-to-end tests, after `scripts/dev-env.sh update-screenshots` where the
   new version's dataset changes what a screen shows, and the test of the
   development proxy, which routes and forwards requests as before and
   through which a dataset user signs in (Workflow Inventory, End-to-end
   tests); and
4. the pull request states which screens the API changes affect
   (`docs/conventions.md`, Pull Request Requirements).

Step 1, like the regeneration of an Orval update, only regenerates files from
the updated dependency, and so does the regeneration of the reference
screenshots in step 3, so the pull request stays exempt from an issue
(`docs/conventions.md`, Issues and work units). When step 2 changes code or
documents, that work is human-directed scope: it gets a tracking issue, which
the pull request closes.

Its title uses the `feat(deps):` prefix, a minor release signal, because every
change of the supported version carries one (`docs/architecture.md`, Backend
Contract).

Routine updates follow the `schedule:earlyMondays` schedule and use the
`ci(deps):` title prefix, or `chore(deps):` for the tooling image, the images
of the shell lint tools and Trivy, the npm dependencies, the base image of the
`Containerfile`, and the images of `compose.yaml`, which are not used only by
CI; neither carries a release signal (`docs/conventions.md`, Versioning).
Renovate never merges its own pull requests: `automerge` is disabled, and each
one is merged like any other pull request, after the repository owner
authorizes the merge.

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
  ranges needs an update of the dependency that requires it, or an override
  (below). A lock file maintenance pull request that delivers a security fix
  is merged with a `fix(deps):` subject, so that it is a patch release signal
  too (`docs/conventions.md`, Workflow, Squash merge).
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

- **An override** (`overrides` in `package.json`) delivers a fix outside the
  ranges that the dependents of the vulnerable package allow, when no version
  of the dependencies that require it allows a fixed one. It is an exception
  that requires the repository owner's decision (`docs/conventions.md`,
  Dependency Admission). It forces the smallest version that fixes the open
  advisories, as an exact version, only under the dependent that pins the
  vulnerable version, and only for the versions of that dependent that pin
  one, so that it stops applying by itself once the dependencies move to a
  later version of the dependent:

  ```json
  "overrides": {
    "<dependent>@<range>": { "<package>": "<version>" }
  }
  ```

  After the change of `package.json`, `scripts/tooling.sh npm install`
  updates the lockfile, with `--min-release-age-exclude=<package>` when the
  version is younger than the minimum release age. `package.json` cannot hold
  comments, so the pull request that adds the override records the
  advisories that it fixes, the justification, the owner's decision, and the
  condition for its removal; it is merged with a `fix(deps):` title, and
  `git blame` on the key of the override leads to it. Renovate tracks the
  forced version and proposes its minor and patch updates, but no major
  update, which could break the dependent (`renovate.jsonc`). Once the
  dependencies allow a version of the dependent that requires a fixed
  version, for example after an update of the dependency that requires the
  dependent, a pull request removes the override and updates the lockfile.
- **The dependency audit** of `UI Checks` (Workflow Inventory, Dependency
  audit) blocks a dependency change that leaves a known vulnerability in the
  locked dependency set. It audits the whole set, so while any advisory is
  open, every dependency pull request fails, a fix pull request for another
  advisory included. A maintainer then combines the pending fixes in one
  branch with the commands above and merges it with a `fix(deps):` title. An
  advisory without a fix that the dependency ranges allow holds every
  dependency change and every release-please pull request back until a fix is
  available within those ranges or the owner decides on an override.
- **The image vulnerability scan** (Workflow Inventory, Image vulnerability
  scan) covers the operating system packages of the image, which none of the
  mechanisms above sees.

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
| `pre-commit` | `scripts/lint-shell.sh` on the staged files: `shellcheck` and `shfmt` on the staged shell scripts and hooks and `actionlint` on the staged workflows, selected as the `Shell Lint` job selects the tracked ones and run from the same images; then `gitleaks` on the staged changes |
| `pre-push` | Blocks pushes to `master` and pushes of tags (`docs/conventions.md`, Git Conventions) |

The hooks are a supplementary safety net: they can be bypassed, while CI and
the branch protection of `master` cannot. The shell and workflow checks of
`pre-commit` read the working-tree content of the staged files; `gitleaks`
scans the staged content.

The shell and workflow checks need no local installation:
`scripts/lint-shell.sh` runs each tool from the image that it pins by version
and digest, through Docker Engine (`docs/architecture.md`, Development
Environment), so `pre-commit`, `scripts/ci.sh all`, and `Shell Lint` run the
same versions, and a Renovate update reaches all of them at once (Dependency
Updates). A commit that stages no shell script, hook, or workflow starts none
of the tools. When Docker Engine cannot run the images, because the setup is
not the supported one or an image cannot be downloaded, `pre-commit` warns and
the commit proceeds, while `scripts/ci.sh all` fails (Workflow Inventory, Local
run).

**Secret scanning.** `gitleaks git --staged` scans the staged changes with
`.gitleaks.toml`, which extends gitleaks' default rule set. It needs
[gitleaks](https://github.com/gitleaks/gitleaks) on the host, 8.19.0 or later,
whose `git` subcommand it runs, and is optional: when it is not installed,
`pre-commit` warns and the commit proceeds. It is local only: no workflow
scans for secrets, and GitHub secret scanning with push protection is the
server-side check. A confirmed false positive of a non-secret value is
allowlisted in `.gitleaks.toml` by a regular expression — never by path — with
a comment that explains why the value is not a secret.

## Release Process

[release-please](https://github.com/googleapis/release-please) automates the
versions, the changelog, and the GitHub Releases, from the commit subjects on
`master` (`docs/conventions.md`, Versioning). A release is one version of the
UI: its image, which a deployment runs by digest, the image's SBOM and signed
attestations, and the GitHub Release that lists its changes and holds them.

### Versions

The UI has one version, which follows Semantic Versioning 2.0.0. Its source of
truth in the repository is the `version` of `package.json`: release-please
updates it in the release pull request, together with `package-lock.json`,
`CHANGELOG.md`, and its record of the current version in
`.release-please-manifest.json`, and tags the merged release as
`v<major>.<minor>.<patch>`. The image and the GitHub Release take their
version from the tag. Until the first release, `package.json` declares
`0.0.0`, which no release has.

| Commit subject on `master` | Current version | Release |
|---|---|---|
| `fix:` | Any | Patch |
| `feat:` | Any | Minor |
| `fix!:` or `feat!:` | `0.x.y` | Next minor |
| `fix!:` or `feat!:` | `1.0.0` or later | Next major |
| `docs:`, `chore:`, `ci:`, `test:`, `refactor:` | Any | None on their own |

| Release | Meaning |
|---|---|
| Major | A change that users or a deployment must act on, such as the removal of a screen or a change of how the Sentinel host serves the image (`docs/architecture.md`, Packaging and Serving) |
| Minor | A new screen or capability, or the support of another Sentinel version (Supported Sentinel Version) |
| Patch | A fix, including a security fix and a dependency update that fixes a vulnerability (Dependency Updates) |

**Before 1.0.0.** The first release is `0.1.0` (`initial-version`). While the
version is `0.x.y`, a breaking change advances the minor version
(`bump-minor-pre-major`), so no commit reaches `1.0.0` by itself. The
repository owner decides when the UI reaches `1.0.0`; the squash commit of a
`feat` or `fix` pull request then carries the footer `Release-As: 1.0.0` in
its body, which the maintainer checks in the merge dialog before confirming
the merge, because a footer only in the pull request description has no
effect.

**Changelog.** release-please writes `CHANGELOG.md` and the notes of each
GitHub Release. They list the `feat` and `fix` commits, under Features and
Bug Fixes, and hide the other types, so commits of only those types open no
release pull request. Nobody edits `CHANGELOG.md` by hand.

**Configuration.** `release-please-config.json` holds the release policy and
changes only through a reviewed pull request. `.release-please-manifest.json`
is release-please's record of the current version, which nobody edits by
hand.

### Supported Sentinel Version

Each release supports exactly one Sentinel version: the one that
`contract/sentinel-version` declares at its tagged commit, against which its
end-to-end tests passed (`docs/architecture.md`, Backend Contract). The image
states it in the label `io.github.vulnwatch.sentinel-aura.sentinel-version`
(Image), which the image's digest, and so its attestations, cover, and the
notes of its GitHub Release repeat it. A Sentinel host deploys the release
that supports its Sentinel version (Sentinel `docs/deployment.md`, Sentinel
Host).

Supported means tested together, also from Sentinel 1.0.0 on: every Sentinel
version that a host deploys needs a release of the UI that supports it, even
when the UI does not change. Every change of the supported version is
therefore a `feat(deps):` commit, a minor release signal (Dependency Updates,
Sentinel version), and a maintainer merges the release pull request once that
change is on `master`, so that a host can deploy the new Sentinel version.
When several changes of the supported version merge before a release, only
the last one gets a release: no release supports the Sentinel versions in
between, and a host that upgrades skips them.

### Release Chain

1. Pull requests are squash-merged into `master` (`docs/conventions.md`,
   Workflow).
2. After every successful `ci.yml` run of a push to `master`,
   `release-please.yml` opens the release pull request, or updates it, with
   the next version in `package.json` and `package-lock.json`, the new entry
   of `CHANGELOG.md`, and the manifest. It stays open and follows the
   releasable commits that land on `master`.
3. A maintainer merges the release pull request after the repository owner
   authorizes the merge, like any other pull request (`docs/conventions.md`,
   Pull Request Requirements). Its required checks run as on every pull
   request, the dependency audit included (Workflow Inventory, Dependency
   audit), and its branch is up to date with `master`, so the merged commit
   is the one that the checks passed. A release pull request whose audit
   fails is not merged: a fix lands on `master` first, and release-please
   updates the release pull request.
4. The `ci.yml` run of that merge starts `release-please.yml` again, which
   creates the version tag through the Git references API, then a draft
   GitHub Release with the notes of the changelog (`draft` and
   `force-tag-creation` in `release-please-config.json`).
5. The tag starts `release.yml`, whose jobs run one after the other:
   - `Build Release Image` builds the image of the tagged commit with the
     labels of the release (Image), runs the test of the image as `UI
     Checks` does (Workflow Inventory, Image test), generates and checks its
     SBOM (Supply-Chain Artifacts), and retains the image and the SBOM as a
     seven-day workflow artifact. It runs the code of the dependencies, in
     the tooling containers, so it only reads the repository.
   - `Publish Release` runs no code of the dependencies. Before anything
     else, `scripts/release.sh check` verifies that the tag is a version tag
     whose version `package.json` declares, and that it names a draft
     release whose commit is the tag's and no published release.
     `scripts/image.sh push` then pushes the
     image, after checking that it is labeled as the release, and returns
     the digest that the registry names for its tag; `actions/attest`
     attests the image's SBOM and build provenance; and
     `scripts/release.sh publish` attaches the assets, writes the image and
     the supported Sentinel version into the notes, and publishes the draft,
     as its last action.

A tag that release-please did not create, or that names another commit than
its draft release, publishes nothing. Neither workflow cancels a run in
progress (Workflow Conventions, Concurrency).

### Image

A release publishes one image, `ghcr.io/vulnwatch/sentinel-aura`, under one
tag, its exact version, such as `0.1.0`: there is no `latest`, no
`<major>.<minor>`, and no tag for `master`. A floating tag would move before
the release that it names is published, and a deployment runs one exact
version (Supported Sentinel Version). The registry does not enforce the
immutability of tags, so a deployment runs the image by the digest that the
tag names (Verifying a Release).

Every build of the image by `scripts/image.sh build` carries these labels,
which replace those of the base image. The image test fails when the image
carries another label or another value (Workflow Inventory, Image test), so
no label of the base image describes this image:

| Label | Value |
|---|---|
| `org.opencontainers.image.title` | `sentinel-aura` |
| `org.opencontainers.image.description` | `Web user interface for Sentinel` |
| `org.opencontainers.image.source`, `org.opencontainers.image.url` | `https://github.com/vulnwatch/sentinel-aura`, through which the registry links the image to the repository |
| `org.opencontainers.image.licenses` | `Apache-2.0` |
| `org.opencontainers.image.version` | The version of the release, or `dev` for a build outside a release |
| `org.opencontainers.image.revision` | The commit that the image is built from |
| `org.opencontainers.image.created` | The time of that commit, in UTC, so that two builds of one commit carry the same labels |
| `io.github.vulnwatch.sentinel-aura.sentinel-version` | The supported Sentinel version (Supported Sentinel Version) |
| `maintainer` | Empty, in place of the maintainers of the base image |

### Supply-Chain Artifacts

Each release publishes three records of its image:

| Record | Meaning | Publication |
|---|---|---|
| CycloneDX SBOM | Inventory of the components of the image | The release asset `sentinel-aura-<version>.sbom.cdx.json`, where `<version>` omits the tag's `v` |
| SBOM attestation | Signed claim that the SBOM describes the image's digest | GitHub's attestations API, the registry, beside the image, and the release asset `sentinel-aura-<version>.sbom.sigstore.json` |
| Build provenance | Signed SLSA provenance of the image's digest: the repository, the commit, the workflow, and the run that built and published it | GitHub's attestations API, the registry, and the release asset `sentinel-aura-<version>.provenance.sigstore.json` |

The subject of both attestations is
`ghcr.io/vulnwatch/sentinel-aura@sha256:<digest>`, never a tag. Each bundle
asset is the Sigstore bundle that `actions/attest` produced, so a deployment
can verify the image without the attestations API or the registry. The
attestations create no storage record (`create-storage-record: false`), which
would only add the registry to the organization's metadata of linked
artifacts and need a further permission.

**SBOM scope.** `scripts/image.sh sbom` generates the SBOM with Trivy, run
offline from the image that the script pins, and checks it. One CycloneDX
document, whose subject is the image, named `ghcr.io/vulnwatch/sentinel-aura`
with the image's version, holds two inventories:

- the operating system packages of the image, nginx included, which Trivy
  reads from the image; and
- the production dependencies of `package-lock.json`, which the build bundles
  into the scripts of the UI. The bundle keeps none of their manifests, so a
  scan of the image cannot find them, and Trivy reads them from the lockfile,
  without the development dependencies, which do not ship.

The check fails unless the document is CycloneDX, describes the image and its
version, lists the image's nginx package and exactly the production
dependencies of the lockfile, at their locked versions, and has unique
references, which its dependency graph resolves. `UI Checks` runs the same
generation and check on every pull request (Workflow Inventory), so a change
that breaks the SBOM fails before a release. The SBOM is an inventory, not a
vulnerability report: the image scan and the dependency audit report the
vulnerabilities (Workflow Inventory). It can list a production dependency of
which the build bundles no code.

### Publication and Immutability

A version is released when its GitHub Release is published, which
`scripts/release.sh publish` does last, once both attestations exist and every
asset is attached.

- **Before publication** the version is not released, even when its image tag
  exists, and a deployment does not use it. A rerun of failed jobs or of all
  jobs is allowed: it can rebuild the image, point its tag to a new digest,
  add attestations of that digest, and replace the draft's assets.
- **After publication** the image tag, the Git tag, and the assets are final.
  `scripts/release.sh check` fails for a published release before the first
  push, so a rerun neither moves the image tag nor adds an attestation. A
  correction ships as a new release.

Release immutability is enabled for the repository (Secrets and Settings). It
locks the Git tag and the assets of every release published while it is
enabled, and adds a release attestation, which `gh release verify` checks; it
does not protect the image tag, which the check of `Publish Release` protects.
`scripts/release.sh publish` warns when the release that it published is not
immutable.

| Failure of a `release.yml` run | Repair |
|---|---|
| `Build Release Image` fails for a transient cause, such as a download | Re-run failed jobs |
| `Build Release Image` fails for a cause in the tagged commit | The version cannot be fixed, because only release-please creates tags (`docs/conventions.md`, Workflow) and a run publishes only the commit of the draft release: the release stays a draft, and the fix ships in the next release |
| `Publish Release` fails while the release is a draft | Re-run failed jobs. A rerun can push a new digest; the superseded one was never part of a published release |
| `Publish Release` fails because release-please created the tag but no draft release | Re-run the `release-please.yml` run that created the tag, which creates the draft, then re-run failed jobs |
| The seven-day artifact expired while the release is a draft | Re-run all jobs |
| The release is published | Nothing to repair: a rerun fails at `scripts/release.sh check`, before any push or attestation |

### Verifying a Release

A deployment uses a version only once its GitHub Release is published,
resolves the version's tag to its digest once, verifies the image by that
digest, and deploys it by the same digest, so that the deployed image is the
verified one. The commands need Docker with its Buildx plugin and the GitHub
CLI, `gh`, signed in:

```bash
set -euo pipefail

VERSION="0.1.0" # the published release to verify
IMAGE_NAME="ghcr.io/vulnwatch/sentinel-aura"
DIGEST="$(docker buildx imagetools inspect "${IMAGE_NAME}:${VERSION}" \
  --format '{{.Manifest.Digest}}')"
IMAGE="${IMAGE_NAME}@${DIGEST}"

# The build provenance: built and published by the Release workflow of this
# repository, from the tag of the version.
gh attestation verify "oci://${IMAGE}" \
  --repo vulnwatch/sentinel-aura \
  --signer-workflow vulnwatch/sentinel-aura/.github/workflows/release.yml \
  --source-ref "refs/tags/v${VERSION}"

# The signed claim that the SBOM describes the image.
gh attestation verify "oci://${IMAGE}" \
  --repo vulnwatch/sentinel-aura \
  --signer-workflow vulnwatch/sentinel-aura/.github/workflows/release.yml \
  --source-ref "refs/tags/v${VERSION}" \
  --predicate-type https://cyclonedx.org/bom

# The release, whose Git tag and assets release immutability locked.
gh release verify "v${VERSION}" --repo vulnwatch/sentinel-aura

# The supported Sentinel version, which is the one that the host runs.
docker pull "${IMAGE}"
docker image inspect "${IMAGE}" \
  --format '{{index .Config.Labels "io.github.vulnwatch.sentinel-aura.sentinel-version"}}'

# Deploy the image as ${IMAGE}, by its digest.
```

`--source-ref` rejects a digest that the build of another version attested.
To verify with the bundle assets instead of the attestations API, download
them with `gh release download "v${VERSION}" --repo vulnwatch/sentinel-aura
--pattern '*.sigstore.json'` and add `--bundle
sentinel-aura-<version>.provenance.sigstore.json` (respectively
`sentinel-aura-<version>.sbom.sigstore.json`) to the command; the bundle of
the published release binds the digest attested for that release.
`--bundle-from-oci` verifies the copy in the registry instead. `gh release
verify-asset "v${VERSION}" <file> --repo vulnwatch/sentinel-aura` confirms
that a downloaded asset, such as the SBOM, is the published one.

The verification checks the signer workflow, the source ref, the predicate
type, and the subject digest. The provenance establishes which commit and
workflow run built and published the digest; it does not prove that the
build is reproducible.

### Secrets and Settings

- **`RELEASE_TOKEN`**: the repository secret of `release-please.yml`, a
  fine-grained personal access token whose resource owner is the `vulnwatch`
  organization, limited to this repository, with read and write access to
  Contents, Issues, and Pull requests. The `GITHUB_TOKEN` cannot replace it:
  its pull requests and tags start no workflow run, so the release pull
  request would get no required checks and the tag no `release.yml` run. Only
  the `Release Please` job receives it, which checks out and runs no code of
  the repository. When it expires, `release-please.yml` fails until a
  maintainer replaces it.
- **Release immutability**, in Settings → General → Releases, is enabled
  (Publication and Immutability).
- **The `sentinel-aura` package** in the registry is public, so that a
  deployment pulls and verifies the image without registry credentials. A new
  package is private: the repository owner makes it public once, after the
  first release publishes it; a public package cannot become private again.
