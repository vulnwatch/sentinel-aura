#!/usr/bin/env bash
# Run the UI locally, and its end-to-end tests, against Sentinel's published
# image at the supported version, on one origin (docs/architecture.md, Local
# Development; Development Environment). Docker Compose runs the backend of
# compose.yaml: PostgreSQL, Redis, and Sentinel's API, loaded with Sentinel's
# example dataset. The development server runs through scripts/tooling.sh in
# the network of the backend and proxies /api to the API. The end-to-end tests
# and the local preview run the UI's production image instead, behind a
# reverse proxy that routes as the Sentinel host does. The script runs on the
# host with Docker Engine and its Buildx and Compose plugins, and the preview
# also with the GitHub CLI, gh.
#
# A backend is never migrated or loaded twice (Sentinel docs/deployment.md,
# Loading the Example Dataset). start reuses a running backend only while it
# is healthy and its configuration, compose.yaml and the supported version of
# contract/, is unchanged; otherwise it removes the backend with its data and
# creates a new one. stop removes it with its data. Every other command
# creates its own backend and removes it when it ends.
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
#                                    development server, that only the
#                                    development server publishes a port, on
#                                    the loopback interface; then run the
#                                    same-origin checks of the end-to-end
#                                    tests against it: the routing of the
#                                    proxy, the request headers that it
#                                    forwards, and a sign-in through it
#   scripts/dev-env.sh e2e [<browser>]
#                                    Build the UI's image, then run the
#                                    end-to-end tests in Chromium and
#                                    Firefox, or in <browser>, each against
#                                    a new backend
#   scripts/dev-env.sh update-screenshots
#                                    Build the UI's image, then run the
#                                    end-to-end tests in Chromium and write
#                                    the reference screenshots that are new
#                                    or differ
#   scripts/dev-env.sh preview <pr>  Run the production build that the CI of
#                                    the latest commit of pull request <pr>
#                                    tested, against a new backend, on
#                                    http://localhost:4173; Ctrl+C removes it
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

readonly COMPOSE_FILE_PATH="${REPO_ROOT}/compose.yaml"
# Sentinel's minimum, so that one Compose serves both repositories (Sentinel
# docs/deployment.md, Software Requirements).
readonly COMPOSE_MINIMUM="2.32.2"
readonly WAIT_TIMEOUT=300
# The port of the preview's proxy: keep in sync with compose.yaml.
readonly PREVIEW_PORT=4173

# The image of the UI that scripts/image.sh package builds from the production
# build of a pull request.
readonly PREVIEW_IMAGE="localhost/sentinel-aura:preview"
# Every profile of compose.yaml, so that the removal of a backend removes the
# containers of each.
readonly ALL_PROFILES="e2e,preview"

# The pull requests of the preview, the CI workflow that tests them, its job
# that retains their production build, and the artifact that holds it (with
# the supported version and image digest of their contract/), kept for seven
# days: keep in sync with .github/workflows/ci.yml.
readonly REPOSITORY="vulnwatch/sentinel-aura"
readonly CI_WORKFLOW="ci.yml"
readonly E2E_JOB="End-to-End Tests"
readonly PREVIEW_ARTIFACT="ui-preview"
# The files of this checkout that the preview uses instead of those of the
# pull request, which therefore runs nothing on the host.
readonly PREVIEW_LOCAL_FILES='^(compose\.yaml|Containerfile|\.dockerignore|nginx/.*|test/e2e/proxy\.conf|scripts/.*)$'

# One backend for each clone and purpose, named after the path of the clone:
# local development, the test of the development proxy, the end-to-end tests
# of each browser, and the preview.
CLONE_ID="$(clone_id)"
readonly CLONE_ID
readonly PROJECT="sentinel-aura-${CLONE_ID}"
readonly TEST_PROJECT="sentinel-aura-test-${CLONE_ID}"
readonly E2E_PROJECT_PREFIX="sentinel-aura-e2e"
readonly PREVIEW_PROJECT="sentinel-aura-preview-${CLONE_ID}"

# A user of the example dataset and its published password (Sentinel
# docs/features/platform/example-dataset.md, Credentials; Users).
readonly DATASET_USER="jdoe"
readonly DATASET_PASSWORD="example-dataset-password"

# The state of a run, removed on exit: its directory, and the project of the
# end-to-end environment or the preview that it created.
WORK_DIR=""
RUN_PROJECT=""
DEV_SERVER_PID=""

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
# version and the digest of its image, the identity of the backend's
# configuration, which the API's container carries as a label, and the UI's
# image of the profiles.
prepare() {
    check_docker_engine
    check_compose
    SENTINEL_VERSION="$(declared_version)"
    SENTINEL_DIGEST="$(pinned_digest)"
    SENTINEL_AURA_BACKEND="$({
        printf '%s\n' "${SENTINEL_VERSION}" "${SENTINEL_DIGEST}"
        cat "${COMPOSE_FILE_PATH}"
    } | sha256sum | cut -d ' ' -f 1)"
    SENTINEL_AURA_UI_IMAGE="${UI_IMAGE}"
    export SENTINEL_VERSION SENTINEL_DIGEST SENTINEL_AURA_BACKEND SENTINEL_AURA_UI_IMAGE
}

# Runs docker compose for the project $1 with the remaining arguments.
compose() {
    local project="$1"
    shift
    docker compose --project-name "${project}" --file "${COMPOSE_FILE_PATH}" "$@"
}

# The network of the project $1, which Compose creates, and the container of
# its development server.
network_name() {
    printf '%s_default\n' "$1"
}

dev_server_name() {
    dev_server_container "$(network_name "$1")"
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
# containers of every profile and the volumes that hold its data.
remove_backend() {
    docker rm --force "$(dev_server_name "$1")" >/dev/null 2>&1 || true
    COMPOSE_PROFILES="${ALL_PROFILES}" compose "$1" down --volumes --remove-orphans --timeout 5
}

# Creates the backend of the project $1, with the services of the profile $2
# when it names one, and waits until every service is healthy: the migration
# and the dataset load complete first, into a new database.
create_backend() {
    echo "dev-env.sh: creating the backend ${1}: Sentinel ${SENTINEL_VERSION}, loaded with the example dataset" >&2
    COMPOSE_PROFILES="${2:-}" compose "$1" up --detach --wait --wait-timeout "${WAIT_TIMEOUT}"
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
# loopback interface, in the background, and waits until it listens in its
# container, where the tests reach it.
start_test_server() {
    local name address="" _
    name="$(dev_server_name "${TEST_PROJECT}")"
    "${REPO_ROOT}/scripts/tooling.sh" dev "$(network_name "${TEST_PROJECT}")" 0 \
        >"${WORK_DIR}/dev-server.log" 2>&1 &
    DEV_SERVER_PID=$!
    # The first start may install the dependencies.
    for _ in $(seq 1 900); do
        address="$(docker port "${name}" "${DEV_PORT}/tcp" 2>/dev/null)" && break
        address=""
        kill -0 "${DEV_SERVER_PID}" 2>/dev/null || break
        sleep 0.2
    done
    if [[ -n "${address}" ]]; then
        [[ "${address}" =~ ^127\.0\.0\.1:[0-9]+$ ]] ||
            die "the development server is published on ${address//$'\n'/, }, not on the loopback interface only"
        for _ in $(seq 1 300); do
            if docker exec "${name}" bash -c ": </dev/tcp/127.0.0.1/${DEV_PORT}" 2>/dev/null; then
                return 0
            fi
            kill -0 "${DEV_SERVER_PID}" 2>/dev/null || break
            sleep 0.2
        done
    fi
    cat "${WORK_DIR}/dev-server.log" >&2
    die "the development server of the test does not listen"
}

# Only the development server publishes a port: no container of the backend
# does (docs/architecture.md, Development Environment).
check_backend_ports() {
    local id bindings=""
    for id in $(compose "${TEST_PROJECT}" ps --quiet); do
        bindings+="$(docker inspect --format '{{len .HostConfig.PortBindings}}' "${id}")"
    done
    [[ "${bindings}" =~ ^0+$ ]] || die "a container of the backend publishes a port"
}

# The checks that need Docker run here; the dev-server project of the
# end-to-end tests runs the same-origin checks in the network namespace of
# the development server (docs/conventions.md, End-to-End Tests).
cmd_test() {
    [[ $# -eq 0 ]] || die "test: takes no arguments"
    prepare
    WORK_DIR="$(mktemp -d)"
    trap remove_test_state EXIT

    # A backend that an interrupted run left behind.
    remove_backend "${TEST_PROJECT}" >/dev/null 2>&1
    if ! create_backend "${TEST_PROJECT}"; then
        compose "${TEST_PROJECT}" logs --no-color --tail=50 migrate dataset sentinel >&2 || true
        die "the backend of the test did not start"
    fi
    check_backend_ports
    start_test_server
    if ! "${REPO_ROOT}/scripts/tooling.sh" e2e "$(dev_server_name "${TEST_PROJECT}")" dev-server; then
        compose "${TEST_PROJECT}" logs --no-color --tail=50 sentinel >&2 || true
        tail -n 50 "${WORK_DIR}/dev-server.log" >&2
        die "the same-origin checks of the development server failed; test-results/e2e/dev-server/report holds the report"
    fi
    echo "dev-env.sh: every check passed" >&2
}

remove_run_state() {
    if [[ -n "${RUN_PROJECT}" ]]; then
        remove_backend "${RUN_PROJECT}" >/dev/null 2>&1 || true
    fi
    if [[ -n "${WORK_DIR}" ]]; then
        rm -rf -- "${WORK_DIR}"
    fi
}

# Creates the end-to-end environment of the browser $1 and runs its tests in
# it, through scripts/tooling.sh with the further arguments of its e2e
# command, before the container; then removes the environment. A new backend
# for each browser, so that every test of a browser starts from the dataset
# that was loaded for it (docs/conventions.md, End-to-End Tests).
run_e2e() {
    local target="$1" proxy status=0
    shift
    RUN_PROJECT="${E2E_PROJECT_PREFIX}-${target}-${CLONE_ID}"
    # An environment that an interrupted run left behind.
    remove_backend "${RUN_PROJECT}" >/dev/null 2>&1
    if ! create_backend "${RUN_PROJECT}" e2e; then
        COMPOSE_PROFILES=e2e compose "${RUN_PROJECT}" logs --no-color --tail=50 >&2 || true
        remove_backend "${RUN_PROJECT}" >/dev/null 2>&1 || true
        warn "the end-to-end environment of ${target} did not start"
        return 1
    fi
    proxy="$(COMPOSE_PROFILES=e2e compose "${RUN_PROJECT}" ps --quiet proxy)"
    "${REPO_ROOT}/scripts/tooling.sh" e2e "$@" "${proxy}" "${target}" || status=$?
    if ((status != 0)); then
        COMPOSE_PROFILES=e2e compose "${RUN_PROJECT}" logs --no-color --tail=50 sentinel ui proxy >&2 || true
    fi
    remove_backend "${RUN_PROJECT}" >/dev/null 2>&1 || true
    RUN_PROJECT=""
    return "${status}"
}

# The results of the browsers in an earlier run, so that only those of this
# one remain; those of the other projects stay.
remove_e2e_results() {
    rm -rf -- "${REPO_ROOT}/test-results/e2e/chromium" "${REPO_ROOT}/test-results/e2e/firefox"
}

cmd_e2e() {
    local -a browsers=(chromium firefox) failed=()
    if [[ $# -eq 1 && ("$1" == chromium || "$1" == firefox) ]]; then
        browsers=("$1")
    elif [[ $# -ne 0 ]]; then
        die "e2e: takes no argument, or the browser: chromium or firefox"
    fi
    prepare
    trap remove_run_state EXIT
    "${REPO_ROOT}/scripts/image.sh" build
    remove_e2e_results
    local target
    for target in "${browsers[@]}"; do
        run_e2e "${target}" || failed+=("${target}")
    done
    if ((${#failed[@]} > 0)); then
        die "the end-to-end tests failed in ${failed[*]}; test-results/e2e/<browser>/report holds the report of each browser"
    fi
    echo "dev-env.sh: the end-to-end tests passed in ${browsers[*]}" >&2
}

# The references are Chromium's (playwright.config.ts).
cmd_update_screenshots() {
    [[ $# -eq 0 ]] || die "update-screenshots: takes no arguments"
    prepare
    trap remove_run_state EXIT
    "${REPO_ROOT}/scripts/image.sh" build
    remove_e2e_results
    run_e2e chromium --update ||
        die "the end-to-end tests failed in chromium; test-results/e2e/chromium/report holds the report"
    echo "dev-env.sh: test/e2e/screenshots holds the current references; remove those that no test takes any more" >&2
}

# Prints the identifier of the CI run of the commit $1, a pull request event,
# once it completed with a successful end-to-end job; fails with the reason
# otherwise.
successful_ci_run() {
    local commit="$1" run id status job
    run="$(gh run list --repo "${REPOSITORY}" --workflow "${CI_WORKFLOW}" \
        --event pull_request --commit "${commit}" --limit 1 \
        --json databaseId,status --jq '.[] | "\(.databaseId) \(.status)"')" ||
        die "cannot list the CI runs of ${REPOSITORY}"
    read -r id status <<<"${run}"
    [[ "${id}" =~ ^[0-9]+$ ]] || die "commit ${commit:0:7} has no CI run yet"
    [[ "${status}" == completed ]] ||
        die "the CI run of commit ${commit:0:7} is ${status}; preview it once it completes"
    job="$(gh run view "${id}" --repo "${REPOSITORY}" --json jobs \
        --jq ".jobs[] | select(.name == \"${E2E_JOB}\") | .conclusion")" ||
        die "cannot read the CI run ${id} of ${REPOSITORY}"
    [[ "${job}" == success ]] ||
        die "the ${E2E_JOB} job of commit ${commit:0:7} did not succeed (${job:-it did not run}), so there is no tested build to preview"
    printf '%s\n' "${id}"
}

remove_preview_state() {
    remove_run_state
    docker image rm "${PREVIEW_IMAGE}" >/dev/null 2>&1 || true
}

# The pull request's only input is the artifact of its CI run: its production
# build, which nginx serves to the browser, and the supported version and
# image digest of its contract/, which select Sentinel's image. Everything
# else, and everything that runs on the host, comes from this checkout.
cmd_preview() {
    [[ $# -eq 1 && "$1" =~ ^[1-9][0-9]{0,8}$ ]] ||
        die "preview: takes the number of a pull request of ${REPOSITORY}"
    local pr="$1" pull_request state commit run local_files version digest
    command -v gh >/dev/null 2>&1 || die "preview needs the GitHub CLI, gh; ${SETUP}"
    gh auth status >/dev/null 2>&1 || die "gh is not signed in; run 'gh auth login'"
    prepare

    pull_request="$(gh pr view "${pr}" --repo "${REPOSITORY}" --json state,headRefOid \
        --jq '"\(.state) \(.headRefOid)"')" ||
        die "cannot read pull request #${pr} of ${REPOSITORY}"
    read -r state commit <<<"${pull_request}"
    [[ "${commit}" =~ ^[0-9a-f]{40}$ ]] || die "cannot read the latest commit of pull request #${pr}"
    [[ "${state}" == OPEN ]] || warn "pull request #${pr} is ${state,,}"
    run="$(successful_ci_run "${commit}")"

    trap remove_preview_state EXIT
    WORK_DIR="$(mktemp -d)"
    gh run download "${run}" --repo "${REPOSITORY}" --name "${PREVIEW_ARTIFACT}" \
        --dir "${WORK_DIR}/build" ||
        die "cannot download the build of CI run ${run}, which is kept for seven days; run 'gh run rerun ${run} --repo ${REPOSITORY}', then preview again"
    # The supported version of this checkout runs by its pinned digest
    # (docs/architecture.md, Backend Contract). Another version runs only as
    # a published release (Sentinel docs/deployment.md, Release Publication
    # and Immutability), by the digest that its tag names.
    version="$(version_in "${WORK_DIR}/build/${VERSION_FILE}")"
    digest="$(digest_in "${WORK_DIR}/build/${DIGEST_FILE}")"
    if [[ "${version}" == "${SENTINEL_VERSION}" ]]; then
        [[ "${digest}" == "${SENTINEL_DIGEST}" ]] ||
            die "pull request #${pr} pins ${digest} for Sentinel ${version}, not ${SENTINEL_DIGEST}, the digest that this checkout pins"
    else
        "${REPO_ROOT}/scripts/sentinel-contract.sh" verify-release "${version}" "${digest}"
    fi
    SENTINEL_VERSION="${version}"
    SENTINEL_DIGEST="${digest}"
    SENTINEL_AURA_UI_IMAGE="${PREVIEW_IMAGE}"
    "${REPO_ROOT}/scripts/image.sh" package "${WORK_DIR}/build/dist" "${PREVIEW_IMAGE}"

    local_files="$(gh pr view "${pr}" --repo "${REPOSITORY}" --json files \
        --jq '.files[].path' | grep -E "${PREVIEW_LOCAL_FILES}" || true)"
    if [[ -n "${local_files}" ]]; then
        warn "pull request #${pr} changes files that the preview takes from this checkout instead:"
        local -a files
        mapfile -t files <<<"${local_files}"
        printf '  %s\n' "${files[@]}" >&2
    fi

    # One preview for each clone: a new one replaces it.
    RUN_PROJECT="${PREVIEW_PROJECT}"
    remove_backend "${RUN_PROJECT}" >/dev/null 2>&1
    if ! create_backend "${RUN_PROJECT}" preview; then
        COMPOSE_PROFILES=preview compose "${RUN_PROJECT}" logs --no-color --tail=50 >&2 || true
        die "the preview did not start"
    fi
    cat >&2 <<EOF
dev-env.sh: pull request #${pr} at commit ${commit:0:7}, as its CI run ${run} built and tested it,
dev-env.sh: is on http://localhost:${PREVIEW_PORT}, with Sentinel ${SENTINEL_VERSION}. Sign in as ${DATASET_USER}, or as
dev-env.sh: another user of the example dataset, with the password ${DATASET_PASSWORD}.
dev-env.sh: Ctrl+C stops the preview and removes it with its data. The requests follow.
EOF
    trap 'exit 130' INT
    trap 'exit 143' TERM
    # nginx's access log, which omits the Cookie header, until Ctrl+C, without
    # the requests of its health check (compose.yaml), which BusyBox's wget
    # sends.
    COMPOSE_PROFILES=preview compose "${RUN_PROJECT}" logs --follow --no-color \
        --no-log-prefix --tail=0 preview | grep --line-buffered -v '"Wget" "-"$'
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        start | stop | logs | test | e2e | preview) "cmd_${command}" "$@" ;;
        update-screenshots) cmd_update_screenshots "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
