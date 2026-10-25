# Contributing to Sentinel Aura

Thank you for your interest in contributing to Sentinel Aura, the web user
interface for [Sentinel](https://github.com/vulnwatch/sentinel).
This guide covers everything you need to get started.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code.
Please report unacceptable behavior to security@suse.com.

## Project Status

The repository contains the application skeleton and its build and test
tooling, but no screens yet; see [README.md](README.md#project-status). Until
the UI foundations exist, contributions are limited to documentation, project
policy, and repository tooling.

## How to Contribute

### Reporting Bugs

1. Check the [existing issues](https://github.com/vulnwatch/sentinel-aura/issues) to avoid duplicates
2. Report a bug of the backend or of the API in
   [Sentinel](https://github.com/vulnwatch/sentinel/issues) instead, and a
   vulnerability as described in [SECURITY.md](SECURITY.md)
3. Open a new issue with the Bug Report form: steps to reproduce, expected
   behavior, and actual behavior
4. Add the Sentinel Aura and Sentinel versions, and your browser and its
   version

### Suggesting Features

1. Check the [existing issues](https://github.com/vulnwatch/sentinel-aura/issues) to see if it has been discussed
2. Open a new issue with the Feature Request form, describing the problem you
   are trying to solve and the proposed solution
3. A feature that needs data or operations the Sentinel API does not offer
   starts as an issue in [Sentinel](https://github.com/vulnwatch/sentinel/issues)
   (see [Specification Workflow](#specification-workflow))

### Submitting Changes

1. **Fork** the repository and create a topic branch from `master`
2. [Enable the Git hooks](#git-hooks) and
   [set up the tooling](#development-setup)
3. Name the branch and write commit messages as the
   [Git Conventions](docs/conventions.md#git-conventions) require
4. Make your changes following the [conventions](#conventions)
5. Add or update tests for every code change, and before pushing run
   `scripts/ci.sh all`, which runs the [checks of CI](#checks-of-ci)
6. Open a **pull request** against `master`

## Development Setup

Every Node.js command runs in a disposable container of the official
Playwright image, started by `scripts/tooling.sh` through Docker Engine, never
on your host
([Development Environment](docs/architecture.md#development-environment)).
The container sees the repository and the directory of its dependencies, and
nothing else: no other part of your home directory and no credentials. It
runs with your user and group IDs, without capabilities, so the files that it
writes belong to you. The host needs Linux, Git, `curl`, `jq`, and
[Docker Engine](https://docs.docker.com/engine/install/) 28.0.0 or later,
which Sentinel's local development supports too, with its Buildx plugin and,
for the [local backend](#local-backend), its Compose plugin 2.32.2 or later;
it needs no Node.js. [Trying a pull request](#trying-a-pull-request) also
needs the [GitHub CLI](https://cli.github.com/), `gh`, signed in.

- Use Docker Engine with its default daemon, through its default socket
  `/var/run/docker.sock`, as a regular user who may use it, for example as a
  member of the `docker` group. That access is equivalent to root on your
  host, which Docker's documentation explains in
  [Docker daemon attack surface](https://docs.docker.com/engine/security/#docker-daemon-attack-surface);
  the containers never receive the daemon's socket.
- The scripts check the engine first and stop with a message that explains
  what is not supported
  ([Development Environment](docs/architecture.md#development-environment)
  lists the refused setups).
- The first command downloads the tooling image, about 2 GB, and installs the
  dependencies in your cache directory, outside the repository:
  `node_modules/` stays empty on your host.
- A new dependency needs the decision that
  [Dependency Admission](docs/conventions.md#dependency-admission) defines.

The supported Sentinel version is declared in `contract/sentinel-version`,
`contract/sentinel.openapi.json` is the pinned OpenAPI document, the copy of
that release's OpenAPI document, and `contract/sentinel-image-digest` pins the
digest of that release's image
([Backend Contract](docs/architecture.md#backend-contract)).

### Commands

The scripts under `scripts/` run the tooling on your host. The header comment
of each script documents its usage, with its commands and their arguments,
and what it does, and the `help` command of a script with commands prints
it, for example `scripts/dev-env.sh help`
([Tooling Structure](docs/conventions.md#tooling-structure)). This table says
which command serves which task; the headers also document the commands that
other scripts and CI run for you.

| Task | Command |
|------|---------|
| Run the UI against a [local backend](#local-backend), then remove the backend with its data | `scripts/dev-env.sh start`, then `scripts/dev-env.sh stop` |
| Show the logs of the local backend | `scripts/dev-env.sh logs` |
| Run a script of `package.json`, such as `check`: the type check, lint, format check, and unit and component tests | `scripts/tooling.sh run` |
| Format the sources | `scripts/tooling.sh format` |
| Regenerate the API client after a change of the pinned OpenAPI document or of `orval.config.ts` ([API Client Generation](docs/architecture.md#api-client-generation)) | `scripts/tooling.sh generate` |
| Add, update, or remove a dependency | `scripts/tooling.sh npm` |
| Audit the dependencies, as CI does when they change | `scripts/tooling.sh audit` |
| Install the dependencies from scratch, or remove them | `scripts/tooling.sh install`, or `scripts/tooling.sh clean` |
| Run the [end-to-end tests](#end-to-end-tests) | `scripts/dev-env.sh e2e` |
| Update the reference screenshots after a change of what a screen shows | `scripts/dev-env.sh update-screenshots` |
| Check the development proxy after changing `vite.config.ts`, `compose.yaml`, `test/e2e/same-origin.spec.ts`, `playwright.config.ts`, `scripts/dev-env.sh`, `scripts/tooling.sh`, `scripts/lib/`, the version of `vite`, or the supported version | `scripts/dev-env.sh test` |
| Build and test the image that serves the UI in production ([Packaging and Serving](docs/architecture.md#packaging-and-serving)) | `scripts/image.sh build`, then `scripts/image.sh test` |
| Generate and check the SBOM of the built image, as CI does ([Supply-Chain Artifacts](docs/deployment.md#supply-chain-artifacts)) | `scripts/image.sh sbom` |
| Scan the built image for known vulnerabilities, as the weekly image scan does | `scripts/image.sh scan` |
| Run the [checks of CI](#checks-of-ci) before pushing, or those of one job | `scripts/ci.sh all`, or `scripts/ci.sh ui-checks` or `scripts/ci.sh e2e` |
| Lint the shell scripts, Git hooks, and workflows | `scripts/lint-shell.sh` |
| Check the title and the issue linkage of a pull request | `scripts/check-pr-metadata.sh` |
| Check that the pinned OpenAPI document and image digest match the release of the supported Sentinel version | `scripts/sentinel-contract.sh verify` |
| Complete a change of the supported Sentinel version ([Dependency Updates](docs/deployment.md#dependency-updates)) | `scripts/sentinel-contract.sh update` |
| [Try a pull request](#trying-a-pull-request) as it will be released | `scripts/dev-env.sh preview` |

### Local Backend

`scripts/dev-env.sh start` runs the UI on <http://localhost:5173> against
Sentinel on one origin, as on a Sentinel host
([Local Development](docs/architecture.md#local-development)): a backend from
Sentinel's published image at the supported version, with PostgreSQL and
Redis, loaded with Sentinel's fictional example dataset, behind the
development server, which sends `/api` and every path under it to the
backend's API
([Development Environment](docs/architecture.md#development-environment)).

- Sign in with local authentication as a user of the dataset, for example
  `jdoe` (`admin`), `asmith` (`vulnerability_analyst`), `cwhite`
  (`restricted_analyst`), or `dbrown` (no role), with the dataset's published
  password `example-dataset-password` (Sentinel
  `docs/features/platform/example-dataset.md`, Credentials; Users, which lists
  every user). Until the UI has a sign-in screen, use Sentinel's API
  documentation on the same origin, <http://localhost:5173/api/docs>:
  `POST /api/v1/auth/login` sets the session cookie, and
  `GET /api/v1/users/me` then returns your user.
- Use Chrome or Firefox: Safari does not accept the session cookie from
  `http://localhost`
  ([Supported Browsers](docs/architecture.md#supported-browsers)).
- The data does not survive `stop`, a restart of Docker, or a change of
  `compose.yaml` or of the supported version: the next `start` creates a new
  backend and loads the dataset again. The first start downloads the images.
- Only the development server's port is published, on the loopback interface;
  the backend publishes none.
- The backend runs Sentinel's API only, without its Celery worker and Beat, so
  an operation that publishes a background task waits for a worker that does
  not run. Every fetcher is disabled, and an operation that needs an external
  source, such as adding a package, does not complete there (Sentinel
  `docs/features/platform/example-dataset.md`, Operating a Dataset Backend).

### End-to-End Tests

The end-to-end tests in `test/e2e/` run with Playwright against the UI's
production image, behind a reverse proxy that routes `/api` as a Sentinel host
does, and a backend loaded with the example dataset
([Development Environment](docs/architecture.md#development-environment)).
`scripts/dev-env.sh e2e` runs them in Chromium and Firefox, in about a minute
per browser; CI runs them on every pull request.

- Every test fails on a Content Security Policy violation, an uncaught
  exception, or a WCAG 2.2 A or AA violation that axe-core finds
  ([End-to-End Tests](docs/conventions.md#end-to-end-tests)).
- The reference screenshots in `test/e2e/screenshots/` are Chromium's. After
  a change that alters what a screen shows, run
  `scripts/dev-env.sh update-screenshots`, look at the images that changed,
  remove those that no test takes any more, and commit them: the pull request
  diff shows them, before and after
  ([End-to-End Tests](docs/conventions.md#end-to-end-tests)).
- After a failure, `test-results/e2e/<project>/report/index.html` holds the
  report of each Playwright project, with the expected, actual, and
  differing screenshots and a trace of each failed test. In CI, the
  `e2e-results` artifact of the `End-to-End Tests` job holds those of its
  projects, and the log of `UI Checks` shows the failures of the `image`
  project.
- Two projects besides the browsers check how the UI is served: `dev-server`,
  which `scripts/dev-env.sh test` runs against the development server, and
  `image`, which `scripts/image.sh test` runs against the UI's image
  ([End-to-End Tests](docs/conventions.md#end-to-end-tests)).

### Checks of CI

Run `scripts/ci.sh all` before pushing: it runs on your host the checks of
the `Shell Lint`, `UI Checks`, and `End-to-End Tests` jobs, as CI runs them
([Workflow Inventory](docs/deployment.md#workflow-inventory), Local run).

- It needs what the tooling, the image, and the local backend need, and
  network access; the shell lint runs its tools from pinned images, so you
  install none of them. Once the images are downloaded, it takes a few
  minutes.
- It checks your working tree, so you can run it before committing, but the
  shell lint checks only the files that Git tracks: `git add` a new script or
  workflow first.
- It does not run the checks that need a CI run, such as `PR Metadata`;
  `scripts/check-pr-metadata.sh` runs that check on a title and a body
  locally.

### Trying a Pull Request

`scripts/dev-env.sh preview` runs a pull request as it will be released, so
that you can try it before approving its merge: the production build that its
CI tested, on <http://localhost:4173>, against a new backend at the Sentinel
version that the pull request declares. Sign in as a user of the dataset, as
with the [local backend](#local-backend).

- The pull request contributes only its production build, static files that
  nginx serves to your browser, and the Sentinel version and image digest
  that it declares, which the command accepts only as your checkout's pinned
  digest of the same version, or, for another version, as a published
  Sentinel release whose tag names that digest: nothing of it runs on your
  host. The `Containerfile`, the nginx and reverse proxy configuration,
  `compose.yaml`, and the scripts come from your checkout, so run the command
  from an up-to-date `master`; the preview does not show a change of these
  files.
- The pull request's JavaScript runs in your browser, which shares the cookies
  of `localhost` among all ports. For a pull request from outside the project,
  use a separate browser profile. For the same reason, signing in to the
  preview signs you out of the development server of `scripts/dev-env.sh
  start`, and the other way round.
- To try your own branch, open a draft pull request, or use
  `scripts/dev-env.sh start`.

## Git Hooks

The repository ships Git hooks in `.githooks/` that check your commits before
CI does. Activate them once in your clone:

```bash
git config --local core.hooksPath .githooks
```

| Hook | Checks |
|------|--------|
| `commit-msg` | Conventional Commits format and length of the first line of the message |
| `pre-commit` | `scripts/lint-shell.sh` on the staged files: `shellcheck` and `shfmt` on staged shell scripts and hooks, and `actionlint` on staged workflows; then `gitleaks` on the staged changes |
| `pre-push` | Blocks pushes to `master` and pushes of tags |

The shell and workflow checks of `pre-commit` run their tools from the same
pinned images as CI, through Docker Engine, so you install none of them; when
Docker Engine cannot run the images, the hook warns and the commit proceeds.
`gitleaks` is optional: install it to scan your commits for secrets, or the
hook warns and the commit proceeds. CI remains the authoritative gate for the
shell and workflow checks. See
[Local Git Hooks](docs/deployment.md#local-git-hooks) for the gitleaks version
and how to deactivate the hooks.

## Conventions

Sentinel Aura follows the conventions documented in
[docs/conventions.md](docs/conventions.md), which are authoritative. The key
points are:

- All code, comments, and documentation **must be in English**
- Examples, fixtures, and screenshots use only fictional personal data
  ([Example Data in Documentation](docs/conventions.md#example-data-in-documentation))
- Commit messages and pull request titles use
  [Conventional Commits](https://www.conventionalcommits.org/), under 72
  characters ([Commit Messages](docs/conventions.md#commit-messages))
- UI code follows [Code Conventions](docs/conventions.md#code-conventions)
- Shell scripts and Git hooks follow
  [Shell Scripting](docs/conventions.md#shell-scripting)

## Pull Request Process

1. Fill in the pull request template as
   [Pull Request Requirements](docs/conventions.md#pull-request-requirements)
   defines, including screenshots when the change affects what the UI shows
2. Link the PR to a tracking issue with `Closes #<issue>` in the template's
   `Issue linkage` field
3. Run `scripts/ci.sh all` before pushing, and ensure CI passes on your
   branch, including the `PR Metadata` check of the title and the issue
   linkage
4. Request review from a maintainer
5. PRs are **squash-merged** — the PR title becomes the commit message on
   `master` — and only after the repository owner explicitly authorizes the
   merge

## Specification Workflow

Sentinel owns the backend behavior and the API contract, including the
obligations that the contract places on clients. This repository owns the UI
and its specifications; it never defines backend behavior (see
[Specification Boundary](README.md#specification-boundary)).

| Change type | What is required |
|-------------|------------------|
| Bug fix that corrects a deviation from documented behavior | Fix directly |
| Infrastructure, CI, or cosmetic change, or an update of a declared dependency | No specification |
| New dependency, such as an npm package, a container image, a GitHub Action, or a CI tool | The repository owner's explicit decision, requested with the justification that [Dependency Admission](docs/conventions.md#dependency-admission) defines |
| New feature or change to a screen | An issue with acceptance criteria agreed with the maintainers; the PR shows screenshots and updates the screen document with what was built |
| Change to a behavior shared by the whole UI (the foundation documents) | A documentation PR first, then the implementation |
| New backend capability or API change | An issue in [Sentinel](https://github.com/vulnwatch/sentinel/issues) first, where its specification-first process applies |

When in doubt, open the issue first and discuss the approach with the
maintainers. See [Specification Writing](docs/conventions.md#specification-writing)
for the format of the foundation and screen documents.

## Working with OpenCode

This project includes first-class [OpenCode](https://opencode.ai) configuration.
Using OpenCode is entirely optional — you can contribute with any editor or
workflow — but it provides a streamlined experience for this repository.

### What it provides

- **`AGENTS.md`** contains the operational rules that guide the AI agents
  (authority model, stop conditions, reviewer invocation, Git workflow).
- **`.opencode/`** defines the primary agent prompts and the reviewer
  subagents.
- When working in OpenCode, the agents automatically:
  - read the foundation documents and Sentinel's contract before changing UI
    behavior, and stop instead of inventing backend behavior;
  - invoke the applicable reviewer subagents based on the type of change;
  - enforce the project's Git and commit conventions;
  - run Node.js commands only through `scripts/tooling.sh`: OpenCode denies
    `npm`, `npx`, and `node` on the host to every agent.

### Sentinel clone

The agents read Sentinel's specifications from a local clone next to this
repository. Clone it before starting OpenCode:

```bash
git clone https://github.com/vulnwatch/sentinel.git ../sentinel
```

The agents treat the clone as read-only and never change its checkout, so you
can also use it for work on Sentinel.

### Reviewer subagents

The project defines read-only reviewer subagents that analyze changes and
report findings without modifying files. They are invoked automatically by
the primary agents when their trigger conditions are met.

See [`.opencode/README.md`](.opencode/README.md) for the full inventory of
agents, their triggers, and model tiering.

### Choosing models

The repository pins no model for any agent, so OpenCode works with whichever
providers your client has. To choose the models and reasoning-effort variants
per agent, copy
[`.opencode/opencode.example.jsonc`](.opencode/opencode.example.jsonc) to
`.opencode/opencode.jsonc` (ignored by Git), adjust it, and restart OpenCode.
Without that file, primary agents use your default model and reviewers inherit
the model of the agent that invokes them.

## License

By contributing to Sentinel Aura, you agree that your contributions will be
licensed under the [Apache License 2.0](LICENSE).
