#!/usr/bin/env bash
# Run the UI locally against Sentinel's published image at the supported
# version, on one origin (docs/architecture.md, Local Development; Development
# Environment). Docker Compose runs the backend of compose.yaml: PostgreSQL,
# Redis, and Sentinel's API, loaded with Sentinel's example dataset. The
# development server runs through scripts/tooling.sh in the network of the
# backend and proxies /api to the API. The script runs on the host with Docker
# Engine, its Compose plugin, and curl.
#
# A backend is never migrated or loaded twice (Sentinel docs/deployment.md,
# Loading the Example Dataset). start reuses a running backend only while it
# is healthy and its configuration, compose.yaml and the supported version of
# contract/sentinel-version, is unchanged; otherwise it removes the backend
# with its data and creates a new one. stop removes it with its data.
#
# Usage:
#   scripts/dev-env.sh start         Start the backend, or reuse it, then the
#                                    development server on
#                                    http://localhost:5173; Ctrl+C stops the
#                                    development server only
#   scripts/dev-env.sh stop          Stop the development server and remove
#                                    the backend with its data
#   scripts/dev-env.sh logs [args]   Show the logs of the backend; the
#                                    arguments go to `docker compose logs`
#   scripts/dev-env.sh test          Check, with a separate backend and
#                                    development server, the routing of the
#                                    proxy, the request headers that it
#                                    forwards, and a sign-in through it
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly REPO_ROOT
readonly COMPOSE_FILE_PATH="${REPO_ROOT}/compose.yaml"
readonly VERSION_FILE="contract/sentinel-version"
# Sentinel's minimum, so that one Compose serves both repositories (Sentinel
# docs/deployment.md, Software Requirements).
readonly COMPOSE_MINIMUM="2.32.2"
readonly WAIT_TIMEOUT=300
# The port of the development server in its container: keep in sync with
# vite.config.ts and scripts/tooling.sh.
readonly DEV_PORT=5173
readonly SETUP="see CONTRIBUTING.md (Development Setup)"

# One backend for each clone, and one for its test, named after the path of
# the clone.
CLONE_ID="$(printf '%s' "${REPO_ROOT}" | sha256sum | cut -c1-12)"
readonly PROJECT="sentinel-aura-${CLONE_ID}"
readonly TEST_PROJECT="sentinel-aura-test-${CLONE_ID}"

# A user of the example dataset and its published password (Sentinel
# docs/features/platform/example-dataset.md, Credentials; Users).
readonly DATASET_USER="jdoe"
readonly DATASET_PASSWORD="example-dataset-password"
readonly SESSION_COOKIE="__Host-sentinel_session"

# The state of a test run, removed on exit.
WORK_DIR=""
DEV_SERVER_PID=""
BASE_URL=""
ORIGIN=""
FAILURES=0
RESPONSE_STATUS=""
RESPONSE_BODY=""
RESPONSE_HEADERS=""

usage() {
    cat >&2 <<'EOF'
Usage: scripts/dev-env.sh <command>

Commands:
  start         Start the backend, or reuse it, then the development server on
                http://localhost:5173; Ctrl+C stops the development server only
  stop          Stop the development server and remove the backend with its
                data
  logs [args]   Show the logs of the backend; the arguments go to
                `docker compose logs`
  test          Check the proxy and a sign-in through it, with a separate
                backend and development server
EOF
}

die() {
    echo "dev-env.sh: $*" >&2
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

# Fails unless the Compose plugin is at least COMPOSE_MINIMUM. The standalone
# docker-compose is not used.
check_compose() {
    local version
    version="$(docker compose version --short 2>/dev/null)" ||
        die "the Docker Compose plugin is required; ${SETUP}"
    [[ "${version}" =~ ^v?([0-9]+)\.([0-9]+)\.([0-9]+) ]] ||
        die "cannot read the Docker Compose version '${version}'"
    local -a found=("${BASH_REMATCH[@]:1}") minimum
    IFS=. read -r -a minimum <<<"${COMPOSE_MINIMUM}"
    local i
    for i in 0 1 2; do
        if ((10#${found[i]} != minimum[i])); then
            ((10#${found[i]} > minimum[i])) && return 0
            die "Docker Compose ${version} is not supported; ${COMPOSE_MINIMUM} or later is; ${SETUP}"
        fi
    done
}

# Checks the host and exports what compose.yaml interpolates: the supported
# version, and the identity of the backend's configuration, which the API's
# container carries as a label.
prepare() {
    "${REPO_ROOT}/scripts/docker-engine.sh" check
    check_compose
    SENTINEL_VERSION="$(declared_version)"
    SENTINEL_AURA_BACKEND="$({
        printf '%s\n' "${SENTINEL_VERSION}"
        cat "${COMPOSE_FILE_PATH}"
    } | sha256sum | cut -d ' ' -f 1)"
    export SENTINEL_VERSION SENTINEL_AURA_BACKEND
}

# Runs docker compose for the project $1 with the remaining arguments.
compose() {
    local project="$1"
    shift
    docker compose --project-name "${project}" --file "${COMPOSE_FILE_PATH}" "$@"
}

# The network of the project $1, which Compose creates, and the container of
# its development server, which scripts/tooling.sh names after the network.
network_name() {
    printf '%s_default\n' "$1"
}

dev_server_name() {
    printf '%s-dev-server\n' "$(network_name "$1")"
}

# Succeeds when the API of the project $1 runs, is healthy, and carries the
# current configuration.
backend_is_current() {
    local id state
    id="$(compose "$1" ps --quiet sentinel 2>/dev/null)" || return 1
    [[ -n "${id}" ]] || return 1
    state="$(docker inspect --format \
        '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}} {{index .Config.Labels "sentinel-aura.backend"}}' \
        "${id}" 2>/dev/null)" || return 1
    [[ "${state}" == "running healthy ${SENTINEL_AURA_BACKEND}" ]]
}

# Removes the development server and the backend of the project $1, with the
# volumes that hold its data.
remove_backend() {
    docker rm --force "$(dev_server_name "$1")" >/dev/null 2>&1 || true
    compose "$1" down --volumes --remove-orphans --timeout 5
}

# Creates the backend of the project $1 and waits until its API is healthy:
# the migration and the dataset load complete first, into a new database.
create_backend() {
    echo "dev-env.sh: creating the backend ${1}: Sentinel ${SENTINEL_VERSION}, loaded with the example dataset" >&2
    compose "$1" up --detach --wait --wait-timeout "${WAIT_TIMEOUT}"
}

cmd_start() {
    [[ $# -eq 0 ]] || die "start: takes no arguments"
    prepare
    if docker container inspect "$(dev_server_name "${PROJECT}")" >/dev/null 2>&1; then
        die "a development server of this clone runs already; stop it with Ctrl+C or 'scripts/dev-env.sh stop'"
    fi
    if backend_is_current "${PROJECT}"; then
        echo "dev-env.sh: reusing the running backend ${PROJECT}" >&2
    else
        remove_backend "${PROJECT}"
        create_backend "${PROJECT}" ||
            die "the backend did not start; see 'scripts/dev-env.sh logs'. The next start creates a new one"
    fi
    cat >&2 <<EOF
dev-env.sh: the UI is on http://localhost:${DEV_PORT}. Sign in as ${DATASET_USER}, or as another
dev-env.sh: user of the example dataset, with the password ${DATASET_PASSWORD}.
dev-env.sh: Ctrl+C stops the development server; 'scripts/dev-env.sh stop' removes the backend.
EOF
    exec "${REPO_ROOT}/scripts/tooling.sh" dev "$(network_name "${PROJECT}")"
}

cmd_stop() {
    [[ $# -eq 0 ]] || die "stop: takes no arguments"
    prepare
    remove_backend "${PROJECT}"
}

cmd_logs() {
    prepare
    compose "${PROJECT}" logs "$@"
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

matches() {
    [[ "$1" =~ $2 ]]
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

response_body() {
    cat "${RESPONSE_BODY}"
}

# Sends the request $1 for the path $2 to the development server, with any
# further curl arguments, and never follows a redirect.
request() {
    local method="$1" path="$2"
    shift 2
    RESPONSE_STATUS="$(curl --silent --show-error --globoff --max-time 10 \
        --request "${method}" --output "${RESPONSE_BODY}" \
        --dump-header "${RESPONSE_HEADERS}" --write-out '%{http_code}' \
        "$@" "${BASE_URL}${path}")"
}

remove_test_state() {
    docker rm --force "$(dev_server_name "${TEST_PROJECT}")" >/dev/null 2>&1 || true
    if [[ -n "${DEV_SERVER_PID}" ]]; then
        wait "${DEV_SERVER_PID}" 2>/dev/null || true
    fi
    remove_backend "${TEST_PROJECT}" >/dev/null 2>&1 || true
    if [[ -n "${WORK_DIR}" ]]; then
        rm -rf -- "${WORK_DIR}"
    fi
}

# Starts the development server of the test backend on a free port of the
# loopback interface, in the background, and waits until it answers.
start_test_server() {
    local name address _
    name="$(dev_server_name "${TEST_PROJECT}")"
    "${REPO_ROOT}/scripts/tooling.sh" dev "$(network_name "${TEST_PROJECT}")" 0 \
        >"${WORK_DIR}/dev-server.log" 2>&1 &
    DEV_SERVER_PID=$!
    # The first start may install the dependencies.
    for _ in $(seq 1 900); do
        if address="$(docker port "${name}" "${DEV_PORT}/tcp" 2>/dev/null)"; then
            check "the development server is published on the loopback interface only" \
                matches "${address}" '^127\.0\.0\.1:[0-9]+$'
            BASE_URL="http://localhost:${address##*:}"
            ORIGIN="${BASE_URL}"
            break
        fi
        kill -0 "${DEV_SERVER_PID}" 2>/dev/null || break
        sleep 0.2
    done
    for _ in $(seq 1 300); do
        if [[ -n "${BASE_URL}" ]] && curl --silent --output /dev/null --max-time 2 "${BASE_URL}/"; then
            return 0
        fi
        kill -0 "${DEV_SERVER_PID}" 2>/dev/null || break
        sleep 0.2
    done
    cat "${WORK_DIR}/dev-server.log" >&2
    die "the development server of the test does not answer"
}

check_backend() {
    local id bindings=""
    for id in $(compose "${TEST_PROJECT}" ps --quiet); do
        bindings+="$(docker inspect --format '{{len .HostConfig.PortBindings}}' "${id}")"
    done
    check "no container of the backend publishes a port" matches "${bindings}" '^0+$'
    request GET /api/openapi.json
    check "GET /api/openapi.json: 200" equals "${RESPONSE_STATUS}" 200
    check "the backend serves the OpenAPI document of Sentinel ${SENTINEL_VERSION}" \
        matches "$(response_body)" "\"info\":\\{[^{}]*\"version\":\"${SENTINEL_VERSION//./\\.}\""
}

# /api and the paths under it reach the API with their path unchanged, which
# answers a path of no endpoint with its routing response; every other path
# stays with the development server, which answers it with the entry document.
check_routing() {
    local path
    for path in /api '/api?probe=1' /api/v1/no-such-endpoint; do
        request GET "${path}"
        check "GET ${path} reaches the API" \
            contains "${RESPONSE_STATUS} $(response_body)" '404 {"code":"ROUTE_NOT_FOUND"'
    done
    for path in / /apidocs /api-keys /health /ready /auth/callback; do
        request GET "${path}" --header 'Accept: text/html'
        check "GET ${path} stays with the development server" \
            contains "${RESPONSE_STATUS} $(response_body)" '/@vite/client'
    done
}

# The development server adds no CORS headers and answers no preflight
# request itself: the API, which marks every response with X-Request-ID
# (Sentinel docs/api-spec.md, Request Tracing), answers it, and without
# CORS_ORIGINS it allows no other origin (Sentinel docs/configuration.md,
# Application).
check_no_cors() {
    local other="http://localhost:3000"
    request OPTIONS /api/v1/auth/login --header "Origin: ${other}" \
        --header 'Access-Control-Request-Method: POST'
    check "a preflight request reaches the API" \
        matches "$(header_values X-Request-ID)" '^[^[:space:]]+$'
    check "a preflight request gets no Access-Control-Allow-Origin" \
        equals "$(header_values Access-Control-Allow-Origin)" ""
    request GET / --header "Origin: ${other}"
    check "the development server sends no Access-Control-Allow-Origin" \
        equals "$(header_values Access-Control-Allow-Origin)" ""
}

# Logout without a credential changes nothing: the API answers 401 when its
# cross-origin request protection accepts the request, and 403 when it
# rejects it, which shows how the headers reached it (Sentinel
# docs/features/identity/authentication.md, Cross-Origin Request Protection).
check_cross_origin() {
    request POST /api/v1/auth/logout --header "Origin: ${ORIGIN}" --header 'Sec-Fetch-Site: same-origin'
    check "an unsafe request of the UI's origin passes the cross-origin protection" \
        contains "${RESPONSE_STATUS} $(response_body)" '401 {"code":"AUTH_NOT_AUTHENTICATED"'
    request POST /api/v1/auth/logout --header "Origin: ${ORIGIN}"
    check "Host reaches the API unchanged: it matches Origin" \
        contains "${RESPONSE_STATUS} $(response_body)" '401 {"code":"AUTH_NOT_AUTHENTICATED"'
    request POST /api/v1/auth/logout --header "Origin: ${ORIGIN}" --header 'Sec-Fetch-Site: cross-site'
    check "Sec-Fetch-Site reaches the API unchanged" \
        contains "${RESPONSE_STATUS} $(response_body)" '403 {"code":"AUTH_CROSS_ORIGIN_REJECTED"'
    request POST /api/v1/auth/logout --header 'Origin: http://ui.example.com'
    check "Origin reaches the API unchanged" \
        contains "${RESPONSE_STATUS} $(response_body)" '403 {"code":"AUTH_CROSS_ORIGIN_REJECTED"'
}

# A sign-in of a dataset user through the proxy, with the headers that a
# browser sends for a page of the UI's origin: the session cookie arrives with
# its attributes (Sentinel docs/features/identity/authentication.md, Session
# cookie), carries the session, and is cleared by the logout.
check_sign_in() {
    local -a browser=(--header "Origin: ${ORIGIN}" --header 'Sec-Fetch-Site: same-origin')
    local set_cookie cookie
    request POST /api/v1/auth/login "${browser[@]}" --header 'Content-Type: application/json' \
        --data "{\"username\":\"${DATASET_USER}\",\"password\":\"${DATASET_PASSWORD}\"}"
    check "POST /api/v1/auth/login as ${DATASET_USER}: 200" equals "${RESPONSE_STATUS}" 200
    set_cookie="$(header_values Set-Cookie | grep "^${SESSION_COOKIE}=" || true)"
    check "the login sets ${SESSION_COOKIE}" contains "${set_cookie}" "${SESSION_COOKIE}="
    local attribute
    for attribute in '; httponly' '; secure' '; samesite=strict' '; path=/'; do
        check "the session cookie has the attribute${attribute#;}" \
            contains "${set_cookie,,}" "${attribute}"
    done
    check "the session cookie has no Domain attribute" lacks "${set_cookie,,}" 'domain='
    cookie="${set_cookie%%;*}"

    request GET /api/v1/users/me "${browser[@]}" --header "Cookie: ${cookie}"
    check "GET /api/v1/users/me with the session cookie: ${DATASET_USER}" \
        contains "${RESPONSE_STATUS} $(response_body)" "\"username\":\"${DATASET_USER}\""
    check "GET /api/v1/users/me with the session cookie: 200" equals "${RESPONSE_STATUS}" 200
    request POST /api/v1/auth/logout "${browser[@]}" --header "Cookie: ${cookie}"
    check "POST /api/v1/auth/logout with the session cookie: 204" equals "${RESPONSE_STATUS}" 204
    check "the logout clears the session cookie" \
        matches "$(header_values Set-Cookie)" "^${SESSION_COOKIE}=;"
    request GET /api/v1/users/me "${browser[@]}" --header "Cookie: ${cookie}"
    check "GET /api/v1/users/me after the logout: 401" equals "${RESPONSE_STATUS}" 401
}

cmd_test() {
    [[ $# -eq 0 ]] || die "test: takes no arguments"
    command -v curl >/dev/null 2>&1 || die "curl is required"
    prepare
    WORK_DIR="$(mktemp -d)"
    trap remove_test_state EXIT
    RESPONSE_BODY="${WORK_DIR}/body"
    RESPONSE_HEADERS="${WORK_DIR}/headers"

    # A backend that an interrupted run left behind.
    remove_backend "${TEST_PROJECT}" >/dev/null 2>&1
    if ! create_backend "${TEST_PROJECT}"; then
        compose "${TEST_PROJECT}" logs --no-color --tail=50 migrate dataset sentinel >&2 || true
        die "the backend of the test did not start"
    fi
    start_test_server

    check_backend
    check_routing
    check_no_cors
    check_cross_origin
    check_sign_in

    if ((FAILURES > 0)); then
        die "${FAILURES} check(s) failed"
    fi
    echo "dev-env.sh: every check passed" >&2
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        start | stop | logs | test) "cmd_${command}" "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
