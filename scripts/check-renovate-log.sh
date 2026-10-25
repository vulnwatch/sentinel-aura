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
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

readonly SUMMARY_MESSAGE='packageFiles with updates'

# shellcheck disable=SC2016  # $file, $datasource, and $name are jq variables
readonly WARNINGS_FILTER='
    .config | to_entries[] | .value[]
    | .packageFile as $file
    | .deps[]
    | (.datasource // "unknown datasource") as $datasource
    | (.packageName // .depName // "<unknown package>") as $name
    | (.warnings // [])[]
    | "- \($file): \(.message) (\($datasource) package \($name))"'

main() {
    if [[ $# -ne 1 ]]; then
        usage
        return 2
    fi
    local log_file="$1"
    local summaries warnings

    if ! summaries=$(jq -c --arg msg "${SUMMARY_MESSAGE}" 'select(.msg == $msg)' "${log_file}"); then
        echo "Cannot validate the Renovate lookup log: ${log_file} is not a readable NDJSON log." >&2
        return 2
    fi
    if [[ -z "${summaries}" ]]; then
        echo "Cannot validate the Renovate lookup log: it does not contain the '${SUMMARY_MESSAGE}' summary." >&2
        return 2
    fi
    if ! warnings=$(jq -r "${WARNINGS_FILTER}" <<<"${summaries}"); then
        echo "Cannot validate the Renovate lookup log: the '${SUMMARY_MESSAGE}' summary has an unexpected structure." >&2
        return 2
    fi

    if [[ -n "${warnings}" ]]; then
        echo "Renovate package lookup warnings found:" >&2
        printf '%s\n' "${warnings}" >&2
        return 1
    fi
    echo "Renovate lookup completed without package warnings."
}

main "$@"
