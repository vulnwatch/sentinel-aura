#!/usr/bin/env bash
# Run the repository's Node.js commands in disposable containers of the tooling
# image, through Docker Engine (docs/architecture.md, Development
# Environment). Every Node.js command runs through this script, locally and in
# CI; npm, npx, and node never run on the host.
#
# A container runs with the user and group IDs of the invoking user, without
# capabilities, and receives from the host the repository and the directory of
# its dependencies, nothing else. The repository is mounted read-only, except
# the output directories and, for the commands that change them by design, the
# formatted sources, the generated API client, or the npm manifest and
# lockfile. The dependencies live in a directory of this clone in the user's
# cache directory, mounted on node_modules/, which stays empty on the host.
# Every command but `npm` first installs them with `npm ci` when the directory
# is new or when the tooling image, package.json, package-lock.json, or .npmrc
# changed; a file beside the directory, which no container can reach, records
# the installation.
#
# Usage:
#   scripts/tooling.sh install               Install the dependencies (npm ci)
#   scripts/tooling.sh run <script> [args]   Run a package.json script, offline
#   scripts/tooling.sh format                Format the sources with Prettier
#   scripts/tooling.sh generate              Generate the API client from the
#                                            pinned OpenAPI document, offline
#   scripts/tooling.sh npm <args>            Run npm, with write access to
#                                            package.json and package-lock.json
#   scripts/tooling.sh audit                 Audit the installed dependencies:
#                                            their registry signatures and
#                                            attestations, and their known
#                                            vulnerabilities
#   scripts/tooling.sh dev <network> [<port>]
#                                            Start the development server in
#                                            the network of a local backend,
#                                            on http://localhost:5173 or on
#                                            <port>, 0 for a free one;
#                                            scripts/dev-env.sh starts both
#   scripts/tooling.sh e2e [--update] <container> <browser> [args]
#                                            Run the end-to-end tests in
#                                            <browser> in the network
#                                            namespace of <container>, the
#                                            reverse proxy of an end-to-end
#                                            environment; --update also writes
#                                            the reference screenshots that
#                                            are new or differ;
#                                            scripts/dev-env.sh e2e starts both
#   scripts/tooling.sh clean                 Remove the dependency directory
#
# Examples:
#   scripts/tooling.sh run check
#   scripts/tooling.sh run test -- src/router.test.tsx
#   scripts/tooling.sh npm install --save-dev <package>
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# The official Playwright image, pinned by version and digest and updated by
# Renovate. Its version matches @playwright/test in package.json, so that the
# browsers of the image are the ones that Playwright expects.
readonly TOOLING_IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble@sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf"

# The dependencies of this clone, in a directory named after the path of the
# clone, under the user's cache directory, and the file that records the
# installation that it holds.
CACHE_HOME="${XDG_CACHE_HOME:-}"
[[ "${CACHE_HOME}" == /* ]] || CACHE_HOME="${HOME:?HOME is not set}/.cache"
DEPS_DIR="${CACHE_HOME}/sentinel-aura/node-modules-$(clone_id)"
readonly DEPS_DIR
readonly STAMP_FILE="${DEPS_DIR}.stamp"

# Directories that every command may write; Git ignores them.
readonly OUTPUT_DIRS=(dist coverage test-results)
# Paths that Prettier formats: keep in sync with .prettierignore.
readonly FORMAT_PATHS=(src test index.html vite.config.ts orval.config.ts playwright.config.ts tsconfig.json .oxlintrc.json)
# The reference screenshots of the end-to-end tests: keep in sync with
# playwright.config.ts.
readonly SCREENSHOTS_DIR="test/e2e/screenshots"
# Tracked files that npm changes when a dependency changes.
readonly NPM_FILES=(package.json package-lock.json)

# Identifies an installation: the tooling image and the dependency files.
install_stamp() {
    {
        printf '%s\n' "${TOOLING_IMAGE}"
        (cd "${REPO_ROOT}" && sha256sum "${DEPENDENCY_FILES[@]}")
    } | sha256sum | cut -d ' ' -f 1
}

# Prints the stamp of the installation in the dependency directory, or
# nothing.
installed_stamp() {
    [[ -d "${DEPS_DIR}" ]] || return 0
    cat "${STAMP_FILE}" 2>/dev/null || true
}

# Appends to the array named by $1 a writable mount for each further argument,
# a path relative to the repository root. A missing output directory is
# created; any other path must exist. A path that is or lies under a symbolic
# link is refused: the code of a dependency can plant one wherever an earlier
# command could write, such as src/api/generated during `format`, and the
# mount would then make its target writable.
add_writable_mounts() {
    local -n mounts_ref="$1"
    shift
    local path
    for path in "$@"; do
        if [[ ! -e "${REPO_ROOT}/${path}" ]]; then
            [[ " ${OUTPUT_DIRS[*]} " == *" ${path} "* ]] ||
                die "missing ${path}"
            mkdir -p "${REPO_ROOT}/${path}"
        fi
        [[ "$(realpath -e -- "${REPO_ROOT}/${path}")" == "${REPO_ROOT}/${path}" ]] ||
            die "${path} is or lies under a symbolic link; it is not mounted writable"
        mounts_ref+=("--volume=${REPO_ROOT}/${path}:/work/${path}:rw,z")
    done
}

# Runs a command in a disposable container, with the user and group IDs of the
# invoking user, so that the files that it writes belong to that user. HOME
# points to a writable directory, because the image may have no account for
# those IDs. Arguments: further docker options, then "--", then the command
# and its arguments.
run_container() {
    local -a options=() tty=()
    while [[ $# -gt 0 && "$1" != "--" ]]; do
        options+=("$1")
        shift
    done
    [[ $# -gt 0 ]] || die "run_container: missing '--'"
    shift
    if [[ -t 0 && -t 1 ]]; then
        tty=(--interactive --tty)
    fi
    # Docker would create a missing directory to mount as root, and the
    # dependency directory needs a mount point inside the read-only
    # repository.
    mkdir -p "${DEPS_DIR}" "${REPO_ROOT}/node_modules"
    docker run --rm "${tty[@]}" \
        --user="$(id -u):$(id -g)" \
        --cap-drop=ALL \
        --security-opt=no-new-privileges \
        --shm-size=1g \
        --env=HOME=/tmp \
        --env=NPM_CONFIG_UPDATE_NOTIFIER=false \
        --volume="${REPO_ROOT}:/work:ro,z" \
        --volume="${DEPS_DIR}:/work/node_modules:rw,z" \
        --workdir=/work \
        "${options[@]}" \
        "${TOOLING_IMAGE}" "$@"
}

# The stamp is written on the host, after `npm ci` succeeds, so neither a
# failed installation nor the code of a dependency can mark the directory as
# installed.
install_dependencies() {
    local stamp
    stamp="$(install_stamp)"
    echo "tooling.sh: installing the dependencies in ${DEPS_DIR}" >&2
    rm -f "${STAMP_FILE}"
    run_container -- npm ci
    printf '%s\n' "${stamp}" >"${STAMP_FILE}"
}

ensure_installed() {
    [[ -f "${REPO_ROOT}/package-lock.json" ]] || die "missing package-lock.json"
    if [[ "$(installed_stamp)" != "$(install_stamp)" ]]; then
        install_dependencies
    fi
}

cmd_install() {
    [[ $# -eq 0 ]] || die "install: takes no arguments"
    [[ -f "${REPO_ROOT}/package-lock.json" ]] || die "missing package-lock.json"
    install_dependencies
}

cmd_run() {
    [[ $# -ge 1 ]] || die "run: missing the name of a package.json script"
    case "$1" in
        format) die "run format: use 'scripts/tooling.sh format', which can write the sources" ;;
        generate) die "run generate: use 'scripts/tooling.sh generate', which can write the generated client" ;;
        dev) die "run dev: use 'scripts/dev-env.sh start', which starts the backend and the development server" ;;
        e2e) die "run e2e: use 'scripts/dev-env.sh e2e', which starts the end-to-end environment" ;;
    esac
    ensure_installed
    local -a mounts=()
    add_writable_mounts mounts "${OUTPUT_DIRS[@]}"
    run_container --network=none "${mounts[@]}" -- npm run "$@"
}

cmd_format() {
    [[ $# -eq 0 ]] || die "format: takes no arguments"
    ensure_installed
    local -a mounts=()
    add_writable_mounts mounts "${FORMAT_PATHS[@]}"
    run_container --network=none "${mounts[@]}" -- npm run format
}

cmd_generate() {
    [[ $# -eq 0 ]] || die "generate: takes no arguments"
    ensure_installed
    mkdir -p "${REPO_ROOT}/${GENERATED_DIR}"
    local -a mounts=()
    add_writable_mounts mounts "${GENERATED_DIR}"
    run_container --network=none "${mounts[@]}" -- npm run generate
}

cmd_npm() {
    [[ $# -ge 1 ]] || die "npm: missing the npm command"
    [[ -f "${REPO_ROOT}/package-lock.json" ]] || die "missing package-lock.json"
    # No `npm ci` first: after a change of package.json by hand, such as an
    # override, the lockfile no longer matches it, `npm ci` would refuse to
    # install, and the `npm install` that updates the lockfile could never
    # run. npm install and npm update install what they change; other npm
    # commands see the installation as it is. The command may change the
    # installation, so the stamp goes first: the next command reinstalls
    # exactly what the lockfile records.
    local -a mounts=()
    add_writable_mounts mounts "${NPM_FILES[@]}"
    rm -f "${STAMP_FILE}"
    run_container "${mounts[@]}" -- npm "$@"
}

cmd_audit() {
    [[ $# -eq 0 ]] || die "audit: takes no arguments"
    ensure_installed
    # Both commands query the registry, so the container keeps the network;
    # the repository stays read-only. Each fails on any finding.
    run_container -- bash -c 'npm audit signatures && npm audit'
}

# The server joins the network of the backend, where its proxy reaches the API
# (vite.config.ts). The container is named after the network, so that a
# backend has one development server, which scripts/dev-env.sh finds by that
# name.
cmd_dev() {
    [[ $# -ge 1 && $# -le 2 ]] ||
        die "dev: takes the network of a local backend and an optional port; use 'scripts/dev-env.sh start'"
    local network="$1" port="${2:-${DEV_PORT}}" publish
    if ! [[ "${port}" =~ ^[0-9]{1,5}$ ]] || ((10#${port} > 65535)); then
        die "dev: invalid port '${port}'"
    fi
    # A bridge network, as Compose creates: on the host network, Docker would
    # ignore the published port and the server would listen on every
    # interface of the host.
    [[ "$(docker network inspect --format '{{.Driver}}' "${network}" 2>/dev/null)" == bridge ]] ||
        die "dev: no bridge network ${network}; start the backend with 'scripts/dev-env.sh start'"
    ensure_installed
    # The server listens on every interface of the container, which is
    # reachable from the host only through the port published on its
    # loopback interface; port 0 lets Docker choose a free one.
    publish="127.0.0.1:${port}:${DEV_PORT}"
    if ((10#${port} == 0)); then
        publish="127.0.0.1::${DEV_PORT}"
    fi
    run_container --name="$(dev_server_container "${network}")" --network="${network}" \
        --publish="${publish}" -- npm run dev -- --host 0.0.0.0
}

# The tests share the network namespace of the reverse proxy, where the UI is
# http://localhost:8080 (playwright.config.ts): a secure origin, from which
# the browsers accept the session cookie (docs/architecture.md, Local
# Development). Each browser keeps its results in test-results/e2e/<browser>/,
# its report included. The tests write only their results, and with --update
# the reference screenshots, which Playwright writes only when they are new
# or differ.
cmd_e2e() {
    local update=false
    if [[ "${1:-}" == --update ]]; then
        update=true
        shift
    fi
    [[ $# -ge 2 ]] ||
        die "e2e: takes the container of an end-to-end environment's proxy and a browser; use 'scripts/dev-env.sh e2e'"
    local container="$1" browser="$2"
    shift 2
    [[ "${browser}" =~ ^[a-z][a-z0-9-]*$ ]] || die "e2e: invalid browser '${browser}'"
    [[ "$(docker container inspect --format '{{.State.Running}}' "${container}" 2>/dev/null)" == true ]] ||
        die "e2e: no running container ${container}; use 'scripts/dev-env.sh e2e'"
    ensure_installed
    local -a mounts=() args=(--project="${browser}")
    add_writable_mounts mounts "${OUTPUT_DIRS[@]}"
    if [[ "${update}" == true ]]; then
        mkdir -p "${REPO_ROOT}/${SCREENSHOTS_DIR}"
        add_writable_mounts mounts "${SCREENSHOTS_DIR}"
        args+=(--update-snapshots=changed)
    fi
    run_container --network="container:${container}" "${mounts[@]}" \
        --env=PLAYWRIGHT_HTML_OUTPUT_DIR="test-results/e2e/${browser}/report" -- \
        npm run e2e -- "${args[@]}" "$@"
}

# Needs no container, so it works without Docker too.
cmd_clean() {
    [[ $# -eq 0 ]] || die "clean: takes no arguments"
    if [[ -e "${DEPS_DIR}" || -e "${STAMP_FILE}" ]]; then
        rm -rf -- "${DEPS_DIR}" "${STAMP_FILE}"
        echo "tooling.sh: removed ${DEPS_DIR}" >&2
    fi
    rmdir -- "$(dirname "${DEPS_DIR}")" 2>/dev/null || true
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        install | run | format | generate | npm | audit | dev | e2e)
            check_docker_engine
            "cmd_${command}" "$@"
            ;;
        clean) cmd_clean "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
