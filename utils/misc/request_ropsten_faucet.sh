#!/usr/bin/env sh
# Request Ropsten faucet at https://faucet.metamask.io to send 1 test ETH to the specified account.
# Usage:
#  request_ropsten_faucet.sh <ethereum account>

account=${1:-0x92419b071651908732d897f0ea1F9A6a6Ae93f6a}

curl 'https://faucet.metamask.io/' \
  --data-raw "${account}" \
  --connect-timeout 30 \
  --max-time 90 \
  --compressed \
  -H 'User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:80.0) Gecko/20100101 Firefox/80.0' \
  -H 'Accept: */*' \
  -H 'Accept-Language: en-US,en;q=0.5' \
  -H 'Content-Type: application/rawdata' \
  -H 'Origin: https://faucet.metamask.io' \
  -H 'Connection: keep-alive' \
  -H 'Referer: https://faucet.metamask.io/' \
  -H 'TE: Trailers'}
