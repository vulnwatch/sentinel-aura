#!/usr/bin/env bash
# The rules of a commit title, which .githooks/commit-msg applies to the first
# line of a commit message and scripts/check-pr-metadata.sh to the title of a
# pull request, the subject of its squash commit (docs/conventions.md, Commit
# Messages; Pull Request Requirements): type[(scope)]: description, with the
# types feat, fix, docs, refactor, test, chore, and ci; only feat and fix may
# carry the breaking marker (feat!: or fix(scope)!:); under 72 characters.

readonly ORDINARY_TITLE_PATTERN='^(feat|fix|docs|refactor|test|chore|ci)(\([a-z0-9 _-]+\))?: .+$'
readonly BREAKING_TITLE_PATTERN='^(feat|fix)(\([a-z0-9 _-]+\))?!: .+$'
readonly MAX_TITLE_LENGTH=71

# Succeeds when the title $1 follows the rules. Otherwise prints why, as the
# predicate of a sentence whose subject is the title, and fails.
title_problem() {
    local title="$1"
    if ! [[ "${title}" =~ ${ORDINARY_TITLE_PATTERN} || "${title}" =~ ${BREAKING_TITLE_PATTERN} ]]; then
        printf '%s' "does not follow the Conventional Commits format: type[(scope)]: description, with the type feat, fix, docs, refactor, test, chore, or ci, or feat[(scope)]!: or fix[(scope)]!: for a breaking change"
        return 1
    fi
    if ((${#title} > MAX_TITLE_LENGTH)); then
        printf 'is %d characters long; the maximum is %d' "${#title}" "${MAX_TITLE_LENGTH}"
        return 1
    fi
}
