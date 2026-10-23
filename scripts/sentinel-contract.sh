#!/usr/bin/env bash
# Keep the pinned OpenAPI document identical to the release asset of the
# supported Sentinel version (docs/architecture.md, Backend Contract).
#
# contract/sentinel-version declares the supported version, which Renovate
# updates (docs/deployment.md, Dependency Updates). contract/sentinel.openapi.json
# is the pinned OpenAPI document: a copy of the asset
# sentinel-<version>.openapi.json of that version's GitHub Release. The asset
# is downloaded without credentials, so only a published release provides it.
#
# Usage:
#   scripts/sentinel-contract.sh verify   Fail unless the copy is identical to
#                                         the release asset
#   scripts/sentinel-contract.sh update   Replace the copy with the release
#                                         asset of the declared version
set -euo pipefail

readonly RELEASES_URL="https://github.com/vulnwatch/sentinel/releases/download"
readonly VERSION_FILE="contract/sentinel-version"
readonly DOCUMENT_FILE="contract/sentinel.openapi.json"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly REPO_ROOT

# The temporary download, removed on exit.
DOWNLOAD=""

usage() {
    cat >&2 <<'EOF'
Usage: scripts/sentinel-contract.sh <command>

Commands:
  verify   Fail unless the pinned OpenAPI document is identical to the release
           asset of the supported Sentinel version
  update   Replace the pinned OpenAPI document with that release asset
EOF
}

die() {
    echo "sentinel-contract.sh: $*" >&2
    exit 1
}

# Prints the supported version: one exact version, without the tag's "v".
declared_version() {
    local version
    [[ -f "${REPO_ROOT}/${VERSION_FILE}" ]] || die "missing ${VERSION_FILE}"
    version="$(<"${REPO_ROOT}/${VERSION_FILE}")"
    [[ "${version}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
        die "${VERSION_FILE} must hold one exact version such as 1.2.3 (found '${version}')"
    printf '%s\n' "${version}"
}

remove_download() {
    if [[ -n "${DOWNLOAD}" ]]; then
        rm -f -- "${DOWNLOAD}"
    fi
}

# Downloads the release asset of version $1 into the temporary file DOWNLOAD.
download_asset() {
    local version="$1"
    local url="${RELEASES_URL}/v${version}/sentinel-${version}.openapi.json"
    DOWNLOAD="$(mktemp)"
    trap remove_download EXIT
    curl --fail --silent --show-error --location \
        --proto '=https' --proto-redir '=https' --retry 3 \
        --output "${DOWNLOAD}" "${url}" ||
        die "cannot download ${url}; is v${version} a published Sentinel release?"
    [[ -s "${DOWNLOAD}" ]] || die "the release asset at ${url} is empty"
}

cmd_verify() {
    local version
    version="$(declared_version)"
    [[ -f "${REPO_ROOT}/${DOCUMENT_FILE}" ]] ||
        die "missing ${DOCUMENT_FILE}; run 'scripts/sentinel-contract.sh update'"
    download_asset "${version}"
    if ! cmp -s "${DOWNLOAD}" "${REPO_ROOT}/${DOCUMENT_FILE}"; then
        die "${DOCUMENT_FILE} differs from sentinel-${version}.openapi.json of Sentinel v${version}; run 'scripts/sentinel-contract.sh update'"
    fi
    echo "${DOCUMENT_FILE} is identical to sentinel-${version}.openapi.json of Sentinel v${version}"
}

cmd_update() {
    local version
    version="$(declared_version)"
    download_asset "${version}"
    cp -- "${DOWNLOAD}" "${REPO_ROOT}/${DOCUMENT_FILE}"
    echo "${DOCUMENT_FILE} now holds sentinel-${version}.openapi.json of Sentinel v${version}" >&2
}

main() {
    if [[ $# -ne 1 ]]; then
        usage
        exit 2
    fi
    case "$1" in
        verify) cmd_verify ;;
        update) cmd_update ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: $1"
            ;;
    esac
}

main "$@"
