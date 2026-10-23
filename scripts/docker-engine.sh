#!/usr/bin/env bash
# Check that the container engine is the one that the repository supports:
# Docker Engine 28.0.0 or later on Linux, with its default daemon, which runs
# as root, reached through a local socket (docs/architecture.md, Development
# Environment). scripts/tooling.sh and scripts/image.sh run the check before
# they start a container, locally and in CI.
#
# Usage:
#   scripts/docker-engine.sh check   Exit with a message unless the engine is
#                                    supported
set -euo pipefail

# Docker Engine 28.0.0 stops other hosts of the network from reaching ports
# published on the loopback interface (moby/moby#49325).
readonly MINIMUM_MAJOR=28
readonly SETUP="see CONTRIBUTING.md (Development Setup)"

usage() {
    cat >&2 <<'EOF'
Usage: scripts/docker-engine.sh check

Exits with a message unless the container engine is Docker Engine 28.0.0 or
later on Linux, with its default daemon, reached through a local socket.
EOF
}

die() {
    echo "docker-engine.sh: $*" >&2
    exit 1
}

cmd_check() {
    [[ $# -eq 0 ]] || die "check: takes no arguments"
    [[ ${EUID} -ne 0 ]] ||
        die "run as a regular user: the containers run with your user ID, never as root"
    [[ "$(uname -s)" == Linux ]] || die "the host must run Linux; ${SETUP}"
    command -v docker >/dev/null 2>&1 || die "Docker Engine is required; ${SETUP}"

    # The containers mount paths of this host, so the daemon must run on it.
    local endpoint
    endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}')" ||
        die "cannot read the endpoint of the current Docker context"
    [[ "${endpoint}" == unix://* ]] ||
        die "the Docker endpoint ${endpoint} is not a local socket; ${SETUP}"

    # Docker Engine names its first component "Engine", and Docker Desktop
    # names its platform; Podman's Docker API names its component "Podman
    # Engine".
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
    ((10#${BASH_REMATCH[1]} >= MINIMUM_MAJOR)) ||
        die "Docker Engine ${version} is not supported; ${MINIMUM_MAJOR}.0.0 or later is; ${SETUP}"

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

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    case "${command}" in
        check) cmd_check "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
