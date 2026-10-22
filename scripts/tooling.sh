#!/usr/bin/env bash
# Run the repository's Node.js commands in disposable containers of the tooling
# image, through rootless Podman (docs/architecture.md, Development
# Environment). Every Node.js command runs through this script, locally and in
# CI; npm, npx, and node never run on the host.
#
# A container receives the repository and nothing else from the host. The
# repository is mounted read-only, except the output directories and, for the
# commands that change them by design, the formatted sources or the npm
# manifest and lockfile. The dependencies live in a Podman volume of this
# clone, mounted on node_modules/, which stays empty on the host. Every command
# first installs them with `npm ci` when the volume is new or when the tooling
# image, package.json, package-lock.json, or .npmrc changed.
#
# Usage:
#   scripts/tooling.sh install               Install the dependencies (npm ci)
#   scripts/tooling.sh run <script> [args]   Run a package.json script, offline
#   scripts/tooling.sh format                Format the sources with Prettier
#   scripts/tooling.sh npm <args>            Run npm, with write access to
#                                            package.json and package-lock.json
#   scripts/tooling.sh dev                   Start the development server on
#                                            http://localhost:5173
#   scripts/tooling.sh clean                 Remove the dependency volume
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

# Directories that every command may write; Git ignores them.
readonly OUTPUT_DIRS=(dist coverage test-results)
# Paths that Prettier formats: keep in sync with .prettierignore.
readonly FORMAT_PATHS=(src index.html vite.config.ts tsconfig.json .oxlintrc.json)
# Tracked files that npm changes when a dependency changes.
readonly NPM_FILES=(package.json package-lock.json)
# Files whose change requires a new installation.
readonly INSTALL_INPUTS=(package.json package-lock.json .npmrc)
# Records, inside the volume, the installation that it holds.
readonly STAMP_FILE=".tooling-install-stamp"
readonly DEV_PORT=5173

usage() {
    cat >&2 <<'EOF'
Usage: scripts/tooling.sh <command> [arguments]

Commands:
  install               Install the dependencies (npm ci)
  run <script> [args]   Run a package.json script, offline
  format                Format the sources with Prettier
  npm <args>            Run npm, with write access to package.json and
                        package-lock.json
  dev                   Start the development server on http://localhost:5173
  clean                 Remove the dependency volume of this clone
EOF
}

die() {
    echo "tooling.sh: $*" >&2
    exit 1
}

# One volume for each clone, named after the path of the clone.
volume_name() {
    local hash
    hash="$(printf '%s' "${REPO_ROOT}" | sha256sum | cut -c1-12)"
    printf 'sentinel-aura-node-modules-%s\n' "${hash}"
}

# Identifies an installation: the tooling image and the install inputs.
install_stamp() {
    {
        printf '%s\n' "${TOOLING_IMAGE}"
        (cd "${REPO_ROOT}" && sha256sum "${INSTALL_INPUTS[@]}")
    } | sha256sum | cut -d ' ' -f 1
}

# Prints the stamp of the installation in the volume, or nothing.
installed_stamp() {
    local volume mountpoint
    volume="$(volume_name)"
    podman volume exists "${volume}" || return 0
    mountpoint="$(podman volume inspect --format '{{.Mountpoint}}' "${volume}")"
    cat "${mountpoint}/${STAMP_FILE}" 2>/dev/null || true
}

# Appends to the array named by $1 a writable mount for each further argument,
# a path relative to the repository root. A missing output directory is
# created; any other path must exist.
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
        mounts_ref+=("--volume=${REPO_ROOT}/${path}:/work/${path}:rw,z")
    done
}

# Runs a command in a disposable container. Arguments: further podman options,
# then "--", then the command and its arguments.
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
    # The volume needs a mount point inside the read-only repository.
    mkdir -p "${REPO_ROOT}/node_modules"
    podman run --rm "${tty[@]}" \
        --security-opt=no-new-privileges \
        --shm-size=1g \
        --env=NPM_CONFIG_UPDATE_NOTIFIER=false \
        --volume="${REPO_ROOT}:/work:ro,z" \
        --volume="$(volume_name):/work/node_modules" \
        --workdir=/work \
        "${options[@]}" \
        "${TOOLING_IMAGE}" "$@"
}

install_dependencies() {
    local stamp
    stamp="$(install_stamp)"
    echo "tooling.sh: installing the dependencies in volume $(volume_name)" >&2
    # shellcheck disable=SC2016  # $1 and $2 expand in the container's shell
    run_container -- bash -c \
        'rm -f "node_modules/$1" && npm ci && printf "%s\n" "$2" >"node_modules/$1"' \
        bash "${STAMP_FILE}" "${stamp}"
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

cmd_npm() {
    [[ $# -ge 1 ]] || die "npm: missing the npm command"
    ensure_installed
    local -a mounts=()
    add_writable_mounts mounts "${NPM_FILES[@]}"
    # The command may change the installation, so it removes the stamp first:
    # the next command reinstalls exactly what the lockfile records.
    # shellcheck disable=SC2016  # $1 expands in the container's shell
    run_container "${mounts[@]}" -- bash -c \
        'rm -f "node_modules/$1" && shift && npm "$@"' \
        bash "${STAMP_FILE}" "$@"
}

cmd_dev() {
    [[ $# -eq 0 ]] || die "dev: takes no arguments"
    ensure_installed
    # The server listens on every interface of the container, which is
    # reachable only through the port published on the host's loopback.
    run_container --publish="127.0.0.1:${DEV_PORT}:${DEV_PORT}" -- \
        npm run dev -- --host 0.0.0.0
}

cmd_clean() {
    [[ $# -eq 0 ]] || die "clean: takes no arguments"
    local volume
    volume="$(volume_name)"
    if podman volume exists "${volume}"; then
        podman volume rm "${volume}" >/dev/null
        echo "tooling.sh: removed volume ${volume}" >&2
    fi
}

main() {
    [[ ${EUID} -ne 0 ]] || die "run as a regular user: the containers must be rootless"
    command -v podman >/dev/null 2>&1 ||
        die "Podman is required; see CONTRIBUTING.md (Development Setup)"
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        install) cmd_install "$@" ;;
        run) cmd_run "$@" ;;
        format) cmd_format "$@" ;;
        npm) cmd_npm "$@" ;;
        dev) cmd_dev "$@" ;;
        clean) cmd_clean "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
