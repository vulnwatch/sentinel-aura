#!/usr/bin/env bash
# Fail when a Renovate lookup log reports a package warning.
#
# Usage: scripts/check-renovate-log.sh <renovate-log.ndjson>
#
# The log is the NDJSON debug output (LOG_FORMAT=json, LOG_LEVEL=debug) of the
# read-only Renovate lookup in .github/workflows/renovate-validation.yml. The
# script reads the "packageFiles with updates" summary and lists the warnings
# of every dependency. Exit codes: 0 without warnings, 1 with warnings, and 2
# when the log cannot be validated.
#
# One exception: the failed lookup of a package of IP_ALLOW_LIST_EXEMPTIONS is
# tolerated, and listed on stdout, when the same log records that GitHub
# refused that lookup because of the IP allow list of the package's owning
# organization (docs/deployment.md, Dependency Updates).
set -euo pipefail

readonly SUMMARY_MESSAGE='packageFiles with updates'

# The [datasource, package] pairs of an organization whose GitHub IP allow
# list refuses the workflow's token on GitHub-hosted runners.
readonly IP_ALLOW_LIST_EXEMPTIONS='[
    ["github-tags", "aquasecurity/trivy-action"],
    ["github-releases", "aquasecurity/trivy"]
]'

# The [datasource, package] pairs whose lookup the log records as refused by
# the IP allow list of the package's owning organization.
# shellcheck disable=SC2016  # $datasource and $name are jq variables
readonly REFUSALS_FILTER='
    [inputs
    | select((.datasource | type) == "string" and (.packageName | type) == "string")
    | .datasource as $datasource
    | .packageName as $name
    | .err | objects | .message | strings
    | select(contains("the `\($name | split("/")[0])` organization has an IP allow list enabled"))
    | [$datasource, $name]]
    | unique'

# shellcheck disable=SC2016  # $file, $datasource, $name, $exemptions, and $refusals are jq variables
readonly WARNINGS_FILTER='
    .config | to_entries[] | .value[]
    | .packageFile as $file
    | .deps[]
    | (.datasource // "unknown datasource") as $datasource
    | (.packageName // .depName // "<unknown package>") as $name
    | (.warnings // [])[]
    | {
        tolerated: (
            ([$datasource, $name] | IN($exemptions[]))
            and ([$datasource, $name] | IN($refusals[]))
            and .message == "Failed to look up \($datasource) package \($name): no-result"
        ),
        text: "- \($file): \(.message) (\($datasource) package \($name))"
    }'

main() {
    if [[ $# -ne 1 ]]; then
        echo "Usage: $0 <renovate-log.ndjson>" >&2
        return 2
    fi
    local log_file="$1"
    local summaries refusals warnings tolerated blocking

    if ! summaries=$(jq -c --arg msg "${SUMMARY_MESSAGE}" 'select(.msg == $msg)' "${log_file}"); then
        echo "Cannot validate the Renovate lookup log: ${log_file} is not a readable NDJSON log." >&2
        return 2
    fi
    if [[ -z "${summaries}" ]]; then
        echo "Cannot validate the Renovate lookup log: it does not contain the '${SUMMARY_MESSAGE}' summary." >&2
        return 2
    fi
    if ! refusals=$(jq -c -n "${REFUSALS_FILTER}" "${log_file}"); then
        echo "Cannot validate the Renovate lookup log: its lookup errors have an unexpected structure." >&2
        return 2
    fi
    if ! warnings=$(jq -c --argjson exemptions "${IP_ALLOW_LIST_EXEMPTIONS}" \
        --argjson refusals "${refusals}" "${WARNINGS_FILTER}" <<<"${summaries}"); then
        echo "Cannot validate the Renovate lookup log: the '${SUMMARY_MESSAGE}' summary has an unexpected structure." >&2
        return 2
    fi
    tolerated=$(jq -r 'select(.tolerated) | .text' <<<"${warnings}")
    blocking=$(jq -r 'select(.tolerated | not) | .text' <<<"${warnings}")

    if [[ -n "${tolerated}" ]]; then
        echo "Tolerated Renovate package lookup warnings (refused by the owning organization's GitHub IP allow list):"
        printf '%s\n' "${tolerated}"
    fi
    if [[ -n "${blocking}" ]]; then
        echo "Renovate package lookup warnings found:" >&2
        printf '%s\n' "${blocking}" >&2
        return 1
    fi
    echo "Renovate lookup completed without package warnings that fail the check."
}

main "$@"
