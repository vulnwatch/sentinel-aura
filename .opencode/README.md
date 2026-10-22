# OpenCode Tooling

This directory contains the OpenCode agent definitions and prompts for the
Sentinel Aura project. This README serves as a quick-reference catalog.

`AGENTS.md` is the always-on operational kernel. It owns safety gates,
reviewer triggers, and cumulative authority routing. Detailed UI, convention,
and Sentinel contract rules remain in their authoritative documents and are
loaded explicitly when a task matches their routes.

`opencode.json` does not inject any document globally. Primary agents and
fresh subagents apply the routes in `AGENTS.md` independently; a child session
must not assume that it inherits files read by its parent. OpenCode
configuration-time files are not hot-reloaded, so restart OpenCode after
changing this policy, the project configuration, prompts, agents, commands, or
skills.

For localized work, agents read the complete governing contract rather than
mechanically loading every line of each supporting file. That contract includes
the affected section and its nested content, governing scope, applicable
defaults and invariants, required references, and relevant reverse references.
Full-document requirements still apply where `AGENTS.md` says so, and uncertain
impact expands the read rather than narrowing it by assumption.

## Sentinel Reference

Agents read Sentinel's specifications from a local clone of
`vulnwatch/sentinel` at `../sentinel`, as `AGENTS.md` (Sentinel as an External
Authority) requires. `opencode.json` declares that clone as the `sentinel`
reference, so OpenCode lets every agent read it without an external-directory
prompt, and denies edits under `../sentinel/**` to the Spec and Code agents;
reviewers cannot edit any file. The edit denial is defense in depth: the
read-only rule in `AGENTS.md` remains the authority, and it also covers shell
commands. OpenCode evaluates the approvals given during a session after the
configured rules, so answering "always" to an edit prompt allows every edit,
including under `../sentinel`, until OpenCode restarts; answer "once" instead.

Agents never change the clone's checkout. They read the Sentinel revision that
`AGENTS.md` selects with `git show` when another revision is checked out, so
the clone can also be used for work on Sentinel.

Clone Sentinel next to this repository before starting OpenCode:

```bash
git clone https://github.com/vulnwatch/sentinel.git ../sentinel
```

## Primary Agents

Primary agents are the main interaction modes, switchable with the Tab key.
They are configured in `opencode.json`. The built-in Build agent is disabled.

| Agent | Scope | Permissions |
|-------|-------|-------------|
| **Plan** | Analysis and planning | Read-only (built-in) |
| **Spec** | UI specifications, project policy, and OpenCode configuration | Edit: `docs/**`, `AGENTS.md`, `.opencode/**`, `opencode.json`; shell: Git/GitHub workflow, read-only inspection, tests |
| **Code** | Implementation, tests, CI/CD, and repository tooling | Edit: all files (`docs/**` requires confirmation) |

- **Plan** — read-only mode for analysis, planning, and discussion without
  making changes. Uses the OpenCode built-in Plan agent.
- **Spec** — writes and maintains the foundation and screen documents, the
  conventions, project policy, and OpenCode configuration. It can run
  non-mutating verification and manage its GitHub workflow, but cannot modify
  implementation code. Prompt: `.opencode/prompts/spec.md`
- **Code** — implements the UI from its issue, the foundation documents, and
  Sentinel's contract, writes tests, and maintains all executable artifacts.
  Must signal unresolved behavioral or contract gaps, while retaining freedom
  over compliant internal technical choices and interface details. May
  delegate parts of an approved plan to built-in `general` tasks that run
  sequentially, and must verify their diffs itself. Prompt:
  `.opencode/prompts/code.md`

Plan and Code take the delegated decisions defined in `AGENTS.md` (Delegated
decisions): Plan presents them in its plan, while Code records them and ships
any document alignment in the same PR.

## Subagents

All project subagents are defined in `.opencode/agents/`. Every project
subagent is a **read-only reviewer**: it analyzes code or documents and
reports findings without modifying files. All writing is owned by the primary
agents; the built-in `general` task writes only on the Code agent's behalf,
within a brief that excludes Git workflow, GitHub mutations, `docs/**` edits,
changes to `../sentinel`, reviewer invocation, new dependencies the user has
not admitted, and gap or delegated decisions.

All reviewer agents apply the finding rules in `AGENTS.md` (Quality and
findings) before reporting findings. Speculative, unnecessary,
over-documenting, or disproportionate findings are omitted rather than turned
into project requirements. The agent that invoked a reviewer independently
evaluates every received finding before acting on it.

Reviewer prompts use a flexible shared anatomy: role, finding filter,
applicable scope or exclusions, authority loading, specialist procedure or
checks, and output. Specialized protocols retain the structure and vocabulary
their work requires; conformance classes and domain-specific verdicts are not
forced into one generic template. Every report identifies concrete evidence
and ends with an explicit verdict or recommendation.

Every reviewer keeps OpenCode file editing disabled while ordinary Bash
commands inherit OpenCode's default allow behavior. Common mutation-oriented
filesystem command families are denied as defense in depth; these rules are
not a complete read-only shell sandbox, and `edit: deny` independently blocks
OpenCode edit, write, and patch tools. The `git`, `gh`, and `glab` command
families are default-denied, then narrowly scoped read-only forms are allowed
afterward under OpenCode's last-match-wins evaluation. This shared permission
block is identical to the one Sentinel's reviewers use. The CI/CD reviewer
additionally runs local lint commands; role extensions follow the shared
family denies. No automated check keeps the shared block synchronized across
reviewer definitions, so change every definition together.

Change-triggered reviews begin from the declared scope and diff, then expand
through applicable contracts and demonstrated dependencies. They use targeted
repository-wide searches for callers, consumers, and reverse references instead
of treating every invocation as a repository-wide audit. The primary agent may
resume the same reviewer child session for a follow-up delta only while its
role, base, scope, authorities, and retained context remain valid; otherwise it
starts a fresh reviewer session. Reports keep positive summaries brief while
preserving scope, limitations, evidence, and verdicts.

| Agent | Type | Trigger | Purpose |
|-------|------|---------|---------|
| `@cicd-reviewer` | Reviewer | Workflow, hook, CI-consumed script, or release configuration change | Reviews CI/CD artifacts for convention conformity and pipeline coherence |
| `@design-reviewer` | Reviewer | New or substantially changed foundation or screen document, including an architecture decision | Applies a simplicity-first review to UI designs and architecture decisions |
| `@docs-placement-reviewer` | Reviewer | Foundation or screen document that adds potentially shared rules | Verifies that rules sit in their owning document of this repository, or in Sentinel's contract, without duplication or premature generalization |
| `@docs-reviewer` | Reviewer | Significant documentation, policy, or multi-document change | Reviews documentation completeness, accuracy, and coherence with the implementation and with Sentinel's contract |
| `@spec-coherence-reviewer` | Reviewer | New or substantively changed foundation or screen document with impact on related documents or on what it relies on in Sentinel's contract, or a supported Sentinel version change | Detects contradictions, incompatible flows, and inconsistent terminology among this repository's documents and against Sentinel's contract |
| `@spec-conformance-reviewer` | Reviewer | Pre-PR (unconditional) | Verifies a pull request implements what its issue, the foundation documents, and Sentinel's contract require, and introduces no unauthorized behavior |
| `@spec-gap-analyzer` | Reviewer | New or substantially changed foundation or screen document that specifies UI behavior | Identifies unspecified UI scenarios and states, and the API capabilities a document relies on that Sentinel's contract lacks |

The triggers above summarize the `AGENTS.md` Reviewer Trigger Matrix, which is
authoritative. `@spec-conformance-reviewer` is the only subagent whose trigger
is a moment rather than a kind of change: it runs on every pull request, before
the pull request is opened or marked ready. It can also be invoked manually
with an explicit pull request reference, including on closed pull requests. Its
trigger is mirrored in `.opencode/prompts/code.md` and
`.opencode/prompts/spec.md`.

### Model Tiering

Tracked agent definitions pin no `model` or `variant`, because the providers
and models available differ between contributors. Each contributor selects
them in `.opencode/opencode.jsonc`, which Git ignores. OpenCode merges that file
over the global configuration and `opencode.json`, so its per-agent values
override any per-agent model in `~/.config/opencode/opencode.json`. Changes
take effect after an OpenCode restart. The file belongs to one checkout, so
copy it into every worktree that should use it.

`opencode.example.jsonc` is the project's recommended starting point. Copy it to
`.opencode/opencode.jsonc` and adjust the values. It groups the agents into
three tiers:

| Tier | Agents | Example model |
|------|--------|---------------|
| Primary | `plan`, `spec`, `code` | `anthropic/claude-opus-5-5`, `high` |
| Tier 1 | `@spec-coherence-reviewer`, `@spec-gap-analyzer` | `anthropic/claude-opus-5-5`, `high` |
| Tier 2 | All other reviewer subagents | `anthropic/claude-sonnet-5-5`, `high` |

Tier 1 reviewers rely most on adversarial reasoning and long cross-document
synthesis, so they benefit most from a stronger model.

Without a local file, primary agents use the user's default model and every
subagent inherits the model of the agent that invokes it. A reviewer listed
in the local file runs on its own model regardless of the invoking agent.

## Commands and Skills

No custom slash commands or skills are defined. OpenCode loads commands from
`.opencode/commands/` and skills from `.opencode/skills/` when they are added.

## Directory Structure

```
.opencode/
├── agents/           # Subagent definitions (one .md file per agent)
├── prompts/          # Primary agent prompt files
│   ├── spec.md       # Spec agent instructions
│   └── code.md       # Code agent instructions
├── opencode.example.jsonc  # Example local model selection (see Model Tiering)
├── opencode.jsonc    # Local model selection (untracked, per contributor)
└── README.md         # This file
```

OpenCode also generates its plugin dependency files in this directory
(`package.json`, `node_modules/`, and a lockfile) together with a `.gitignore`
that ignores them and itself. They are local to each checkout and never
tracked.
