#!/usr/bin/env bash
# Keep the tracking issue of the image scan in step with its result
# (docs/deployment.md, Workflow Inventory, Image vulnerability scan): open the
# issue, or update the open one, when the scan of the image of the latest
# release found fixable HIGH or CRITICAL vulnerabilities, and close it when
# the scan found none.
#
# Usage:
#   scripts/image-scan-issue.sh <report> <version> <image>
#
# <report> is Trivy's JSON report of the scan, limited to fixable HIGH and
# CRITICAL vulnerabilities, of the image of the release <version>, such as
# 1.2.3, whose reference by digest is <image>. gh authenticates with GH_TOKEN.
# GITHUB_REPOSITORY names the repository, and RUN_URL the workflow run, which
# keeps the complete report.
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

readonly ISSUE_TITLE="Image scan: fixable HIGH or CRITICAL vulnerabilities"
readonly ISSUE_LABEL="security"
# The findings that the issue lists; the run's complete report has them all.
readonly MAX_ROWS=100

# Prints the number of the open tracking issue, or nothing.
open_issue() {
    gh issue list --repo "${GITHUB_REPOSITORY}" --state open \
        --label "${ISSUE_LABEL}" --limit 100 --json number,title |
        jq -r --arg title "${ISSUE_TITLE}" \
            '[.[] | select(.title == $title)][0].number // empty'
}

# Prints the scanned image, of the release $1, whose reference by digest is
# $2, as the issue and its closing comment name it.
scanned_image() {
    printf "the image of the latest release, [v%s](https://github.com/%s/releases/tag/v%s), \`%s\`" \
        "$1" "${GITHUB_REPOSITORY}" "$1" "$2"
}

# Prints the body of the tracking issue for the report $1 with $2 findings,
# of the image of the release $3, whose reference by digest is $4.
issue_body() {
    local report="$1" count="$2" version="$3" image="$4"
    cat <<EOF
The image scan found ${count} fixable HIGH or CRITICAL vulnerabilities in $(scanned_image "${version}" "${image}"). The [workflow run](${RUN_URL}) keeps the complete report.

A fix usually arrives as a Renovate pull request that updates the base image of the \`Containerfile\`. Merge it with a \`fix(deps):\` subject, set when squash-merging rather than by renaming the pull request, whose title Renovate restores: for example \`gh pr merge <number> --squash --subject "fix(deps): <description> (#<number>)"\`. The fix reaches the scanned image with the next release, once the release pull request is merged, and the scan that runs after that release closes this issue if no fixable vulnerability remains. See \`docs/deployment.md\` (Workflow Inventory, Image vulnerability scan; Release Process, Release Chain) and \`docs/conventions.md\` (Workflow, Squash merge).

| Vulnerability | Severity | Package | Installed | Fixed in |
|---|---|---|---|---|
EOF
    jq -r --argjson max "${MAX_ROWS}" '
        [.Results[]?.Vulnerabilities[]?] | .[:$max][]
        | "| \(.VulnerabilityID) | \(.Severity) | \(.PkgName) | \(.InstalledVersion) | \(.FixedVersion) |"
    ' "${report}"
    if ((count > MAX_ROWS)); then
        printf '\nThe table lists the first %d findings.\n' "${MAX_ROWS}"
    fi
}

main() {
    if [[ $# -ne 3 ]]; then
        usage
        exit 2
    fi
    local report="$1" version="$2" image="$3" count issue body_file
    [[ -n "${GITHUB_REPOSITORY:-}" && -n "${RUN_URL:-}" ]] ||
        die "GITHUB_REPOSITORY and RUN_URL must be set"
    is_version "${version}" || die "'${version}' is not a version such as 1.2.3"
    is_release_reference "${image}" ||
        die "'${image}' is not a reference by digest of ${RELEASE_IMAGE}"
    count="$(jq '[.Results[]?.Vulnerabilities[]?] | length' "${report}")" ||
        die "cannot read the report ${report}"
    issue="$(open_issue)"

    if ((count == 0)); then
        if [[ -n "${issue}" ]]; then
            gh issue close "${issue}" --repo "${GITHUB_REPOSITORY}" \
                --comment "The image scan found no fixable HIGH or CRITICAL vulnerabilities in $(scanned_image "${version}" "${image}"): [workflow run](${RUN_URL})."
            echo "Closed issue #${issue}: no fixable HIGH or CRITICAL vulnerabilities"
        else
            echo "No fixable HIGH or CRITICAL vulnerabilities, and no open issue"
        fi
        return 0
    fi

    body_file="$(mktemp)"
    issue_body "${report}" "${count}" "${version}" "${image}" >"${body_file}"
    if [[ -n "${issue}" ]]; then
        gh issue edit "${issue}" --repo "${GITHUB_REPOSITORY}" --body-file "${body_file}"
        echo "Updated issue #${issue}: ${count} fixable HIGH or CRITICAL vulnerabilities"
    else
        gh issue create --repo "${GITHUB_REPOSITORY}" --title "${ISSUE_TITLE}" \
            --label "${ISSUE_LABEL}" --body-file "${body_file}"
        echo "Opened an issue: ${count} fixable HIGH or CRITICAL vulnerabilities"
    fi
    rm -f -- "${body_file}"
}

main "$@"
