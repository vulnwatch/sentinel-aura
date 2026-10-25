#!/usr/bin/env bash
# Build and test the image that serves the UI in production: nginx and the
# production build (docs/architecture.md, Packaging and Serving; Security
# Headers). The script runs on the host with Docker Engine and its Buildx
# plugin, locally and in CI; the production build and the tests of the
# image's responses run through scripts/tooling.sh, like every Node.js
# command.
#
# Usage:
#   scripts/image.sh build          Build the production build, then the image
#                                   localhost/sentinel-aura:local
#   scripts/image.sh test           Run the built image and check it: its user,
#                                   its content, and its processes; then its
#                                   responses, with the image project of the
#                                   end-to-end tests: the entry document
#                                   fallback, caching, the 404 of a missing
#                                   asset, the security headers, and the
#                                   absence of redirects; then an access log
#                                   without the Cookie header
#   scripts/image.sh save <file>    Write the built image to a tar archive
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

# The state of a test run, its container, and the build context of package,
# removed on exit.
CONTAINER=""
WORK_DIR=""

require_image() {
    docker image inspect "${UI_IMAGE}" >/dev/null 2>&1 ||
        die "missing image ${UI_IMAGE}; run 'scripts/image.sh build' first"
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

remove_test_state() {
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

cmd_build() {
    [[ $# -eq 0 ]] || die "build: takes no arguments"
    require_buildx
    "${REPO_ROOT}/scripts/tooling.sh" run build
    [[ -f "${REPO_ROOT}/dist/index.html" ]] ||
        die "the production build wrote no dist/index.html"
    docker buildx build --load --file "${REPO_ROOT}/Containerfile" --tag "${UI_IMAGE}" \
        "${REPO_ROOT}"
}

# The checks that need Docker run here; the image project of the end-to-end
# tests checks the responses, which it compares with the production build
# (docs/conventions.md, End-to-End Tests).
cmd_test() {
    [[ $# -eq 0 ]] || die "test: takes no arguments"
    require_image
    [[ -f "${REPO_ROOT}/dist/index.html" ]] ||
        die "missing dist/index.html; run 'scripts/image.sh build' first"
    trap remove_test_state EXIT

    check_image_content
    start_container
    check_processes
    "${REPO_ROOT}/scripts/tooling.sh" e2e "${CONTAINER}" image ||
        die "the responses of the image failed their checks; test-results/e2e/image/report holds the report"
    check_access_log
    echo "image.sh: every check passed" >&2
}

cmd_save() {
    [[ $# -eq 1 ]] || die "save: takes the path of the archive"
    require_image
    docker save --output "$1" "${UI_IMAGE}"
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
    trap remove_test_state EXIT
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
        build | test | save | package)
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
