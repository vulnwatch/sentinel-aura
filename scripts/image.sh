#!/usr/bin/env bash
# Build, test, and serve the image that serves the UI in production: nginx and
# the production build (docs/architecture.md, Packaging and Serving; Security
# Headers). The script runs on the host with Docker Engine, its Buildx plugin,
# and curl, locally and in CI; the production build runs through
# scripts/tooling.sh, like every Node.js command.
#
# Usage:
#   scripts/image.sh build          Build the production build, then the image
#   scripts/image.sh test           Run the built image and check it: its user,
#                                   its content, the entry document fallback,
#                                   caching, the 404 of a missing asset, the
#                                   security headers, the absence of redirects,
#                                   and an access log without the Cookie header
#   scripts/image.sh serve          Serve the built image on
#                                   http://127.0.0.1:4173
#   scripts/image.sh save <file>    Write the built image to a tar archive
#   scripts/image.sh package <dist> <tag>
#                                   Build the image <tag> from a production
#                                   build that another run produced, such as
#                                   the one that the CI of a pull request
#                                   retains, with the Containerfile and the
#                                   nginx configuration of this checkout
set -euo pipefail

readonly IMAGE="localhost/sentinel-aura:local"
# The port on which nginx listens in the container: keep in sync with
# nginx/default.conf.
readonly CONTAINER_PORT=8080
# Vite's port for a preview of the production build, published on the
# loopback interface only.
readonly SERVE_PORT=4173
# Keep in sync with the Containerfile.
readonly WEB_ROOT="/usr/share/nginx/html"

# The headers of docs/architecture.md (Security Headers), which every response
# carries exactly once with these values. The style-src hash is the one of
# nginx/default.conf, which explains it.
readonly CSP="default-src 'none'; script-src 'self'; style-src 'self' 'sha256-38RhXrc7EdReTKsOm23ZPOCUgniTUUcjky8QOOrQx6o='; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; require-trusted-types-for 'script'; trusted-types 'none'"
readonly SECURITY_HEADERS=(
    "Content-Security-Policy: ${CSP}"
    "X-Content-Type-Options: nosniff"
    "Referrer-Policy: no-referrer"
    "Cross-Origin-Opener-Policy: same-origin"
    "Cross-Origin-Resource-Policy: same-origin"
)
readonly ENTRY_CACHE_CONTROL="no-cache"
readonly ASSET_CACHE_CONTROL="public, max-age=31536000, immutable"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly REPO_ROOT

# The state of a test run, the container and the directory of the responses,
# and the build context of package, removed on exit.
CONTAINER=""
WORK_DIR=""
BASE_URL=""
FAILURES=0
RESPONSE_STATUS=""
RESPONSE_BODY=""
RESPONSE_HEADERS=""

usage() {
    cat >&2 <<'EOF'
Usage: scripts/image.sh <command>

Commands:
  build          Build the production build, then the image
  test           Run the built image and check how it serves the build
  serve          Serve the built image on http://127.0.0.1:4173
  save <file>    Write the built image to a tar archive
  package <dist> <tag>
                 Build the image <tag> from the production build in <dist>,
                 with the Containerfile and nginx configuration of this
                 checkout
EOF
}

die() {
    echo "image.sh: $*" >&2
    exit 1
}

require_image() {
    docker image inspect "${IMAGE}" >/dev/null 2>&1 ||
        die "missing image ${IMAGE}; run 'scripts/image.sh build' first"
}

# Records the outcome of one check: the description, then the command whose
# status decides it.
check() {
    local description="$1"
    shift
    if "$@"; then
        printf 'ok   %s\n' "${description}"
    else
        printf 'FAIL %s\n' "${description}" >&2
        FAILURES=$((FAILURES + 1))
    fi
}

equals() {
    [[ "$1" == "$2" ]]
}

contains() {
    [[ "$1" == *"$2"* ]]
}

lacks() {
    [[ "$1" != *"$2"* ]]
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

# A Permissions-Policy header that only disables features: one header whose
# entries all have the form feature=().
disables_features_only() {
    local policy="$1" entry
    local -a entries
    [[ -n "${policy}" && "${policy}" != *$'\n'* ]] || return 1
    IFS=',' read -r -a entries <<<"${policy}"
    for entry in "${entries[@]}"; do
        entry="${entry#"${entry%%[! ]*}"}"
        [[ "${entry}" =~ ^[a-z][a-z0-9-]*=\(\)$ ]] || return 1
    done
}

# Prints the values of the header named $1 in the last response, one per line.
header_values() {
    awk -v name="$1" '
        BEGIN { name = tolower(name) }
        {
            sub(/\r$/, "")
            colon = index($0, ":")
            if (colon > 1 && tolower(substr($0, 1, colon - 1)) == name) {
                value = substr($0, colon + 1)
                sub(/^[ \t]+/, "", value)
                print value
            }
        }' "${RESPONSE_HEADERS}"
}

# Requests the path $1 from the container, with any further curl arguments,
# and never follows a redirect.
request() {
    local path="$1"
    shift
    RESPONSE_STATUS="$(curl --silent --show-error --globoff --max-time 10 \
        --output "${RESPONSE_BODY}" --dump-header "${RESPONSE_HEADERS}" \
        --write-out '%{http_code}' "$@" "${BASE_URL}${path}")"
}

# The headers of every response: the security headers, no
# Strict-Transport-Security, and no redirect.
check_common_headers() {
    local label="$1" expected name
    for expected in "${SECURITY_HEADERS[@]}"; do
        name="${expected%%: *}"
        check "${label}: ${name}" equals "$(header_values "${name}")" "${expected#*: }"
    done
    check "${label}: Permissions-Policy disables features only" \
        disables_features_only "$(header_values Permissions-Policy)"
    check "${label}: no Strict-Transport-Security" \
        equals "$(header_values Strict-Transport-Security)" ""
    check "${label}: no Location" equals "$(header_values Location)" ""
}

# A path that the application resolves: the entry document, never cached
# without revalidation. Further arguments go to curl.
check_entry_document() {
    local label="$1" path="$2"
    shift 2
    request "${path}" "$@"
    check "${label}: 200" equals "${RESPONSE_STATUS}" 200
    check "${label}: the entry document" \
        cmp -s "${RESPONSE_BODY}" "${REPO_ROOT}/dist/index.html"
    check "${label}: Cache-Control: ${ENTRY_CACHE_CONTROL}" \
        equals "$(header_values Cache-Control)" "${ENTRY_CACHE_CONTROL}"
    check_common_headers "${label}"
}

# A content-hashed file of the build, cached for a year, with the type $2.
check_asset() {
    local path="$1" type="$2" label="GET $1"
    request "${path}"
    check "${label}: 200" equals "${RESPONSE_STATUS}" 200
    check "${label}: the file of the build" \
        cmp -s "${RESPONSE_BODY}" "${REPO_ROOT}/dist${path}"
    check "${label}: Cache-Control: ${ASSET_CACHE_CONTROL}" \
        equals "$(header_values Cache-Control)" "${ASSET_CACHE_CONTROL}"
    check "${label}: Content-Type: ${type}" \
        equals "$(header_values Content-Type)" "${type}"
    check_common_headers "${label}"
}

# A path of the asset directory that is no file of the build.
check_missing_asset() {
    local path="$1" label="GET $1"
    request "${path}"
    check "${label}: 404" equals "${RESPONSE_STATUS}" 404
    check "${label}: not cached" equals "$(header_values Cache-Control)" ""
    check_common_headers "${label}"
}

# Runs a shell command in a container of the image as root, whose only
# capability lets it read every file of the image.
image_shell() {
    docker run --rm --network=none --user=0 --entrypoint=sh \
        --cap-drop=ALL --cap-add=DAC_READ_SEARCH --security-opt=no-new-privileges \
        "${IMAGE}" -c "$1"
}

check_image_content() {
    local user image_files build_files found
    user="$(docker image inspect --format '{{.Config.User}}' "${IMAGE}")"
    check "the image user, ${user}, is numeric and not root" numeric_non_root "${user}"
    found="$(image_shell 'find / -xdev \( -name node -o -name nodejs -o -name npm -o -name npx -o -name node_modules \) -print')"
    check "the image contains no Node.js" equals "${found}" ""
    image_files="$(image_shell "cd ${WEB_ROOT} && find . -type f -exec sha256sum {} + | sort -k 2")"
    build_files="$(cd "${REPO_ROOT}/dist" && find . -type f -exec sha256sum {} + | LC_ALL=C sort -k 2)"
    check "the web root holds the production build and nothing else" \
        equals "${image_files}" "${build_files}"
    check "nginx has one server, the one of nginx/default.conf" \
        equals "$(image_shell 'ls -A /etc/nginx/conf.d && cat /etc/nginx/conf.d/default.conf')" \
        "$(printf 'default.conf\n' && cat "${REPO_ROOT}/nginx/default.conf")"
}

remove_test_state() {
    if [[ -n "${CONTAINER}" ]]; then
        docker rm --force "${CONTAINER}" >/dev/null 2>&1 || true
    fi
    if [[ -n "${WORK_DIR}" ]]; then
        rm -rf -- "${WORK_DIR}"
    fi
}

# Starts the container with the settings of the Pod Security restricted
# profile, published on a free port of the loopback interface.
start_container() {
    CONTAINER="sentinel-aura-image-test-$$"
    docker run --detach --name "${CONTAINER}" \
        --cap-drop=ALL --security-opt=no-new-privileges \
        --publish "127.0.0.1::${CONTAINER_PORT}" "${IMAGE}" >/dev/null
    BASE_URL="http://$(docker port "${CONTAINER}" "${CONTAINER_PORT}/tcp")"
    local _
    for _ in $(seq 1 50); do
        if curl --silent --output /dev/null --max-time 2 "${BASE_URL}/"; then
            return 0
        fi
        sleep 0.2
    done
    docker logs "${CONTAINER}" >&2 || true
    die "the container does not answer on ${BASE_URL}"
}

# The access log records requests, but never the value of the Cookie header.
check_access_log() {
    local path="/access-log-check-${RANDOM}${RANDOM}"
    local cookie="__Host-sentinel_session=cookie-value-${RANDOM}${RANDOM}"
    local logs="" _
    request "${path}" --header "Cookie: ${cookie}"
    for _ in $(seq 1 25); do
        logs="$(docker logs "${CONTAINER}" 2>&1)"
        if contains "${logs}" "${path}"; then
            break
        fi
        sleep 0.2
    done
    check "the access log records the request of ${path}" contains "${logs}" "${path}"
    check "the access log omits the Cookie header" lacks "${logs}" "${cookie#*=}"
}

require_buildx() {
    docker buildx version >/dev/null 2>&1 ||
        die "the Docker Buildx plugin is required; see CONTRIBUTING.md (Development Setup)"
}

cmd_build() {
    [[ $# -eq 0 ]] || die "build: takes no arguments"
    require_buildx
    "${REPO_ROOT}/scripts/tooling.sh" run build
    [[ -f "${REPO_ROOT}/dist/index.html" ]] ||
        die "the production build wrote no dist/index.html"
    docker buildx build --load --file "${REPO_ROOT}/Containerfile" --tag "${IMAGE}" \
        "${REPO_ROOT}"
}

cmd_test() {
    [[ $# -eq 0 ]] || die "test: takes no arguments"
    command -v curl >/dev/null 2>&1 || die "curl is required"
    require_image
    [[ -f "${REPO_ROOT}/dist/index.html" ]] ||
        die "missing dist/index.html; run 'scripts/image.sh build' first"
    local script asset_dir
    script="$(grep -o '/assets/[^"]*\.js' "${REPO_ROOT}/dist/index.html" | head -n 1)"
    [[ -n "${script}" ]] || die "dist/index.html references no script under /assets/"
    asset_dir="$(dirname "${script}")"

    WORK_DIR="$(mktemp -d)"
    trap remove_test_state EXIT
    RESPONSE_BODY="${WORK_DIR}/body"
    RESPONSE_HEADERS="${WORK_DIR}/headers"

    check_image_content
    start_container
    check "no process of the container runs as root" \
        non_root_uids "$(docker top "${CONTAINER}" -o pid,uid | awk 'NR > 1 { print $2 }')"

    # Paths outside the asset directory, the asset directory itself without a
    # trailing slash included, which nginx would otherwise redirect to an
    # absolute URL built from the Host header.
    local path
    for path in / /index.html /tickets/SNTL-1/audit \
        '/auth/callback?code=example-code&state=example-state' \
        /health /ready "${asset_dir}"; do
        check_entry_document "GET ${path}" "${path}"
    done
    check_entry_document "GET ${asset_dir} through another host" "${asset_dir}" \
        --header 'Host: sentinel.example.com' --header 'X-Forwarded-Proto: https'

    check_asset "${script}" "application/javascript"
    local stylesheet
    stylesheet="$(grep -o '/assets/[^"]*\.css' "${REPO_ROOT}/dist/index.html" | head -n 1)"
    if [[ -n "${stylesheet}" ]]; then
        check_asset "${stylesheet}" "text/css"
    fi
    check_missing_asset "${asset_dir}/missing.js"
    check_missing_asset "${asset_dir}/"

    check_access_log

    if ((FAILURES > 0)); then
        die "${FAILURES} check(s) failed"
    fi
    echo "image.sh: every check passed" >&2
}

cmd_serve() {
    [[ $# -eq 0 ]] || die "serve: takes no arguments"
    require_image
    echo "image.sh: serving ${IMAGE} on http://127.0.0.1:${SERVE_PORT}; stop with Ctrl+C" >&2
    docker run --rm --cap-drop=ALL --security-opt=no-new-privileges \
        --publish "127.0.0.1:${SERVE_PORT}:${CONTAINER_PORT}" "${IMAGE}"
}

cmd_save() {
    [[ $# -eq 1 ]] || die "save: takes the path of the archive"
    require_image
    docker save --output "$1" "${IMAGE}"
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
        build | test | serve | save | package)
            "${REPO_ROOT}/scripts/docker-engine.sh" check
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
