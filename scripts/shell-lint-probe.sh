#!/usr/bin/env bash
# Deliberately invalid script to observe a Shell Lint failure; removed by
# the next commit.
set -euo pipefail

main() {
  local target=$1
  rm $target
}

main "$@"
