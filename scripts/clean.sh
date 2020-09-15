#!/usr/bin/env sh
# Usage:
# clean.sh [--all|--artifacts|--dev|log]

set +e

panic() {
  echo "ERROR: ${1:-terminated}" >&2
}

success() {
  echo Done
  exit 0
}

rm_log() {
  [ -f ganache-log.txt ] || return
  rm ganache-log.txt || panic failed remove logs
  echo ganache logs deleted
}

rm_artifacts() {
  [ -n "$(ls -A ./artifacts/contracts/ 2>/dev/null)" ] && {
    rm -r artifacts/* || panic failed remove truffle ertifacts
    echo truffle artifacts deleted
  }

  [ -n "$(ls -A ./build/contracts/ 2>/dev/null)" ] && {
    rm -r build/* || panic failed remove oz artifacts
    echo oz artifacts deleted
  }
}

rm_dev() {
  test -f .openzeppelin/dev-*.json && {
    rm .openzeppelin/dev-*.json || panic failed remove oz dev networkFiles
    echo oz dev networkFiles deleted
  }
  test -f .openzeppelin/dev-*.json && {
    rm .openzeppelin/.session || panic failed remove oz .session file
    echo oz .session file deleted
  }
}

test "$1" = "--artifacts" && { rm_artifacts; success; }
test "$1" = "--log" && { rm_log; success; }
test "$1" = "--dev" && { rm_dev; success; }
test "$1" = "--all" && { rm_dev; rm_log; rm_artifacts; success; }

success # if it comes here
