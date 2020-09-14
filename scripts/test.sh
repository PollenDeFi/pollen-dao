#!/usr/bin/env bash
set -o errexit

trap shutdown_pln-chain EXIT

log_file="./ganache-log.txt"
pid_file=$(mktemp)

shutdown_pln-chain() {
  ganache_pid=$(cat ${pid_file})
  if [ -n "${ganache_pid}" ] && ps -p "${ganache_pid}" > /dev/null; then
    echo "killing ganache (pid: ${ganache_pid})..."
    kill -9 "${ganache_pid}" 1>"${log_file}" 2>&1
  fi
  rm "${pid_file}"
}

echo "Starting ganache (pid file: ${pid_file}, log file: ${log_file})..."
scripts/start-pln-chain.sh --start-and-exit --pid-file="${pid_file}" --log-file="${log_file}"

truffle test --network pln-chain $@
