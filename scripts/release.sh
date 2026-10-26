#!/usr/bin/env bash
# Check and publish the release of a version tag that release-please created
# (docs/deployment.md, Release Process). The Publish Release job of
# .github/workflows/release.yml runs it for the tag of its run,
# GITHUB_REF_NAME, and the commit that the tag names, GITHUB_SHA, with the
# GitHub CLI authenticated by GH_TOKEN, a token that may write the contents of
# the repository and therefore sees draft releases. It needs jq, which the
# runner provides.
#
# Usage:
#   scripts/release.sh check     Fail unless the tag is a version tag, such as
#                                v1.2.3, whose version package.json declares,
#                                and names a draft GitHub Release of its
#                                commit, which release-please creates with the
#                                tag, and no published one, which is final
#   scripts/release.sh publish <image> <sbom> <sbom-bundle> <provenance-bundle>
#                                Attach to the draft release of the tag, as
#                                its assets, the SBOM of the image <image>, a
#                                reference by digest, and the Sigstore bundles
#                                of the image's SBOM and build provenance
#                                attestations; state the image, the pinned
#                                Sentinel version, and the supported Sentinel
#                                versions in its notes; then publish it, as
#                                the last action, and warn when the release is
#                                not immutable
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# The line that starts the section of the release notes that publish writes,
# so that a rerun replaces it.
readonly NOTES_MARKER="<!-- scripts/release.sh: the image and its Sentinel versions -->"

# The working directory of publish, removed on exit.
WORK_DIR=""

remove_work_dir() {
    if [[ -n "${WORK_DIR}" ]]; then
        rm -rf -- "${WORK_DIR}"
    fi
}

# Prints the version of the tag GITHUB_REF_NAME, without its "v".
release_version() {
    local tag="${GITHUB_REF_NAME:-}"
    if [[ "${tag}" != v* ]] || ! is_version "${tag#v}"; then
        die "the tag '${tag}' is not a version tag such as v1.2.3"
    fi
    printf '%s\n' "${tag#v}"
}

# Prints, for each GitHub Release of the tag $1, which release_version
# validated, "published", or "draft" and the commit that the draft targets,
# the commit of release-please's tag.
release_states() {
    gh api --paginate "repos/${REPOSITORY}/releases?per_page=100" \
        --jq ".[] | select(.tag_name == \"$1\") | if .draft then \"draft \(.target_commitish)\" else \"published\" end"
}

# Fails unless the file $1 is a Sigstore bundle.
require_bundle() {
    jq -e '.mediaType | startswith("application/vnd.dev.sigstore.bundle")' "$1" >/dev/null 2>&1 ||
        die "$1 is not a Sigstore bundle"
}

# Prints the first Sentinel version that the pinned Sentinel version $1 does
# not support: the next minor version while $1 is below 1.0.0, and the next
# major version from 1.0.0 on (docs/deployment.md, Supported Sentinel
# Versions).
sentinel_upper_bound() {
    local major minor
    is_version "$1" || die "'$1' is not a Sentinel version such as 1.2.3"
    IFS=. read -r major minor _ <<<"$1"
    if ((10#${major} == 0)); then
        printf '0.%d.0\n' "$((10#${minor} + 1))"
    else
        printf '%d.0.0\n' "$((10#${major} + 1))"
    fi
}

# Prints the notes of the release of the tag $1 of version $2, with the
# section that states the image $3, the pinned Sentinel version, which the
# image's label also states, and the supported Sentinel versions, after the
# notes of release-please.
release_notes() {
    local tag="$1" version="$2" image="$3" body sentinel upper
    body="$(gh release view "${tag}" --repo "${REPOSITORY}" --json body --jq .body)" ||
        die "cannot read the notes of release ${tag}"
    sentinel="$(declared_version)"
    upper="$(sentinel_upper_bound "${sentinel}")"
    body="${body%%"${NOTES_MARKER}"*}"
    while [[ "${body}" == *$'\n' ]]; do
        body="${body%$'\n'}"
    done
    cat <<EOF
${body}

${NOTES_MARKER}
### Image

\`${image}\`, tagged \`${RELEASE_IMAGE}:${version}\`, is built and tested against [Sentinel ${sentinel}](https://github.com/vulnwatch/sentinel/releases/tag/v${sentinel}) and supports Sentinel \`>= ${sentinel}, < ${upper}\` ([Supported Sentinel Versions](https://github.com/${REPOSITORY}/blob/${tag}/docs/deployment.md#supported-sentinel-versions)). Verify it before deploying it by its digest, as [Verifying a Release](https://github.com/${REPOSITORY}/blob/${tag}/docs/deployment.md#verifying-a-release) describes.
EOF
}

cmd_check() {
    [[ $# -eq 0 ]] || die "check: takes no arguments"
    local version commit="${GITHUB_SHA:-}" declared states
    version="$(release_version)"
    [[ "${commit}" =~ ^[0-9a-f]{40}$ ]] || die "GITHUB_SHA must name the commit of the tag"
    declared="$(jq -r '.version' "${REPO_ROOT}/package.json")" ||
        die "cannot read the version of package.json"
    [[ "${declared}" == "${version}" ]] ||
        die "package.json declares version ${declared}, not the version ${version} of the tag"
    states="$(release_states "v${version}")" ||
        die "cannot list the releases of ${REPOSITORY}"
    [[ "${states}" != *published* ]] ||
        die "release v${version} is already published, so its image and assets are final; ship a change as a new release"
    # A tag that release-please did not create, or that names another commit,
    # publishes nothing.
    [[ $'\n'"${states}"$'\n' == *$'\n'"draft ${commit}"$'\n'* ]] ||
        die "the tag v${version} has no draft release of its commit ${commit:0:7}, which release-please creates with the tag"
    echo "release.sh: v${version} is a draft release of commit ${commit:0:7}, version ${version}" >&2
}

cmd_publish() {
    [[ $# -eq 4 ]] ||
        die "publish: takes the image, its SBOM, and the bundles of its SBOM and provenance attestations"
    local image="$1" sbom="$2" sbom_bundle="$3" provenance_bundle="$4"
    local version tag prefix immutable
    version="$(release_version)"
    tag="v${version}"
    is_release_reference "${image}" ||
        die "publish: '${image}' is not a reference by digest of ${RELEASE_IMAGE}"
    jq -e --arg version "${version}" '.metadata.component.version == $version' \
        "${sbom}" >/dev/null 2>&1 || die "${sbom} is not the SBOM of version ${version}"
    require_bundle "${sbom_bundle}"
    require_bundle "${provenance_bundle}"

    WORK_DIR="$(mktemp -d)"
    trap remove_work_dir EXIT
    mkdir "${WORK_DIR}/assets"
    prefix="${WORK_DIR}/assets/sentinel-aura-${version}"
    cp -- "${sbom}" "${prefix}.sbom.cdx.json"
    cp -- "${sbom_bundle}" "${prefix}.sbom.sigstore.json"
    cp -- "${provenance_bundle}" "${prefix}.provenance.sigstore.json"
    release_notes "${tag}" "${version}" "${image}" >"${WORK_DIR}/notes.md"

    # --clobber keeps a rerun for a draft release idempotent.
    gh release upload "${tag}" "${WORK_DIR}/assets/"* --repo "${REPOSITORY}" --clobber
    gh release edit "${tag}" --repo "${REPOSITORY}" --notes-file "${WORK_DIR}/notes.md" --draft=false
    echo "release.sh: published release ${tag} of ${image}" >&2

    # The release is published already, so a missing repository setting does
    # not turn the publication into a failure.
    immutable="$(gh release view "${tag}" --repo "${REPOSITORY}" --json isImmutable --jq .isImmutable)" ||
        immutable="unknown"
    if [[ "${immutable}" != true ]]; then
        echo "::warning::Release ${tag} is not immutable (isImmutable=${immutable}); enable release immutability in the repository settings (docs/deployment.md, Release Process)" >&2
    fi
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        check | publish) "cmd_${command}" "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
