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
# Every command first installs them with `npm ci` when the directory is new or
# when the tooling image, package.json, package-lock.json, or .npmrc changed;
# a file beside the directory, which no container can reach, records the
# installation.
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
#   scripts/tooling.sh dev                   Start the development server on
#                                            http://localhost:5173
#   scripts/tooling.sh clean                 Remove the dependency directory
#
# Examples:
#   scripts/tooling.sh run check
#   scripts/tooling.sh run test -- src/router.test.tsx
#   scripts/tooling.sh npm install --save-dev <package>
set -euo pipefail

# The official Playwright image, pinned by version and digest and updated by
# Renovate. Its version matches @playwright/test in package.json, so that the
# browsers of the image are the ones that Playwright expects.
readonly TOOLING_IMAGE="mcr.microsoft.com/playwright:v1.64.1-noble@sha256:7852dc5a7d72f5fe458a597d690f6c42fbc8e9e26ddfa95f8e6ef552558d9bbf"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
readonly REPO_ROOT

# The dependencies of this clone, in a directory named after the path of the
# clone, under the user's cache directory, and the file that records the
# installation that it holds.
CACHE_HOME="${XDG_CACHE_HOME:-}"
[[ "${CACHE_HOME}" == /* ]] || CACHE_HOME="${HOME:?HOME is not set}/.cache"
DEPS_DIR="${CACHE_HOME}/sentinel-aura/node-modules-$(printf '%s' "${REPO_ROOT}" | sha256sum | cut -c1-12)"
readonly DEPS_DIR
readonly STAMP_FILE="${DEPS_DIR}.stamp"

# Directories that every command may write; Git ignores them.
readonly OUTPUT_DIRS=(dist coverage test-results)
# Paths that Prettier formats: keep in sync with .prettierignore.
readonly FORMAT_PATHS=(src index.html vite.config.ts orval.config.ts tsconfig.json .oxlintrc.json)
# The directory of the generated API client: keep in sync with orval.config.ts.
readonly GENERATED_DIR="src/api/generated"
# Tracked files that npm changes when a dependency changes.
readonly NPM_FILES=(package.json package-lock.json)
# Files whose change requires a new installation.
readonly INSTALL_INPUTS=(package.json package-lock.json .npmrc)
readonly DEV_PORT=5173

usage() {
    cat >&2 <<'EOF'
Usage: scripts/tooling.sh <command> [arguments]

Commands:
  install               Install the dependencies (npm ci)
  run <script> [args]   Run a package.json script, offline
  format                Format the sources with Prettier
  generate              Generate the API client from the pinned OpenAPI
                        document
  npm <args>            Run npm, with write access to package.json and
                        package-lock.json
  audit                 Audit the installed dependencies: their registry
                        signatures and attestations, and their known
                        vulnerabilities
  dev                   Start the development server on http://localhost:5173
  clean                 Remove the dependency directory of this clone
EOF
}

die() {
    echo "tooling.sh: $*" >&2
    exit 1
}

# Identifies an installation: the tooling image and the install inputs.
install_stamp() {
    {
        printf '%s\n' "${TOOLING_IMAGE}"
        (cd "${REPO_ROOT}" && sha256sum "${INSTALL_INPUTS[@]}")
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
        dev) die "run dev: use 'scripts/tooling.sh dev', which publishes the port" ;;
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
    ensure_installed
    local -a mounts=()
    add_writable_mounts mounts "${NPM_FILES[@]}"
    # The command may change the installation, so the stamp goes first: the
    # next command reinstalls exactly what the lockfile records.
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

cmd_dev() {
    [[ $# -eq 0 ]] || die "dev: takes no arguments"
    ensure_installed
    # The server listens on every interface of the container, which is
    # reachable only through the port published on the host's loopback.
    run_container --publish="127.0.0.1:${DEV_PORT}:${DEV_PORT}" -- \
        npm run dev -- --host 0.0.0.0
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
        install | run | format | generate | npm | audit | dev)
            "${REPO_ROOT}/scripts/docker-engine.sh" check
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
