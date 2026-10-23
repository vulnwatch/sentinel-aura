#!/usr/bin/env bash
# Keep the tracking issue of the weekly image scan in step with its result
# (docs/deployment.md, Workflow Inventory, Image vulnerability scan): open the
# issue, or update the open one, when the scan found fixable HIGH or CRITICAL
# vulnerabilities, and close it when the scan found none.
#
# Usage:
#   scripts/image-scan-issue.sh <report>
#
# <report> is Trivy's JSON report of the scan, limited to fixable HIGH and
# CRITICAL vulnerabilities. gh authenticates with GH_TOKEN. GITHUB_REPOSITORY
# names the repository, GITHUB_SHA the scanned commit, and RUN_URL the
# workflow run, which keeps the complete report.
set -euo pipefail

readonly ISSUE_TITLE="Image scan: fixable HIGH or CRITICAL vulnerabilities"
readonly ISSUE_LABEL="security"
# The findings that the issue lists; the run's complete report has them all.
readonly MAX_ROWS=100

die() {
    echo "image-scan-issue.sh: $*" >&2
    exit 1
}

# Prints the number of the open tracking issue, or nothing.
open_issue() {
    gh issue list --repo "${GITHUB_REPOSITORY}" --state open \
        --label "${ISSUE_LABEL}" --limit 100 --json number,title |
        jq -r --arg title "${ISSUE_TITLE}" \
            '[.[] | select(.title == $title)][0].number // empty'
}

# Prints the body of the tracking issue for the report $1 with $2 findings.
issue_body() {
    local report="$1" count="$2"
    cat <<EOF
The image scan found ${count} fixable HIGH or CRITICAL vulnerabilities in the image built from \`${GITHUB_SHA}\`. The [workflow run](${RUN_URL}) keeps the complete report.

A fix usually arrives as a Renovate pull request that updates the base image of the \`Containerfile\`; merge it with a \`fix(deps):\` title. See \`docs/deployment.md\` (Workflow Inventory, Image vulnerability scan).

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
    [[ $# -eq 1 ]] || die "usage: scripts/image-scan-issue.sh <report>"
    local report="$1" count issue body_file
    [[ -n "${GITHUB_REPOSITORY:-}" && -n "${GITHUB_SHA:-}" && -n "${RUN_URL:-}" ]] ||
        die "GITHUB_REPOSITORY, GITHUB_SHA, and RUN_URL must be set"
    count="$(jq '[.Results[]?.Vulnerabilities[]?] | length' "${report}")" ||
        die "cannot read the report ${report}"
    issue="$(open_issue)"

    if ((count == 0)); then
        if [[ -n "${issue}" ]]; then
            gh issue close "${issue}" --repo "${GITHUB_REPOSITORY}" \
                --comment "The image scan of \`${GITHUB_SHA}\` found no fixable HIGH or CRITICAL vulnerabilities: [workflow run](${RUN_URL})."
            echo "Closed issue #${issue}: no fixable HIGH or CRITICAL vulnerabilities"
        else
            echo "No fixable HIGH or CRITICAL vulnerabilities, and no open issue"
        fi
        return 0
    fi

    body_file="$(mktemp)"
    issue_body "${report}" "${count}" >"${body_file}"
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
