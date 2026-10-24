#!/usr/bin/env bash
# Lint the shell code of the repository (docs/conventions.md, Shell
# Scripting): shellcheck and shfmt on every shell script, library, and Git
# hook, and actionlint on every workflow, which also runs shellcheck on its
# run: blocks. shfmt takes its settings from .editorconfig. The Shell Lint job
# of .github/workflows/ci.yml and scripts/ci.sh all lint the tracked files,
# and .githooks/pre-commit the staged ones.
#
# Usage:
#   scripts/lint-shell.sh            Lint the tracked files
#   scripts/lint-shell.sh --staged   Lint the staged files, as the working tree
#                                    holds them; a tool that is not installed
#                                    is skipped with a warning
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

# Every *.sh file and every file under .githooks/, so that a new script or
# hook is covered without a list to maintain, and the workflows that GitHub
# reads.
readonly SHELL_PATHSPECS=('*.sh' '.githooks/*')
readonly WORKFLOW_PATHSPECS=(':(glob).github/workflows/*.yml' ':(glob).github/workflows/*.yaml')

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

# Runs the tool $1 with the arguments $2...; when the staged files are
# linted, a tool that is not installed is skipped, because CI enforces it.
run_tool() {
    if [[ "${STAGED}" == true ]]; then
        run_if_installed "CI enforces it" "$@"
    else
        "$@"
    fi
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
    local -a shell_files workflow_files
    local status=0
    mapfile -d '' -t shell_files < <(selected_files "${SHELL_PATHSPECS[@]}")
    mapfile -d '' -t workflow_files < <(selected_files "${WORKFLOW_PATHSPECS[@]}")

    if ((${#shell_files[@]} > 0)); then
        printf 'shellcheck and shfmt on %d file(s):\n' "${#shell_files[@]}"
        printf '  %s\n' "${shell_files[@]}"
        # --external-sources follows the libraries that a script sources.
        run_tool shellcheck --external-sources "${shell_files[@]}" || status=1
        run_tool shfmt --diff "${shell_files[@]}" || status=1
    fi
    if ((${#workflow_files[@]} > 0)); then
        printf 'actionlint on %d workflow(s):\n' "${#workflow_files[@]}"
        printf '  %s\n' "${workflow_files[@]}"
        run_tool actionlint "${workflow_files[@]}" || status=1
    fi
    return "${status}"
}

main "$@"
