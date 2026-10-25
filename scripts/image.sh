#!/usr/bin/env bash
# Build, test, inventory, scan, and publish the image that serves the UI in
# production: nginx and the production build (docs/architecture.md, Packaging
# and Serving; Security Headers; docs/deployment.md, Release Process). The
# script runs on the host with Docker Engine and its Buildx plugin, locally
# and in CI, and sbom also with jq; the production build and the tests of the
# image's responses run through scripts/tooling.sh, like every Node.js
# command, and Trivy runs from its official image, which the script pins.
#
# Usage:
#   scripts/image.sh build [<version>]
#                                   Build the production build, then the image
#                                   localhost/sentinel-aura:local, with the
#                                   labels of a release of <version>, such as
#                                   1.2.3, or without it of a development
#                                   build, whose version is "dev"
#   scripts/image.sh test           Run the built image and check it: its
#                                   labels, its user, its content, and its
#                                   processes; then its responses, with the
#                                   image project of the end-to-end tests: the
#                                   entry document fallback, caching, the 404
#                                   of a missing asset, the security headers,
#                                   and the absence of redirects; then an
#                                   access log without the Cookie header
#   scripts/image.sh sbom <file>    Write the CycloneDX SBOM of the built image
#                                   to <file>, then check it: the operating
#                                   system packages of the image and the
#                                   production dependencies of
#                                   package-lock.json, which the build bundles;
#                                   offline
#   scripts/image.sh scan <dir>     Scan the operating system packages of the
#                                   built image for known vulnerabilities, and
#                                   write to <dir> Trivy's reports:
#                                   trivy-fixable.json, the fixable HIGH and
#                                   CRITICAL ones, and trivy-full.txt, all of
#                                   them
#   scripts/image.sh save <file>    Write the built image to a tar archive
#   scripts/image.sh load <file>    Load the built image from the archive that
#                                   save wrote
#   scripts/image.sh push <version> Push the built image, labeled as the
#                                   release <version>, as
#                                   ghcr.io/vulnwatch/sentinel-aura:<version>,
#                                   with the credentials of docker login, and
#                                   print its reference by the digest that the
#                                   registry names
#   scripts/image.sh package <dist> <tag>
#                                   Build the image <tag> from a production
#                                   build that another run produced, such as
#                                   the one that the CI of a pull request
#                                   retains, with the Containerfile and the
#                                   nginx configuration of this checkout
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# The port on which nginx listens in the container: keep in sync with
# nginx/default.conf.
readonly CONTAINER_PORT=8080
# Keep in sync with the Containerfile.
readonly WEB_ROOT="/usr/share/nginx/html"

# Trivy's official image, which inventories and scans the image, pinned by
# version and digest and updated by Renovate (docs/deployment.md, Dependency
# Updates).
readonly TRIVY_IMAGE="docker.io/aquasec/trivy:0.76.1@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c"

# The label of the version of the image, the version of a development build,
# and the label of the Sentinel version that the image supports
# (docs/deployment.md, Release Process).
readonly VERSION_LABEL="org.opencontainers.image.version"
readonly DEV_VERSION="dev"
readonly SENTINEL_LABEL="io.github.vulnwatch.sentinel-aura.sentinel-version"

# The state of a command, a test container and a working directory, removed
# on exit.
CONTAINER=""
WORK_DIR=""

require_image() {
    docker image inspect "${UI_IMAGE}" >/dev/null 2>&1 ||
        die "missing image ${UI_IMAGE}; run 'scripts/image.sh build' first"
}

# Prints the version that the label of the built image states.
image_version() {
    docker image inspect --format "{{index .Config.Labels \"${VERSION_LABEL}\"}}" "${UI_IMAGE}"
}

# Prints the labels of an image of version $1, one key=value per line, sorted
# by key: its OCI annotations, which replace those of the base image, and the
# supported Sentinel version. The revision and the time of creation are those
# of the checkout's commit, so that a rebuild of a commit labels it alike.
expected_labels() {
    local version="$1" revision created sentinel
    revision="$(git -C "${REPO_ROOT}" rev-parse HEAD)" ||
        die "cannot read the commit of the checkout"
    created="$(TZ=UTC0 git -C "${REPO_ROOT}" log -1 \
        --date='format-local:%Y-%m-%dT%H:%M:%SZ' --format=%cd)" ||
        die "cannot read the time of the checkout's commit"
    sentinel="$(declared_version)"
    # The base image names its own maintainers, and this image states none.
    printf '%s\n' \
        "maintainer=" \
        "org.opencontainers.image.created=${created}" \
        "org.opencontainers.image.description=Web user interface for Sentinel" \
        "org.opencontainers.image.licenses=Apache-2.0" \
        "org.opencontainers.image.revision=${revision}" \
        "org.opencontainers.image.source=https://github.com/${REPOSITORY}" \
        "org.opencontainers.image.title=sentinel-aura" \
        "org.opencontainers.image.url=https://github.com/${REPOSITORY}" \
        "${VERSION_LABEL}=${version}" \
        "${SENTINEL_LABEL}=${sentinel}" |
        LC_ALL=C sort
}

# A numeric user that is not root, such as 101 or 101:101.
numeric_non_root() {
    [[ "$1" =~ ^[0-9]+(:[0-9]+)?$ ]] && ((10#${1%%:*} != 0))
}

# One numeric user ID per line, at least one, none of them root.
non_root_uids() {
    local uid
    [[ -n "$1" ]] || return 1
    while IFS= read -r uid; do
        numeric_non_root "${uid}" || return 1
    done <<<"$1"
}

# Runs a shell command in a container of the image as root, whose only
# capability lets it read every file of the image.
image_shell() {
    docker run --rm --network=none --user=0 --entrypoint=sh \
        --cap-drop=ALL --cap-add=DAC_READ_SEARCH --security-opt=no-new-privileges \
        "${UI_IMAGE}" -c "$1"
}

# Every label of the image is one that build sets, with its value, so that no
# label of the base image describes this image.
check_labels() {
    local version expected actual
    version="$(image_version)"
    [[ "${version}" == "${DEV_VERSION}" ]] || is_version "${version}" ||
        die "the image's version label, '${version}', is neither '${DEV_VERSION}' nor a version such as 1.2.3"
    expected="$(expected_labels "${version}")"
    actual="$(docker image inspect --format \
        '{{range $key, $value := .Config.Labels}}{{$key}}={{$value}}{{"\n"}}{{end}}' "${UI_IMAGE}")"
    if [[ "${actual}" != "${expected}" ]]; then
        diff <(printf '%s\n' "${expected}") <(printf '%s\n' "${actual}") >&2 || true
        die "the labels of the image differ from those that 'scripts/image.sh build' sets (< expected, > found)"
    fi
}

# The image declares a numeric user that is not root, holds no Node.js, and
# serves the production build, and nothing else, with the one server of
# nginx/default.conf.
check_image_content() {
    local user found image_files build_files servers expected_servers
    user="$(docker image inspect --format '{{.Config.User}}' "${UI_IMAGE}")"
    numeric_non_root "${user}" || die "the image user, '${user}', is not a numeric user other than root"
    found="$(image_shell 'find / -xdev \( -name node -o -name nodejs -o -name npm -o -name npx -o -name node_modules \) -print')"
    [[ -z "${found}" ]] || die "the image contains Node.js: ${found//$'\n'/, }"
    image_files="$(image_shell "cd ${WEB_ROOT} && find . -type f -exec sha256sum {} + | sort -k 2")"
    build_files="$(cd "${REPO_ROOT}/dist" && find . -type f -exec sha256sum {} + | LC_ALL=C sort -k 2)"
    [[ "${image_files}" == "${build_files}" ]] ||
        die "the web root holds other files than the production build"
    servers="$(image_shell 'ls -A /etc/nginx/conf.d && cat /etc/nginx/conf.d/default.conf')"
    expected_servers="$(printf 'default.conf\n' && cat "${REPO_ROOT}/nginx/default.conf")"
    [[ "${servers}" == "${expected_servers}" ]] ||
        die "nginx has another server than the one of nginx/default.conf"
}

remove_state() {
    if [[ -n "${CONTAINER}" ]]; then
        docker rm --force "${CONTAINER}" >/dev/null 2>&1 || true
    fi
    if [[ -n "${WORK_DIR}" ]]; then
        rm -rf -- "${WORK_DIR}"
    fi
}

# Requests the path $1 from nginx inside the container, with any further
# arguments of BusyBox's wget, which the image provides and with which
# compose.yaml checks its health.
request_inside() {
    local path="$1"
    shift
    docker exec "${CONTAINER}" wget --quiet --output-document=/dev/null "$@" \
        "http://127.0.0.1:${CONTAINER_PORT}${path}"
}

# Starts the container with the settings of the Pod Security restricted
# profile, without a network: the tests run in its network namespace, where
# they reach nginx on the loopback interface.
start_container() {
    CONTAINER="sentinel-aura-image-test-$$"
    docker run --detach --name "${CONTAINER}" --network=none \
        --cap-drop=ALL --security-opt=no-new-privileges "${UI_IMAGE}" >/dev/null
    local _
    for _ in $(seq 1 50); do
        if request_inside / 2>/dev/null; then
            return 0
        fi
        sleep 0.2
    done
    docker logs "${CONTAINER}" >&2 || true
    die "nginx does not answer in the container"
}

check_processes() {
    local uids
    uids="$(docker top "${CONTAINER}" -o pid,uid | awk 'NR > 1 { print $2 }')"
    non_root_uids "${uids}" || die "a process of the container runs as root"
}

# The access log records requests, but never the value of the Cookie header.
check_access_log() {
    local path="/access-log-check-${RANDOM}${RANDOM}"
    local value="cookie-value-${RANDOM}${RANDOM}"
    local logs="" _
    request_inside "${path}" --header "Cookie: __Host-sentinel_session=${value}" ||
        die "cannot request ${path} in the container"
    for _ in $(seq 1 25); do
        logs="$(docker logs "${CONTAINER}" 2>&1)"
        if [[ "${logs}" == *"${path}"* ]]; then
            break
        fi
        sleep 0.2
    done
    [[ "${logs}" == *"${path}"* ]] || die "the access log does not record the request of ${path}"
    [[ "${logs}" != *"${value}"* ]] || die "the access log records the value of the Cookie header"
}

# Writes the built image into a new working directory, where Trivy reads it,
# beside the directory of Trivy's cache, and pulls Trivy's image.
prepare_trivy() {
    require_image
    WORK_DIR="$(mktemp -d)"
    trap remove_state EXIT
    mkdir "${WORK_DIR}/cache"
    docker save --output "${WORK_DIR}/image.tar" "${UI_IMAGE}"
    docker image inspect "${TRIVY_IMAGE}" >/dev/null 2>&1 ||
        docker pull --quiet "${TRIVY_IMAGE}" >/dev/null
}

# Runs Trivy with the arguments $2..., offline when $1 is "offline", in a
# container with the user's IDs, without capabilities, and unable to gain
# privileges. It reads the archive of the image and package-lock.json, and
# writes only its cache, which nothing else reads; it receives neither the
# Docker socket nor a token. Its report is its standard output, so no file
# that it writes reaches the host.
run_trivy() {
    local -a network=()
    if [[ "$1" == offline ]]; then
        network=(--network=none)
    fi
    shift
    docker run --rm --pull=never "${network[@]}" \
        --user="$(id -u):$(id -g)" --cap-drop=ALL --security-opt=no-new-privileges \
        --volume="${WORK_DIR}/image.tar:/scan/image.tar:ro" \
        --volume="${REPO_ROOT}/package-lock.json:/scan/lockfile/package-lock.json:ro" \
        --volume="${WORK_DIR}/cache:/scan/cache" \
        "${TRIVY_IMAGE}" "$@" \
        --cache-dir=/scan/cache --disable-telemetry --skip-version-check
}

# Merges Trivy's SBOM of package-lock.json, $1, into its SBOM of the image,
# $2, for the image's version $3: the image depends on the application of the
# lockfile, which depends on the production dependencies. The image is named
# as a release; the local tag of the build is not part of the inventory.
# shellcheck disable=SC2016  # $lockfile, $name, and $version are jq variables
merge_sbom() {
    jq --slurpfile lockfile "$1" --arg name "${RELEASE_IMAGE}" --arg version "$3" '
        $lockfile[0] as $lock
        | $lock.metadata.component["bom-ref"] as $root
        | [$lock.dependencies[] | select(.ref == $root) | .dependsOn[]] as $applications
        | .metadata.component["bom-ref"] as $image
        | .metadata.component.name = $name
        | .metadata.component.version = $version
        | .metadata.component.properties |= ((. // []) | map(select(.name
            | IN("aquasecurity:trivy:Reference", "aquasecurity:trivy:RepoTag",
                "aquasecurity:trivy:RepoDigest") | not)))
        | .components += $lock.components
        | .dependencies = [
            (.dependencies[] | if .ref == $image then .dependsOn += $applications else . end),
            ($lock.dependencies[] | select(.ref != $root))
        ]
    ' "$2"
}

# Fails with the message $2 unless the jq filter $3 holds for the SBOM $1,
# with the further arguments of jq.
require_sbom() {
    local sbom="$1" message="$2" filter="$3"
    shift 3
    jq -e "$@" "${filter}" "${sbom}" >/dev/null || die "the SBOM ${message}"
}

# The SBOM $1 is a CycloneDX document that describes the release image of
# version $2 and lists its nginx package and exactly the production
# dependencies of package-lock.json, with resolvable references.
# shellcheck disable=SC2016  # $name, $version, and $lock are jq variables
check_sbom() {
    local sbom="$1" version="$2"
    require_sbom "${sbom}" "is not a CycloneDX document" \
        '.bomFormat == "CycloneDX" and (.specVersion | test("^1\\.[0-9]+$"))'
    require_sbom "${sbom}" "does not describe the image ${RELEASE_IMAGE} ${version}" \
        '.metadata.component | .type == "container" and .name == $name and .version == $version' \
        --arg name "${RELEASE_IMAGE}" --arg version "${version}"
    require_sbom "${sbom}" "lists no nginx package of the image" \
        'any(.components[]; .name == "nginx" and (.purl // "" | startswith("pkg:apk/")))'
    require_sbom "${sbom}" "lists other npm packages than the production dependencies of package-lock.json" '
        ([.components[] | select(.purl // "" | startswith("pkg:npm/"))
            | "\(if .group then .group + "/" else "" end)\(.name)@\(.version)"] | unique)
        == ([$lock[0].packages | to_entries[] | select(.key != "" and (.value.dev // false | not))
            | "\(.key | sub("^.*node_modules/"; ""))@\(.value.version)"] | unique)
    ' --slurpfile lock "${REPO_ROOT}/package-lock.json"
    require_sbom "${sbom}" "has duplicate or unresolved references" '
        ([.metadata.component["bom-ref"]] + [.components[]["bom-ref"]]) as $refs
        | ($refs | length) == ($refs | unique | length)
            and all(.dependencies[]; (.ref | IN($refs[])) and all(.dependsOn[]?; IN($refs[])))
    '
}

cmd_build() {
    [[ $# -le 1 ]] || die "build: takes at most the version of a release"
    local version="${1:-${DEV_VERSION}}" list label
    local -a labels=()
    [[ $# -eq 0 ]] || is_version "${version}" ||
        die "build: '${version}' is not a version such as 1.2.3"
    require_buildx
    list="$(expected_labels "${version}")"
    while IFS= read -r label; do
        labels+=(--label "${label}")
    done <<<"${list}"
    "${REPO_ROOT}/scripts/tooling.sh" run build
    [[ -f "${REPO_ROOT}/dist/index.html" ]] ||
        die "the production build wrote no dist/index.html"
    docker buildx build --load --file "${REPO_ROOT}/Containerfile" --tag "${UI_IMAGE}" \
        "${labels[@]}" "${REPO_ROOT}"
}

# The checks that need Docker run here; the image project of the end-to-end
# tests checks the responses, which it compares with the production build
# (docs/conventions.md, End-to-End Tests).
cmd_test() {
    [[ $# -eq 0 ]] || die "test: takes no arguments"
    require_image
    [[ -f "${REPO_ROOT}/dist/index.html" ]] ||
        die "missing dist/index.html; run 'scripts/image.sh build' first"
    trap remove_state EXIT

    check_labels
    check_image_content
    start_container
    check_processes
    "${REPO_ROOT}/scripts/tooling.sh" e2e "${CONTAINER}" image ||
        die "the responses of the image failed their checks; ${E2E_RESULTS_DIR}/image/report holds the report"
    check_access_log
    echo "image.sh: every check passed" >&2
}

# Trivy reads the operating system packages from the image. The build bundles
# the npm packages into its scripts without their manifests, where Trivy
# cannot see them, so it reads them from package-lock.json, without the
# development dependencies, which do not ship.
cmd_sbom() {
    [[ $# -eq 1 ]] || die "sbom: takes the path of the SBOM"
    local output="$1" version
    command -v jq >/dev/null 2>&1 || die "jq is required; ${SETUP}"
    require_image
    version="$(image_version)"
    prepare_trivy
    run_trivy offline image --input=/scan/image.tar --pkg-types=os \
        --format=cyclonedx --offline-scan >"${WORK_DIR}/image.cdx.json"
    run_trivy offline fs --format=cyclonedx --offline-scan \
        /scan/lockfile >"${WORK_DIR}/lockfile.cdx.json"
    merge_sbom "${WORK_DIR}/lockfile.cdx.json" "${WORK_DIR}/image.cdx.json" \
        "${version}" >"${WORK_DIR}/sbom.cdx.json"
    check_sbom "${WORK_DIR}/sbom.cdx.json" "${version}"
    mkdir -p -- "$(dirname -- "${output}")"
    cp -- "${WORK_DIR}/sbom.cdx.json" "${output}"
    echo "image.sh: ${output} holds the SBOM of ${RELEASE_IMAGE} ${version}" >&2
}

# The npm dependencies have the dependency audit (docs/deployment.md,
# Workflow Inventory), so the scan covers the operating system packages. The
# complete report reuses the vulnerability database of the first scan. A
# finding never fails the command; a scan that does not complete does.
cmd_scan() {
    [[ $# -eq 1 ]] || die "scan: takes the directory of the reports"
    local reports="$1"
    mkdir -p -- "${reports}"
    prepare_trivy
    run_trivy online image --input=/scan/image.tar --scanners=vuln --pkg-types=os \
        --ignore-unfixed --severity=HIGH,CRITICAL --exit-code=0 \
        --format=json >"${reports}/trivy-fixable.json"
    run_trivy online image --input=/scan/image.tar --scanners=vuln --pkg-types=os \
        --skip-db-update --exit-code=0 \
        --format=table >"${reports}/trivy-full.txt"
}

cmd_save() {
    [[ $# -eq 1 ]] || die "save: takes the path of the archive"
    require_image
    docker save --output "$1" "${UI_IMAGE}"
}

cmd_load() {
    [[ $# -eq 1 ]] || die "load: takes the path of the archive"
    docker load --quiet --input "$1" >&2
    require_image
}

# The version label is checked, so that only the image built for a release
# is published under its version.
cmd_push() {
    [[ $# -eq 1 ]] || die "push: takes the version of the release"
    local version="$1" label digest
    is_version "${version}" || die "push: '${version}' is not a version such as 1.2.3"
    require_image
    label="$(image_version)"
    [[ "${label}" == "${version}" ]] ||
        die "the built image is labeled as version '${label}', not as the release ${version}"
    docker tag "${UI_IMAGE}" "${RELEASE_IMAGE}:${version}"
    docker push --quiet "${RELEASE_IMAGE}:${version}" >&2
    digest="$(resolve_digest "${RELEASE_IMAGE}:${version}")"
    printf '%s@%s\n' "${RELEASE_IMAGE}" "${digest}"
}

# The build context holds what the Containerfile copies, as .dockerignore
# leaves it for a build from the repository: the production build, as dist/,
# and nginx/ of this checkout.
cmd_package() {
    [[ $# -eq 2 ]] || die "package: takes the directory of a production build and the tag of the image"
    local dist="$1" tag="$2"
    [[ -f "${dist}/index.html" ]] || die "package: ${dist} holds no production build"
    require_buildx
    WORK_DIR="$(mktemp -d)"
    trap remove_state EXIT
    cp -R -- "${dist}" "${WORK_DIR}/dist"
    cp -R -- "${REPO_ROOT}/nginx" "${WORK_DIR}/nginx"
    docker buildx build --load --file "${REPO_ROOT}/Containerfile" --tag "${tag}" \
        "${WORK_DIR}"
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        build | test | sbom | scan | save | load | push | package)
            check_docker_engine
            "cmd_${command}" "$@"
            ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
