#!/usr/bin/env bash
# Run the checks of CI's jobs, locally and in CI (docs/deployment.md, Workflow
# Inventory, Local run). The UI Checks and End-to-End Tests jobs of
# .github/workflows/ci.yml run their checks through this script, so that the
# list of checks exists once. A job stops at its first failed check; in CI,
# each check is a log group.
#
# The workflow keeps what needs the run: the dependency audit scope, which
# reads the event of the run, and the audit; the artifact uploads; and the
# Coverage Upload job, the only one that receives a secret. Locally,
# ui-checks runs the dependency audit when package.json, package-lock.json, or
# .npmrc differ from the merge base with origin/master, or when that merge
# base cannot be found, as a pull request does. The generated API client is
# compared with the working tree, which the check leaves unchanged, so the
# command runs before a commit. Not run here: PR Metadata, which needs the
# pull request; Renovate Validation; the Image Scan; the coverage upload.
#
# Usage:
#   scripts/ci.sh ui-checks   The checks of the UI Checks job: the pinned
#                             Sentinel contract, the generated API client, the
#                             type check, lint, format check, and unit and
#                             component tests, the build and the test of the
#                             image, and no dependency in the working tree
#   scripts/ci.sh e2e         The checks of the End-to-End Tests job: the
#                             end-to-end tests, then the test of the
#                             development proxy
#   scripts/ci.sh all         scripts/lint-shell.sh, as the Shell Lint job runs
#                             it, then ui-checks, then e2e, each even when an
#                             earlier one failed; fails when one of them
#                             failed. The check to run before pushing
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

readonly SCRIPTS="${REPO_ROOT}/scripts"
# The branch that pull requests target (docs/conventions.md, Git Conventions).
readonly BASE_BRANCH="origin/master"

# The check that runs, which the exit handler reports when the script ends
# during it; the copy of the generated API client that the handler restores;
# and the jobs of `all` that failed.
CURRENT_CHECK=""
CLIENT_COPY=""
FAILED_JOBS=()

in_ci() {
    [[ "${GITHUB_ACTIONS:-}" == true ]]
}

# Runs the check named $1, the command $2...: in CI in a log group, locally
# after a heading. A failure ends the script, and the exit handler reports it.
run_check() {
    CURRENT_CHECK="$1"
    shift
    if in_ci; then
        echo "::group::${CURRENT_CHECK}"
    else
        printf '\n--> %s\n' "${CURRENT_CHECK}" >&2
    fi
    "$@"
    if in_ci; then
        echo "::endgroup::"
    fi
    CURRENT_CHECK=""
}

restore_client() {
    rm -rf -- "${REPO_ROOT:?}/${GENERATED_DIR}"
    cp -pR -- "${CLIENT_COPY}/client" "${REPO_ROOT}/${GENERATED_DIR}"
    rm -rf -- "${CLIENT_COPY}"
    CLIENT_COPY=""
    warn "restored ${GENERATED_DIR}/ as the working tree held it"
}

# Restores the generated API client when its check did not complete, and
# reports the check during which the script ends.
on_exit() {
    if [[ -n "${CLIENT_COPY}" ]]; then
        restore_client
    fi
    if [[ -n "${CURRENT_CHECK}" ]]; then
        if in_ci; then
            echo "::endgroup::"
            echo "::error::${CURRENT_CHECK} failed"
        else
            warn "${CURRENT_CHECK} failed"
        fi
    fi
}

# Locally, the audit runs in the cases in which a pull request runs it
# (docs/deployment.md, Workflow Inventory, Dependency audit): when a
# dependency file differs from the merge base with BASE_BRANCH, or when that
# merge base cannot be found.
audit_if_required() {
    local base changed
    if base="$(git -C "${REPO_ROOT}" merge-base "${BASE_BRANCH}" HEAD 2>/dev/null)"; then
        changed="$(changed_dependency_files "${base}")"
        if [[ -z "${changed}" ]]; then
            echo "ci.sh: no dependency file differs from the merge base with ${BASE_BRANCH}; the dependency audit is not required" >&2
            return 0
        fi
        echo "ci.sh: the dependency audit is required; changed since the merge base with ${BASE_BRANCH}: ${changed//$'\n'/, }" >&2
    else
        warn "cannot find the merge base with ${BASE_BRANCH}; the dependency audit is required"
    fi
    run_check "Audit dependencies" "${SCRIPTS}/tooling.sh" audit
}

# Regenerates the API client from the pinned OpenAPI document and fails unless
# the result is identical to the client of the working tree
# (docs/architecture.md, API Client Generation). Unless it is, the exit
# handler restores the client of the working tree.
check_client() {
    local dir="${REPO_ROOT}/${GENERATED_DIR}" copy
    [[ -d "${dir}" ]] ||
        die "missing ${GENERATED_DIR}/; run 'scripts/tooling.sh generate' and commit the result"
    copy="$(mktemp -d)"
    if ! cp -pR -- "${dir}" "${copy}/client"; then
        rm -rf -- "${copy}"
        die "cannot copy ${GENERATED_DIR}/"
    fi
    CLIENT_COPY="${copy}"
    "${SCRIPTS}/tooling.sh" generate
    diff --recursive --brief -- "${copy}/client" "${dir}" >&2 ||
        die "${GENERATED_DIR}/ is not the client that the pinned OpenAPI document generates; run 'scripts/tooling.sh generate' and commit the result"
    rm -rf -- "${copy}"
    CLIENT_COPY=""
}

# The dependencies stay in their directory outside the working tree
# (docs/architecture.md, Development Environment): node_modules/ is only its
# empty mount point.
check_no_dependency_files() {
    local dir="${REPO_ROOT}/node_modules"
    if [[ -d "${dir}" && -n "$(find "${dir}" -mindepth 1 -print -quit)" ]]; then
        die "node_modules/ holds files; dependencies must stay in their directory outside the working tree"
    fi
}

cmd_ui_checks() {
    [[ $# -eq 0 ]] || die "ui-checks: takes no arguments"
    # In CI, the workflow decides the audit, from the event of the run, and
    # runs it.
    if ! in_ci; then
        audit_if_required
    fi
    run_check "Verify the pinned Sentinel contract" "${SCRIPTS}/sentinel-contract.sh" verify
    run_check "Verify that the API client is current" check_client
    run_check "Type check" "${SCRIPTS}/tooling.sh" run typecheck
    run_check "Lint" "${SCRIPTS}/tooling.sh" run lint
    run_check "Format check" "${SCRIPTS}/tooling.sh" run format:check
    run_check "Unit and component tests" "${SCRIPTS}/tooling.sh" run test
    run_check "Build the image" "${SCRIPTS}/image.sh" build
    run_check "Test the image" "${SCRIPTS}/image.sh" test
    run_check "Verify that no dependency reached the working tree" check_no_dependency_files
}

cmd_e2e() {
    [[ $# -eq 0 ]] || die "e2e: takes no arguments"
    run_check "End-to-end tests" "${SCRIPTS}/dev-env.sh" e2e
    run_check "Development proxy test" "${SCRIPTS}/dev-env.sh" test
}

# Runs the job named $1, the command $2..., in its own process, as CI runs
# each job on its own runner, and records its failure.
run_job() {
    local name="$1"
    shift
    printf '\n==> %s\n' "${name}" >&2
    "$@" || FAILED_JOBS+=("${name}")
}

cmd_all() {
    [[ $# -eq 0 ]] || die "all: takes no arguments"
    run_job "Shell Lint" "${SCRIPTS}/lint-shell.sh"
    run_job "UI Checks" "${SCRIPTS}/ci.sh" ui-checks
    run_job "End-to-End Tests" "${SCRIPTS}/ci.sh" e2e
    if ((${#FAILED_JOBS[@]} > 0)); then
        local failed
        printf -v failed '%s, ' "${FAILED_JOBS[@]}"
        die "failed jobs: ${failed%, }"
    fi
    echo "ci.sh: every check of Shell Lint, UI Checks, and End-to-End Tests passed" >&2
}

main() {
    if [[ $# -eq 0 ]]; then
        usage
        exit 2
    fi
    local command="$1"
    shift
    trap on_exit EXIT
    case "${command}" in
        ui-checks) cmd_ui_checks "$@" ;;
        e2e | all) "cmd_${command}" "$@" ;;
        -h | --help | help) usage ;;
        *)
            usage
            die "unknown command: ${command}"
            ;;
    esac
}

main "$@"
