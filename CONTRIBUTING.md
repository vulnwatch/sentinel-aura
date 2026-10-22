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
5. Add or update tests for every code change, and run
   `scripts/tooling.sh run check`
6. Open a **pull request** against `master`

## Development Setup

Every Node.js command runs in a disposable container of the official
Playwright image, started by `scripts/tooling.sh` through rootless Podman,
never on your host
([Development Environment](docs/architecture.md#development-environment)).
The container sees the repository and nothing else: no home directory and no
credentials. The host needs only Linux, Git, and
[Podman](https://podman.io/) running rootless, as a regular user; it needs no
Node.js.

| Command | Purpose |
|---------|---------|
| `scripts/tooling.sh install` | Install the dependencies (`npm ci`) |
| `scripts/tooling.sh run <script> [args]` | Run a `package.json` script without network access, for example `run check` for the type check, lint, format check, and tests, or `run test -- src/router.test.tsx` |
| `scripts/tooling.sh format` | Format the sources with Prettier |
| `scripts/tooling.sh npm <args>` | Run npm with write access to `package.json` and `package-lock.json`, for example to update a dependency |
| `scripts/tooling.sh dev` | Start the development server on <http://localhost:5173>, published on the loopback interface only |
| `scripts/tooling.sh clean` | Remove the dependency volume of the clone |

- The repository is mounted read-only. A command writes only the outputs,
  `dist/`, `coverage/`, and `test-results/`, and the files that it changes by
  design: the formatted sources for `format`, `package.json` and the lockfile
  for `npm`.
- The dependencies live in a Podman volume of each clone, mounted on
  `node_modules/`, which stays empty on your host. Every command installs
  them first when the volume is new or when the tooling image,
  `package.json`, the lockfile, or `.npmrc` changed, so `install` is needed
  only to force a clean installation.
- The first command downloads the tooling image, about 2.5 GB.
- A new dependency needs the decision that
  [Dependency Admission](docs/conventions.md#dependency-admission) defines.

## Git Hooks

The repository ships Git hooks in `.githooks/` that check your commits before
CI does. Activate them once in your clone:

```bash
git config --local core.hooksPath .githooks
```

| Hook | Checks |
|------|--------|
| `commit-msg` | Conventional Commits format and length of the first line of the message |
| `pre-commit` | `shellcheck` and `shfmt` on staged shell scripts and hooks, `actionlint` on staged workflows, and `gitleaks` on the staged changes |
| `pre-push` | Blocks pushes to `master` and pushes of tags |

The tools of `pre-commit` are optional: a missing one produces a warning and
does not block the commit. CI remains the authoritative gate for the shell and
workflow checks. See
[Local Git Hooks](docs/deployment.md#local-git-hooks) for the tool versions and
how to deactivate the hooks.

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
3. Ensure CI passes on your branch, including the `PR Metadata` check of the
   title and the issue linkage
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
