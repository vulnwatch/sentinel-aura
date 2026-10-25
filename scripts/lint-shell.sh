#!/usr/bin/env bash
# Lint the shell code of the repository (docs/conventions.md, Shell
# Scripting): shellcheck and shfmt on every shell script, library, and Git
# hook, and actionlint on every workflow, which also runs the shellcheck of its
# image on their run: blocks. shfmt takes its settings from .editorconfig.
# Each tool runs from its official image, pinned by version and digest,
# through Docker Engine, in a disposable container without network that reads
# the repository only: the script changes no file, and for a file that shfmt
# would format, it prints the diff to apply. The Shell Lint job of
# .github/workflows/ci.yml and scripts/ci.sh all lint the tracked files, and
# .githooks/pre-commit the staged ones.
#
# Usage:
#   scripts/lint-shell.sh            Lint the tracked files: a new file once
#                                    it is added to the index
#   scripts/lint-shell.sh --staged   Lint the staged files, as the working tree
#                                    holds them; when Docker Engine cannot run
#                                    the images, the lint is skipped with a
#                                    warning
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# Every *.sh file and every file under .githooks/, so that a new script or
# hook is covered without a list to maintain, and the workflows that GitHub
# reads.
readonly SHELL_PATHSPECS=('*.sh' '.githooks/*')
readonly WORKFLOW_PATHSPECS=(':(glob).github/workflows/*.yml' ':(glob).github/workflows/*.yaml')

# The official images of the tools, pinned by version and digest and updated
# by Renovate (docs/deployment.md, Dependency Updates). On the run: blocks,
# actionlint runs the shellcheck that its own image holds.
readonly SHELLCHECK_IMAGE="docker.io/koalaman/shellcheck:v0.11.0@sha256:61862eba1fcf09a484ebcc6feea46f1782532571a34ed51fedf90dd25f925a8d"
readonly SHFMT_IMAGE="docker.io/mvdan/shfmt:v3.14.1@sha256:8c06884a35683d8763fba6c0d9484d11a61a96da65f8d497d6f625825a6043f2"
readonly ACTIONLINT_IMAGE="docker.io/rhysd/actionlint:1.7.12@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667"

STAGED=false

# Prints the tracked files, or the staged ones, that match the pathspecs $@,
# each followed by a NUL byte.
selected_files() {
    if [[ "${STAGED}" == true ]]; then
        git diff --cached --name-only -z --diff-filter=ACMR -- "$@"
    else
        git ls-files -z -- "$@"
    fi | sort -z -u
}

# Fails unless Docker Engine can run the images $@: the engine is the
# supported one (docs/architecture.md, Development Environment), and each
# image is present or is downloaded.
prepare_images() {
    check_docker_engine
    local image
    for image in "$@"; do
        if ! docker image inspect "${image}" >/dev/null 2>&1; then
            echo "lint-shell.sh: downloading ${image}" >&2
            docker pull --quiet "${image}" >/dev/null ||
                die "cannot download ${image}"
        fi
    done
}

# Runs the tool of the image $1 with the arguments $2... in a disposable
# container, with the user and group IDs of the invoking user, without
# capabilities or network, in a read-only mount of the repository, its working
# directory.
run_image() {
    local image="$1"
    shift
    docker run --rm --pull=never \
        --user="$(id -u):$(id -g)" \
        --cap-drop=ALL \
        --security-opt=no-new-privileges \
        --network=none \
        --volume="${REPO_ROOT}:/work:ro,z" \
        --workdir=/work \
        "${image}" "$@"
}

main() {
    case "$*" in
        "") ;;
        --staged) STAGED=true ;;
        -h | --help | help)
            usage
            return 0
            ;;
        *)
            usage
            exit 2
            ;;
    esac
    cd "${REPO_ROOT}"
    local -a shell_files workflow_files images=()
    local status=0
    mapfile -d '' -t shell_files < <(selected_files "${SHELL_PATHSPECS[@]}")
    mapfile -d '' -t workflow_files < <(selected_files "${WORKFLOW_PATHSPECS[@]}")

    if ((${#shell_files[@]} > 0)); then
        images+=("${SHELLCHECK_IMAGE}" "${SHFMT_IMAGE}")
    fi
    if ((${#workflow_files[@]} > 0)); then
        images+=("${ACTIONLINT_IMAGE}")
    fi
    if ((${#images[@]} == 0)); then
        return 0
    fi
    # When the staged files are linted, the commit proceeds without the lint
    # if Docker Engine cannot run the images, because CI enforces it.
    if [[ "${STAGED}" == true ]]; then
        if ! (prepare_images "${images[@]}"); then
            warn "Docker Engine cannot run the images of the tools; skipping the lint (CI enforces it)"
            return 0
        fi
    else
        prepare_images "${images[@]}"
    fi

    if ((${#shell_files[@]} > 0)); then
        printf 'shellcheck and shfmt on %d file(s):\n' "${#shell_files[@]}"
        printf '  %s\n' "${shell_files[@]}"
        # --external-sources follows the libraries that a script sources.
        run_image "${SHELLCHECK_IMAGE}" --external-sources "${shell_files[@]}" || status=1
        run_image "${SHFMT_IMAGE}" --diff "${shell_files[@]}" || status=1
    fi
    if ((${#workflow_files[@]} > 0)); then
        printf 'actionlint on %d workflow(s):\n' "${#workflow_files[@]}"
        printf '  %s\n' "${workflow_files[@]}"
        run_image "${ACTIONLINT_IMAGE}" "${workflow_files[@]}" || status=1
    fi
    return "${status}"
}

main "$@"
