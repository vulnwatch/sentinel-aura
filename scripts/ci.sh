#!/usr/bin/env bash
# Run the checks of CI's jobs, locally and in CI (docs/deployment.md, Workflow
# Inventory, Local run). The UI Checks and End-to-End Tests jobs of
# .github/workflows/ci.yml run their checks through this script, so that the
# list of checks exists once. A job stops at its first failed check, which the
# output names, except that e2e reports the test of the development proxy
# also after the end-to-end tests fail; in CI, each check is a log group.
#
# The workflow keeps what needs the run: the dependency audit scope, which
# reads the event of the run, and the audit; the artifact uploads; and the
# Coverage Upload job, the only one that receives a secret. Locally,
# ui-checks runs the dependency audit when package.json, package-lock.json, or
# .npmrc differ from the merge base with origin/master, or when that merge
# base cannot be found, as a pull request does. The generated API client is
# compared with the working tree without writing it, so the command runs
# before a commit. Not run here: PR Metadata, which needs the pull request;
# Renovate Validation; the Image Scan; the coverage upload; and the release
# workflows.
#
# Usage:
#   scripts/ci.sh ui-checks   The checks of the UI Checks job: the pinned
#                             Sentinel contract, the generated API client, the
#                             type check, lint, design token check, format
#                             check, and unit and component tests with their
#                             minimum coverage, the build and the test of the
#                             image, its SBOM, which it writes to
#                             test-results/sbom/, and no dependency in the
#                             working tree
#   scripts/ci.sh e2e         The checks of the End-to-End Tests job: the
#                             build of the image, then the end-to-end tests
#                             and, at the same time, the test of the
#                             development proxy, whose output and outcome
#                             follow theirs, also when they fail
#   scripts/ci.sh all         scripts/lint-shell.sh, as the Shell Lint job runs
#                             it, then ui-checks, then e2e, each even when an
#                             earlier one failed; fails, with the list of the
#                             jobs that failed, when one of them failed. The
#                             check to run before pushing
set -euo pipefail

# shellcheck source=scripts/lib/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/common.sh"

readonly SCRIPTS="${REPO_ROOT}/scripts"
# The branch that pull requests target (docs/conventions.md, Git Conventions).
readonly BASE_BRANCH="origin/master"
# The SBOM of the image, which the release of a version publishes
# (docs/deployment.md, Release Process).
readonly SBOM_FILE="test-results/sbom/sentinel-aura.sbom.cdx.json"

# The check that runs, which the exit handler reports when the script ends
# during it, the jobs of `all` that failed, and the development proxy test
# that runs in the background during `e2e`, with the file of its output.
CURRENT_CHECK=""
FAILED_JOBS=()
DEV_PROXY_PID=""
DEV_PROXY_LOG=""

in_ci() {
    [[ "${GITHUB_ACTIONS:-}" == true ]]
}

# Starts the check named $1: in CI a log group, locally a heading.
start_check() {
    CURRENT_CHECK="$1"
    if in_ci; then
        echo "::group::${CURRENT_CHECK}"
    else
        printf '\n--> %s\n' "${CURRENT_CHECK}" >&2
    fi
}

# Ends the check that passed.
end_check() {
    if in_ci; then
        echo "::endgroup::"
    fi
    CURRENT_CHECK=""
}

# Runs the check named $1, the command $2...: in CI in a log group, locally
# after a heading. A failure ends the script, and the exit handler reports it.
run_check() {
    start_check "$1"
    shift
    "$@"
    end_check
}

# Reports the failure of the check that ran last.
report_failed_check() {
    if in_ci; then
        echo "::endgroup::"
        echo "::error::${CURRENT_CHECK} failed"
    else
        warn "${CURRENT_CHECK} failed"
    fi
    CURRENT_CHECK=""
}

# Stops the development proxy test when it still runs, whose own exit handler
# then removes its backend, reports the check during which the script ends,
# and removes the output of the test.
on_exit() {
    if [[ -n "${DEV_PROXY_PID}" ]]; then
        stop_process_group "${DEV_PROXY_PID}"
    fi
    if [[ -n "${DEV_PROXY_LOG}" ]]; then
        rm -f -- "${DEV_PROXY_LOG}"
    fi
    if [[ -n "${CURRENT_CHECK}" ]]; then
        report_failed_check
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

# Fails unless the client of the working tree is the one that the pinned
# OpenAPI document generates (docs/architecture.md, API Client Generation).
# The generator compares them without writing, and lists each file that
# differs.
check_client() {
    [[ -d "${REPO_ROOT}/${GENERATED_DIR}" ]] ||
        die "missing ${GENERATED_DIR}/; run 'scripts/tooling.sh generate' and commit the result"
    "${SCRIPTS}/tooling.sh" generate --check
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

# The design token check (docs/conventions.md, Components and Styling;
# Checks): a color or a type size is set only by the class of its token. The
# lint rejects the style attribute and the attributes that set a color or a
# type size; this check rejects the classes of Tailwind CSS that do, in the
# modules under src/ other than the generated API client. Tailwind finds its
# classes in the text of the files, comments included, so the check searches
# that text as well. It rejects:
# - an arbitrary value, [...] or (...), of any utility, that holds a literal
#   color: a hexadecimal color or a color function;
# - every arbitrary value of text-, which sets a color or a type size, and an
#   arbitrary value of another utility of TOKEN_COLOR_UTILITY unless it is a
#   number, a length, or a value with a type other than color:, such as
#   border-(length:--width);
# - an arbitrary property of TOKEN_COLOR_PROPERTY, such as [color:#FFFFFF]
#   or [--color-fg:red], which sets a variable of the tokens, or one that
#   holds a literal color;
# - a modifier of a utility of TOKEN_COLOR_UTILITY, such as the opacity of
#   text-fg/70;
# - a variant that styles one theme alone: dark:, also within another, such
#   as not-dark:, an arbitrary variant of prefers-color-scheme, and a variant
#   of the attribute with which the root element marks the theme that the
#   user chose (src/styles.css), such as in-data-[theme=dark]:; and
# - a class that sets the color scheme of an element, such as scheme-dark or
#   [color-scheme:dark], which shows the element in one theme alone.

# The utilities that set a color, and text-, which also sets a type size.
readonly TOKEN_COLOR_UTILITY='(text|bg|border(-[xysetrbl])?|divide|outline|ring|ring-offset|inset-ring|shadow|inset-shadow|drop-shadow|text-shadow|fill|stroke|accent|caret|decoration|placeholder|from|via|to)'
# The CSS properties that set a color or a type size, and the variables of
# Tailwind's colors and type sizes, which hold the tokens.
readonly TOKEN_COLOR_PROPERTY='^(color|[a-z-]+-color|background|fill|stroke|font|font-size|box-shadow|text-shadow|--color-.+|--text-.+)$'
readonly TOKEN_COLOR_LITERAL='#[0-9A-Fa-f]{3,8}([^0-9A-Za-z_-]|$)|(rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\('
# A number or a length, or a value with a type.
readonly TOKEN_TYPED_VALUE='^(-?[0-9]*\.?[0-9]+([a-z]+|%)?|[a-z-]+:.+)$'
# The character before a class, and the classes that the check examines.
readonly TOKEN_BEFORE='(^|[^][A-Za-z0-9_-])'
readonly TOKEN_VALUE_CLASS='[A-Za-z0-9-]*[A-Za-z0-9]-(\[[^][:space:]]*\]|\(([^()[:space:]]|\([^()[:space:]]*\))*\))'
readonly TOKEN_PROPERTY_CLASS='\[(--[A-Za-z0-9_-]+|[a-z-]+):[^][:space:]]+\]'
readonly TOKEN_MODIFIER_CLASS="${TOKEN_COLOR_UTILITY}-[A-Za-z0-9.-]+/(\[[^][:space:]]*\]|\([^()[:space:]]*\)|[0-9]*\.?[0-9]+)"
# The variants of one theme that Tailwind and the browser provide. A change
# that adds another way for a class to apply to one theme alone adds it here
# (docs/conventions.md, Checks).
readonly TOKEN_THEME_CLASS=$'(([A-Za-z0-9-]*-)?dark:[A-Za-z0-9[!*@-]|\\[[^][:space:]]*prefers-color-scheme[^][:space:]]*\\]:)[^[:space:]"\'`{}<>]*'
# A class with a variant of the attribute with which the root element marks
# the theme that the user chose, data-theme (src/styles.css), its value
# quoted or not.
readonly TOKEN_THEME_ATTRIBUTE_CLASS=$'[^[:space:]"\'`{}<>]*data-\\[?theme([^][:space:]]*\\])?[^[:space:]"\'`{}<>]*:[^[:space:]"\'`{}<>]+'
# The utilities of the color scheme, such as scheme-dark.
readonly TOKEN_SCHEME_CLASS='scheme-[A-Za-z0-9-]+!?'
# Classes that the check rejects and accepts. It checks them first, after a
# quote and after another class, so that a pattern that stops matching cannot
# pass unnoticed.
readonly TOKEN_REJECTED_EXAMPLES=(
    'text-[#9A6700]' 'text-[13px]' 'text-(length:--size)' 'bg-[rgb(9_105_218)]'
    'fill-[oklch(0.55_0.2_25)]' 'hover:bg-[#F3F5F8]' 'border-t-[red]'
    'bg-(--accent)' 'stroke-[var(--line)]' 'ring-[color:var(--ring)]'
    'shadow-[0_1px_2px_#0000001A]' 'mask-b-from-[#000]' '[color:#FFFFFF]'
    '[font-size:13px]' '[background-color:var(--accent)]' '[--color-fg:red]'
    '[--text-14:13px]' '[--mark:oklch(0.6_0.2_25)]' 'text-fg/70'
    'bg-accent/[0.5]' 'bg-accent/(--alpha)' 'text-14/6' 'dark:bg-surface'
    'md:dark:text-fg' 'not-dark:bg-canvas'
    '[@media(prefers-color-scheme:dark)]:bg-surface'
    'in-data-[theme=dark]:bg-surface' 'data-[theme=light]:text-fg'
    "in-data-[theme='dark']:bg-surface" "[:root[data-theme='dark']_&]:bg-canvas"
    '[[data-theme=dark]_&]:bg-canvas' 'in-[[data-theme]]:text-fg-muted'
    'scheme-dark' 'md:scheme-light' 'scheme-only-dark!' 'scheme-[dark]'
    '[color-scheme:dark]'
)
readonly TOKEN_ACCEPTED_EXAMPLES=(
    'text-14' 'text-fg-muted' 'bg-surface' 'hover:bg-surface-hover' 'fill-none'
    'stroke-current' 'fill-danger-icon' 'w-[216px]' 'max-h-[33vh]'
    'border-[1.5px]' 'stroke-[1.75]' 'border-(length:--width)'
    'bg-[image:url(/mark.svg)]' 'grid-cols-[1fr_auto]'
    'data-[selected]:font-semibold' 'w-1/2' '[overflow-wrap:anywhere]'
    '[--sidebar-width:216px]' 'data-[state=open]:bg-surface-hover'
    'in-data-[selected]:text-fg'
)

# Prints why the class $1 sets a color or a type size outside the tokens, or
# nothing when it does not.
design_token_violation() {
    local class="$1" name value
    if [[ "${class}" =~ ^${TOKEN_THEME_CLASS}$ ||
        "${class}" =~ ^${TOKEN_THEME_ATTRIBUTE_CLASS}$ ]]; then
        echo "styles one theme alone"
    elif [[ "${class}" =~ ^scheme- ]]; then
        echo "sets the color scheme, which shows one theme alone"
    elif [[ "${class}" =~ ^\[([^:]+):(.*)\]$ ]]; then
        name="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        if [[ "${name}" == color-scheme ]]; then
            echo "sets the color scheme, which shows one theme alone"
        elif [[ "${name}" =~ ${TOKEN_COLOR_PROPERTY} ]]; then
            echo "an arbitrary color or type size"
        elif [[ "${value}" =~ ${TOKEN_COLOR_LITERAL} ]]; then
            echo "a literal color"
        fi
    elif [[ "${class}" =~ ^([A-Za-z0-9-]*[A-Za-z0-9])-[[(](.*)[])]$ ]]; then
        name="${BASH_REMATCH[1]}"
        value="${BASH_REMATCH[2]}"
        if [[ "${value}" =~ ${TOKEN_COLOR_LITERAL} ]]; then
            echo "a literal color"
        elif [[ "${name}" == text ]]; then
            echo "an arbitrary color or type size"
        elif [[ "${name}" =~ ^${TOKEN_COLOR_UTILITY}$ ]] &&
            ! [[ "${value}" =~ ${TOKEN_TYPED_VALUE} && "${value}" != color:* ]]; then
            echo "an arbitrary color, or a value without its type, such as length:"
        fi
    elif [[ "${class}" =~ ^${TOKEN_MODIFIER_CLASS}$ ]]; then
        echo "a modifier of a color or a type size"
    fi
}

# Prints each class of the files $@ that sets a color or a type size outside
# the tokens, as <file>:<line>: <class>: <reason>.
design_token_violations() {
    # In the C locale, for grep too, so that grep and the classification read
    # the files as the same bytes, and the ranges of the patterns are those
    # of ASCII.
    local -x LC_ALL=C
    local matches entry file line class reason status=0
    matches="$(grep -HnoE -e "${TOKEN_BEFORE}${TOKEN_VALUE_CLASS}" \
        -e "${TOKEN_BEFORE}${TOKEN_PROPERTY_CLASS}" \
        -e "${TOKEN_BEFORE}${TOKEN_MODIFIER_CLASS}" \
        -e "${TOKEN_BEFORE}${TOKEN_THEME_CLASS}" \
        -e "${TOKEN_BEFORE}${TOKEN_THEME_ATTRIBUTE_CLASS}" \
        -e "${TOKEN_BEFORE}${TOKEN_SCHEME_CLASS}" -- "$@")" || status=$?
    ((status <= 1)) || die "cannot search the modules for their classes"
    while IFS= read -r entry; do
        [[ -n "${entry}" ]] || continue
        file="${entry%%:*}"
        entry="${entry#*:}"
        line="${entry%%:*}"
        class="${entry#*:}"
        if [[ "${class}" =~ ^[^][A-Za-z0-9_-] ]]; then
            class="${class:1}"
        fi
        reason="$(design_token_violation "${class}")"
        if [[ -n "${reason}" ]]; then
            printf '%s:%s: %s: %s\n' "${file#"${REPO_ROOT}/"}" "${line}" "${class}" "${reason}"
        fi
    done <<<"${matches}"
}

# Fails unless the check rejects every class of TOKEN_REJECTED_EXAMPLES and
# accepts every class of TOKEN_ACCEPTED_EXAMPLES, each on two lines of its
# own: in a className attribute, and after another class in a template
# literal.
check_design_token_examples() {
    local examples=("${TOKEN_REJECTED_EXAMPLES[@]}" "${TOKEN_ACCEPTED_EXAMPLES[@]}")
    local lines=() example violations rejected i line
    for example in "${examples[@]}"; do
        lines+=("className=\"${example}\"" "\`p-4 ${example}\`")
    done
    violations="$(design_token_violations <(printf '%s\n' "${lines[@]}"))"
    rejected=" $(cut -d: -f2 <<<"${violations}" | tr '\n' ' ')"
    for i in "${!examples[@]}"; do
        for line in $((2 * i + 1)) $((2 * i + 2)); do
            if ((i < ${#TOKEN_REJECTED_EXAMPLES[@]})); then
                [[ "${rejected}" == *" ${line} "* ]] ||
                    die "the design token check accepts ${lines[line - 1]}, which it must reject"
            else
                [[ "${rejected}" != *" ${line} "* ]] ||
                    die "the design token check rejects ${lines[line - 1]}, which it must accept"
            fi
        done
    done
}

check_design_tokens() {
    local list files violations
    check_design_token_examples
    list="$(find "${REPO_ROOT}/src" -path "${REPO_ROOT}/${GENERATED_DIR}" -prune -o \
        -type f \( -name '*.ts' -o -name '*.tsx' \) -print | sort)"
    [[ -n "${list}" ]] || return 0
    mapfile -t files <<<"${list}"
    violations="$(design_token_violations "${files[@]}")"
    if [[ -n "${violations}" ]]; then
        echo "${violations}" >&2
        die "these classes bypass the tokens of docs/design-system.md: use the class of a token, which serves both themes (docs/conventions.md, Components and Styling)"
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
    run_check "Design token check" check_design_tokens
    run_check "Format check" "${SCRIPTS}/tooling.sh" run format:check
    run_check "Unit and component tests" "${SCRIPTS}/tooling.sh" run test:coverage
    run_check "Build the image" "${SCRIPTS}/image.sh" build
    run_check "Test the image" "${SCRIPTS}/image.sh" test
    run_check "Generate and check the SBOM of the image" "${SCRIPTS}/image.sh" sbom \
        "${REPO_ROOT}/${SBOM_FILE}"
    run_check "Verify that no dependency reached the working tree" check_no_dependency_files
}

# Waits for the development proxy test, which runs in the background, then
# shows its output and returns its status.
dev_proxy_result() {
    local status=0
    wait "${DEV_PROXY_PID}" || status=$?
    DEV_PROXY_PID=""
    cat "${DEV_PROXY_LOG}" >&2
    return "${status}"
}

# The development proxy test runs beside the end-to-end tests, each against
# its own backend, in a process group of its own, which the exit handler stops
# as a whole when the script ends first. Its outcome follows theirs, also when
# they fail. The build of the image comes first: it installs the dependencies
# when they changed, which the two would otherwise install at the same time;
# the end-to-end tests then run the production build again and build the
# image from cached layers.
cmd_e2e() {
    [[ $# -eq 0 ]] || die "e2e: takes no arguments"
    local e2e_failed=false
    run_check "Build the image" "${SCRIPTS}/image.sh" build
    DEV_PROXY_LOG="$(mktemp)"
    set -m
    "${SCRIPTS}/dev-env.sh" test >"${DEV_PROXY_LOG}" 2>&1 </dev/null &
    DEV_PROXY_PID=$!
    set +m
    # Not through run_check, whose failure would end the script before the
    # development proxy test reports.
    start_check "End-to-end tests"
    if "${SCRIPTS}/dev-env.sh" e2e; then
        end_check
    else
        report_failed_check
        e2e_failed=true
    fi
    run_check "Development proxy test" dev_proxy_result
    [[ "${e2e_failed}" == false ]]
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
    trap_interruptions
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
