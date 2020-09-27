#!/usr/bin/env sh
# Usage:
# clean.sh [--all|--artifacts|--dev|log|oz]

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

clean_oz_files() {
  test -f .openzeppelin/project.json && {
    node >/dev/null 2>&1 << 'EOF'
const prFile = "./.openzeppelin/project.json";
const fs = require("fs");
process.on('unhandledRejection', () => process.exit(128));
const pr = JSON.parse(fs.readFileSync(prFile).toString());
if (pr.contracts && Object.entries(pr.contracts).length > 0) {
  require("fs").writeFileSync(prFile, JSON.stringify(pr, (k,v) => k==="contracts" ? {}:v, 2));
} else process.exit(1);
EOF
    case "$?" in
      "0") echo oz project.json cleaned ;;
      "1") true ;;
      "128") panic failed to clean oz project.json ;;
    esac
  }

  test -f .openzeppelin/dev-*.json && {
    rm .openzeppelin/.session || panic failed remove oz .session file
    echo oz .session file deleted
  }
}

rm_dev() {
  test -f .openzeppelin/dev-*.json && {
    rm .openzeppelin/dev-*.json || panic failed remove oz dev networkFiles
    echo oz dev networkFiles deleted
  }
}

test "$1" = "--artifacts" && { rm_artifacts; success; }
test "$1" = "--log" && { rm_log; success; }
test "$1" = "--dev" && { rm_dev; success; }
test "$1" = "--oz" && { rm_dev; clean_oz_files; success; }
test "$1" = "--all" && { rm_log; rm_artifacts; clean_oz_files; success; }

success # if it comes here
