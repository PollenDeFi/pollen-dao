#!/usr/bin/env bash

set -o errexit

defaultScope="
contracts/PollenDAO_v*.sol
contracts/Pollen_v*.sol
contracts/RateQuoter.sol
contracts/mocks/MockPriceOracle.sol
contracts/mocks/MockAssetToken.sol
"

_scope="$1"
[ -z "${_scope}" ] && _scope="${defaultScope}";

if [ ! -d "build/flattened" ]; then
    mkdir -p "build/flattened"
fi

for sol in ${_scope}
do
    if [ ! -f "${sol}" ]; then
        continue
    fi

    folder=${sol%/*}
    if [ -n "${folder}" ]; then
        mkdir -p "build/flattened/${folder}"
    fi

    echo -n "Flattening ${sol}..."
    truffle-flattener ${sol} > "build/flattened/${sol}" && echo "Ok"
done
echo "Done"
