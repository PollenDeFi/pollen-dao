if test -f "ganache-log.txt"; then
    rm ganache-log.txt
fi
if test -d "artifacts/contracts"; then
    rm -rf artifacts/contracts
fi