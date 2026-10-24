#!/usr/bin/env bash
# The code that the scripts under scripts/ and the Git hooks share, which they
# source after setting their strict mode (docs/conventions.md, Shell
# Scripting): their diagnostics and usage, the identity of the clone, the
# development server and the UI's image, the files of the installed
# dependencies and their changes, the directory of the generated API client,
# the supported Sentinel version and image digest of contract/,
# the checks of the container engine, and the digest that an image tag names
# in its registry.

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
readonly REPO_ROOT
readonly SETUP="see CONTRIBUTING.md (Development Setup)"

# Writes the message $* to stderr, prefixed with the name of the running
# script.
warn() {
    echo "${0##*/}: $*" >&2
}

# Writes the message $* like warn, then exits with status 1.
die() {
    warn "$@"
    exit 1
}

# Writes the header comment of the running script, its purpose and usage,
# without the comment markers, to stderr.
usage() {
    awk 'NR == 1 { next } !/^#/ { exit } { sub(/^# ?/, ""); print }' "$0" >&2
}

# Runs the command $2... when its program is installed; otherwise warns, with
# the note $1 on what still enforces the check, and succeeds.
run_if_installed() {
    local note="$1"
    shift
    if ! command -v "$1" >/dev/null 2>&1; then
        warn "$1 is not installed; skipping it (${note})"
        return 0
    fi
    "$@"
}

# Prints the identifier of this clone, from the path of its root: the
# dependency directory and the backends of a clone are named after it.
clone_id() {
    printf '%s' "${REPO_ROOT}" | sha256sum | cut -c1-12
}

# The port of the development server in its container: keep in sync with
# vite.config.ts.
# shellcheck disable=SC2034  # used by the scripts that source this file
readonly DEV_PORT=5173

# Prints the name of the development server of the backend network $1:
# scripts/tooling.sh dev names its container so, and scripts/dev-env.sh finds
# it by that name, so a backend has one development server.
dev_server_container() {
    printf '%s-dev-server\n' "$1"
}

# The UI's image that scripts/image.sh builds from this checkout, which the
# end-to-end environment of compose.yaml runs.
# shellcheck disable=SC2034  # used by the scripts that source this file
readonly UI_IMAGE="localhost/sentinel-aura:local"

# The files that define the installed dependencies: a change of one needs a
# new installation (scripts/tooling.sh) and the dependency audit
# (scripts/dependency-audit-scope.sh in CI, scripts/ci.sh locally).
readonly DEPENDENCY_FILES=(package.json package-lock.json .npmrc)

# Prints the files of DEPENDENCY_FILES that differ between the commit $1 and
# the working tree, one per line.
changed_dependency_files() {
    git -C "${REPO_ROOT}" diff --name-only "$1" -- "${DEPENDENCY_FILES[@]}"
}

# The directory of the generated API client: keep in sync with
# orval.config.ts.
# shellcheck disable=SC2034  # used by the scripts that source this file
readonly GENERATED_DIR="src/api/generated"

# The files of contract/ that declare the supported Sentinel version and pin
# the digest of its image (docs/architecture.md, Backend Contract), relative
# to the root of a checkout or of the build artifact of a pull request.
readonly VERSION_FILE="contract/sentinel-version"
readonly DIGEST_FILE="contract/sentinel-image-digest"

# Succeeds when $1 is one exact version, without the tag's "v".
is_version() {
    [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

# Succeeds when $1 is the digest of an image.
is_digest() {
    [[ "$1" =~ ^sha256:[0-9a-f]{64}$ ]]
}

# Prints the supported version that the file $1 declares.
version_in() {
    local name="${1#"${REPO_ROOT}/"}" version
    [[ -f "$1" ]] || die "missing ${name}"
    version="$(<"$1")"
    is_version "${version}" ||
        die "${name} must hold one exact version such as 1.2.3 (found '${version}')"
    printf '%s\n' "${version}"
}

# Prints the digest of Sentinel's image that the file $1 pins.
digest_in() {
    local name="${1#"${REPO_ROOT}/"}" digest
    [[ -f "$1" ]] || die "missing ${name}"
    digest="$(<"$1")"
    is_digest "${digest}" ||
        die "${name} must hold one digest such as sha256:<64 hexadecimal digits> (found '${digest}')"
    printf '%s\n' "${digest}"
}

# Prints the supported version that this checkout declares.
declared_version() {
    version_in "${REPO_ROOT}/${VERSION_FILE}"
}

# Prints the digest of Sentinel's image that this checkout pins.
pinned_digest() {
    digest_in "${REPO_ROOT}/${DIGEST_FILE}"
}

# Fails unless the container engine is the one that the repository supports:
# Docker Engine 28.0.0 or later on Linux, with its default daemon, which runs
# as root on this host, reached through its default socket
# (docs/architecture.md, Development Environment). scripts/tooling.sh and
# scripts/image.sh run the check before they start a container, locally and in
# CI, and scripts/dev-env.sh before it starts the local backend.
check_docker_engine() {
    # Docker Engine 28.0.0 stops other hosts of the network from reaching
    # ports published on the loopback interface (moby/moby#49325).
    local -r minimum_major=28
    # The default socket of the daemon, also reachable through /run. A daemon
    # behind any other endpoint runs elsewhere, as in a virtual machine or on
    # another host, or as the user, as in rootless mode, and the containers
    # mount paths of this host and rely on the daemon running as root on it.
    local -ar default_sockets=(unix:///var/run/docker.sock unix:///run/docker.sock)

    [[ ${EUID} -ne 0 ]] ||
        die "run as a regular user: the containers run with your user ID, never as root"
    [[ "$(uname -s)" == Linux ]] || die "the host must run Linux; ${SETUP}"
    command -v docker >/dev/null 2>&1 || die "Docker Engine is required; ${SETUP}"

    local endpoint
    endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')" ||
        die "cannot read the endpoint of the current Docker context"
    [[ " ${default_sockets[*]} " == *" ${endpoint} "* ]] ||
        die "the Docker endpoint ${endpoint} is not the default socket of Docker Engine, ${default_sockets[0]}; ${SETUP}"

    # Docker Engine names its first component "Engine", and Docker Desktop
    # names its platform; Podman's Docker API, which can also listen on the
    # default socket, names its component "Podman Engine".
    local server platform component version os
    server="$(docker version --format \
        '{{.Server.Platform.Name}}|{{(index .Server.Components 0).Name}}|{{.Server.Version}}|{{.Server.Os}}')" ||
        die "cannot reach the Docker daemon at ${endpoint}: start it and check that your user may use it; ${SETUP}"
    IFS='|' read -r platform component version os <<<"${server}"
    [[ "${platform}" != "Docker Desktop"* ]] ||
        die "Docker Desktop is not supported, Docker Engine is; ${SETUP}"
    [[ "${component}" == Engine ]] ||
        die "the daemon at ${endpoint} is ${component:-unknown}, not Docker Engine; ${SETUP}"
    [[ "${os}" == linux ]] || die "the daemon runs ${os:-an unknown system} containers, not Linux ones"
    [[ "${version}" =~ ^v?([0-9]+)\.[0-9]+\.[0-9]+ ]] ||
        die "cannot read the Docker Engine version '${version}'"
    ((10#${BASH_REMATCH[1]} >= minimum_major)) ||
        die "Docker Engine ${version} is not supported; ${minimum_major}.0.0 or later is; ${SETUP}"

    # Both modes map the user IDs of the containers to other IDs of the host,
    # so the files that a container writes would not belong to the user.
    local options
    options="$(docker info --format '{{range .SecurityOptions}}{{println .}}{{end}}')" ||
        die "cannot read the security options of the Docker daemon"
    [[ $'\n'"${options}" != *$'\n'name=rootless* ]] ||
        die "Docker's rootless mode is not supported; ${SETUP}"
    [[ $'\n'"${options}" != *$'\n'name=userns* ]] ||
        die "Docker's user namespace remapping is not supported; ${SETUP}"
}

# Fails unless Docker's Buildx plugin is installed.
require_buildx() {
    docker buildx version >/dev/null 2>&1 ||
        die "Docker's Buildx plugin is required; ${SETUP}"
}

# Prints the digest that the image tag $1, such as
# ghcr.io/vulnwatch/sentinel:1.2.3, names in its registry.
resolve_digest() {
    local digest
    require_buildx
    digest="$(docker buildx imagetools inspect "$1" --format '{{.Manifest.Digest}}')" ||
        die "cannot resolve $1 in the registry"
    is_digest "${digest}" || die "unexpected digest '${digest}' for $1"
    printf '%s\n' "${digest}"
}
