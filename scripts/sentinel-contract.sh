#!/usr/bin/env bash
# Keep the pinned OpenAPI document identical to the release asset of the
# supported Sentinel version, and the pinned digest of its image identical to
# the one that its version tag names (docs/architecture.md, Backend Contract).
#
# contract/sentinel-version declares the supported version, which Renovate
# updates (docs/deployment.md, Dependency Updates). contract/sentinel.openapi.json
# is the pinned OpenAPI document: a copy of the asset
# sentinel-<version>.openapi.json of that version's GitHub Release. The asset
# is downloaded without credentials, so only a published release provides it.
# contract/sentinel-image-digest holds the digest of the image
# ghcr.io/vulnwatch/sentinel:<version>, which compose.yaml runs: the registry
# does not enforce tag immutability, so the backend runs the image by digest
# (Sentinel docs/deployment.md, Consumer discovery and verification). The
# script runs on the host with curl and Docker's Buildx plugin, and update
# also with Docker Engine, through scripts/tooling.sh.
#
# Usage:
#   scripts/sentinel-contract.sh verify   Fail unless the copy is identical to
#                                         the release asset and the digest is
#                                         the one of the version tag
#   scripts/sentinel-contract.sh update   Replace the copy with the release
#                                         asset of the declared version, and
#                                         the digest with the one of its tag;
#                                         then regenerate the API client with
#                                         scripts/tooling.sh generate
#   scripts/sentinel-contract.sh verify-release <version> <digest>
#                                         Fail unless <version> is a published
#                                         Sentinel release whose image tag
#                                         names <digest>, such as the version
#                                         and digest that a pull request
#                                         declares (scripts/dev-env.sh
#                                         preview)
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

readonly RELEASES_URL="https://github.com/vulnwatch/sentinel/releases/download"
# Sentinel's image, which compose.yaml runs: keep in sync with it.
readonly IMAGE_NAME="ghcr.io/vulnwatch/sentinel"
readonly DOCUMENT_FILE="contract/sentinel.openapi.json"

# The temporary download, removed on exit.
DOWNLOAD=""

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

# Prints the digest that the tag of version $1 names in the registry, as
# Sentinel docs/deployment.md (Consumer discovery and verification) resolves
# it.
tag_digest() {
    resolve_digest "${IMAGE_NAME}:$1"
}

# The message for a pinned digest that the tag of version $1 no longer names.
# A new supported version needs its digest; for the same version, the tag
# moved, which Sentinel's release process never does after publication
# (Sentinel docs/deployment.md, Release Publication and Immutability), so the
# pin is kept and the move reported.
moved_tag_message() {
    printf '%s' "the tag ${IMAGE_NAME}:$1 names $2, not the pinned digest: after a change of the supported version, run 'scripts/sentinel-contract.sh update'; otherwise the published tag moved, which Sentinel's release process never does, so keep the pin and report it to Sentinel"
}

cmd_verify() {
    local version pinned digest
    version="$(declared_version)"
    [[ -f "${REPO_ROOT}/${DOCUMENT_FILE}" ]] ||
        die "missing ${DOCUMENT_FILE}; run 'scripts/sentinel-contract.sh update'"
    [[ -f "${REPO_ROOT}/${DIGEST_FILE}" ]] ||
        die "missing ${DIGEST_FILE}; run 'scripts/sentinel-contract.sh update'"
    pinned="$(pinned_digest)"
    download_asset "${version}"
    if ! cmp -s "${DOWNLOAD}" "${REPO_ROOT}/${DOCUMENT_FILE}"; then
        die "${DOCUMENT_FILE} differs from sentinel-${version}.openapi.json of Sentinel v${version}; run 'scripts/sentinel-contract.sh update'"
    fi
    echo "${DOCUMENT_FILE} is identical to sentinel-${version}.openapi.json of Sentinel v${version}"
    digest="$(tag_digest "${version}")"
    if [[ "${pinned}" != "${digest}" ]]; then
        die "$(moved_tag_message "${version}" "${digest}")"
    fi
    echo "${DIGEST_FILE} is the digest of ${IMAGE_NAME}:${version}"
}

# The release asset exists only for a published release (download_asset).
cmd_verify_release() {
    [[ $# -eq 2 ]] || die "verify-release: takes a version and a digest"
    local version="$1" digest="$2" named
    is_version "${version}" || die "verify-release: invalid version '${version}'"
    is_digest "${digest}" || die "verify-release: invalid digest '${digest}'"
    download_asset "${version}"
    named="$(tag_digest "${version}")"
    [[ "${named}" == "${digest}" ]] ||
        die "${digest} is not the digest that ${IMAGE_NAME}:${version} names"
    echo "Sentinel v${version} is a published release, and its image tag names ${digest}" >&2
}

# The API client follows the pinned OpenAPI document (docs/architecture.md,
# API Client Generation).
cmd_update() {
    local version digest
    version="$(declared_version)"
    download_asset "${version}"
    digest="$(tag_digest "${version}")"
    cp -- "${DOWNLOAD}" "${REPO_ROOT}/${DOCUMENT_FILE}"
    echo "${DOCUMENT_FILE} now holds sentinel-${version}.openapi.json of Sentinel v${version}" >&2
    printf '%s\n' "${digest}" >"${REPO_ROOT}/${DIGEST_FILE}"
    echo "${DIGEST_FILE} now holds ${digest}, the digest of ${IMAGE_NAME}:${version}" >&2
    "${REPO_ROOT}/scripts/tooling.sh" generate
    echo "the generated API client now follows ${DOCUMENT_FILE}" >&2
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    if [[ "${command}" != verify-release && $# -ne 0 ]]; then
        usage
        exit 2
    fi
    case "${command}" in
        verify) cmd_verify ;;
        update) cmd_update ;;
        verify-release) cmd_verify_release "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
