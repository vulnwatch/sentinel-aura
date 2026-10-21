#!/usr/bin/env bash
# Validate the title and the issue linkage of a pull request against
# docs/conventions.md (Pull Request Requirements and Commit Messages).
#
# Usage:
#   PR_TITLE=<title> PR_BODY=<body> PR_AUTHOR=<login> PR_HEAD_REF=<branch> \
#       scripts/check-pr-metadata.sh
#
# Run by .github/workflows/pr-metadata.yml. Each failure is written to stderr
# as a GitHub Actions error annotation, and the exit code is 1.
set -euo pipefail

readonly ORDINARY_TITLE_PATTERN='^(feat|fix|docs|refactor|test|chore|ci)(\([a-z0-9 _-]+\))?: .+$'
readonly BREAKING_TITLE_PATTERN='^(feat|fix)(\([a-z0-9 _-]+\))?!: .+$'
# The title becomes the squash commit subject, which stays under 72 characters.
readonly MAX_TITLE_LENGTH=71
readonly LINKAGE_FIELD='- Issue linkage:'
readonly CLOSES_PATTERN='^Closes #[1-9][0-9]*$'
readonly EXEMPTION_PATTERN='^N/A - .*[[:graph:]]'

error() {
    printf '::error::%s\n' "$1" >&2
}

check_title() {
    local title="$1"
    if ! [[ "${title}" =~ ${ORDINARY_TITLE_PATTERN} || "${title}" =~ ${BREAKING_TITLE_PATTERN} ]]; then
        error "PR title '${title}' does not follow the Conventional Commits format."
        error "Expected type[(scope)]: description, or feat[(scope)]! / fix[(scope)]! for a breaking change."
        return 1
    fi
    if [[ ${#title} -gt ${MAX_TITLE_LENGTH} ]]; then
        error "PR title is ${#title} characters; the maximum is ${MAX_TITLE_LENGTH}."
        return 1
    fi
}

# Renovate and release-please pull requests are exempt from the issue linkage
# only; their title is still validated.
is_approved_automation() {
    local author="$1" head_ref="$2"
    [[ "${author}" == "renovate[bot]" && "${head_ref}" == renovate/* ]] ||
        [[ "${head_ref}" == release-please--* ]]
}

check_issue_linkage() {
    local body="$1"
    local field_count value standalone_count

    field_count=$(grep -c "^${LINKAGE_FIELD}" <<<"${body}" || true)
    if [[ ${field_count} -gt 1 ]]; then
        error "The PR body must contain at most one '${LINKAGE_FIELD}' field (found ${field_count})."
        return 1
    fi

    if [[ ${field_count} -eq 1 ]]; then
        value=$(sed -n "s/^${LINKAGE_FIELD}[[:space:]]*//p" <<<"${body}")
        value="${value%"${value##*[![:space:]]}"}"
        if [[ "${value}" =~ ${CLOSES_PATTERN} || "${value}" =~ ${EXEMPTION_PATTERN} ]]; then
            return 0
        fi
        error "The issue linkage must be 'Closes #N' or 'N/A - <specific reason>' (found '${value}')."
        return 1
    fi

    # Without the field, a standalone 'Closes #N' line, GitHub's own
    # issue-closing syntax, is the only accepted form: an exemption is
    # self-explanatory only next to the field's label.
    standalone_count=$(grep -c -E "${CLOSES_PATTERN}" <<<"${body}" || true)
    if [[ ${standalone_count} -eq 1 ]]; then
        return 0
    fi
    error "The PR body must contain exactly one issue linkage: '${LINKAGE_FIELD} Closes #N', '${LINKAGE_FIELD} N/A - <specific reason>', or a standalone 'Closes #N' line (found ${standalone_count} standalone line(s))."
    return 1
}

main() {
    local body="${PR_BODY-}"

    check_title "${PR_TITLE-}"
    if is_approved_automation "${PR_AUTHOR-}" "${PR_HEAD_REF-}"; then
        return 0
    fi
    # A body saved from the GitHub web editor uses CRLF line endings.
    body="${body//$'\r'/}"
    check_issue_linkage "${body}"
}

main "$@"
