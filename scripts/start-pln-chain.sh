#!/usr/bin/env bash
# Usage:
#   start-pln-chain.sh [--no-migrate] [--start-and-exit] [--pid-file=<path>] [--log-file=<path>]

set -o errexit

trap on_exit EXIT

migrate=
start_only=
pid_file=
log_file="./ganache-log.txt"

for i in "$@"; do
  case $i in
    --no-migrate)
      migrate=yes ;;
    --start-and-exit)
      start_only=yes ;;
    --pid-file=*)
      pid_file="${i#*=}" ;;
    --log-file=*)
      log_file="${i#*=}" ;;
    *)
      echo "Unknown param '${i}'"
      exit 1
  esac
  shift
done

is_ganache_running() {
  ps -p "${ganache_pid}" > /dev/null;
}

on_exit() {
  [ -n "${start_only}" ] && return
  shutdown_ganache
}

shutdown_ganache() {
  if [ -n "${ganache_pid}" ] && is_ganache_running; then
    kill -9 "${ganache_pid}" 1>"${log_file}" 2>&1
  fi
}

oz_network_file=".openzeppelin/dev-2020.json"
[ -f "${oz_network_file}" ] && {
  rm "${oz_network_file}"
  echo "Removed ${oz_network_file}"
}

ganache_port=8555
networkId=2020
echo "Starting ganache-cli (port: ${ganache_port}, networkId: ${networkId})"
npx --quiet ganache-cli \
  --port "${ganache_port}" \
  --networkId "${networkId}" \
  --gasLimit 6000000 \
  --defaultBalanceEther 1000000 \
  --deterministic --mnemonic "arctic tilt assume clarify fall captain soon detail come suffer point page" \
  1>>"${log_file}" &

ganache_pid=$!
[ -n "${pid_file}" ] && {
  disown
  echo "${ganache_pid}" > "${pid_file}"
}

[ -n "${start_only}" ] && { echo "Done (Started)" ; exit; }

sleep 1
[ -z "${migrate}" ] && truffle migrate --network pln-chain

echo "✓ ready"
echo "press 'ctrl+c' to terminate..."

while is_ganache_running; do sleep 1; done

echo "Done. Terminating..."
