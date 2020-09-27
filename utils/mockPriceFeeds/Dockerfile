# Docker image: pollen/pricefeeds-updater
# Build context: ./ (utils/mockPriceFeeds/)
## To build the image (from inside the build context folder):
# $ docker build --tag "pollen/pricefeeds-updater" .
## To run the image (just an example - see fetch-chainlink-prices-to-mock-oracles.js for run options)
# $ docker run -d --name mock-updater --restart on-failure:5 -e PRIVKEY="$PRIVKEY" -e INFURA_KEY="$INFURA_KEY" -e INTERVAL_SECS=1200 -e SRC_FEEDS="ethUsd:compUsd:daiEth:lendEth:snxEth" pollen/pricefeeds-updater

FROM node:14-slim

WORKDIR /usr/src/app

ENV HOME=/home/node NODE_ENV=production

COPY ./package.json ./package-lock.json ./
RUN npm install --production && npm cache clean --force

COPY . ./

USER node

# Start the nodejs running the app with pid=1
ENTRYPOINT ["node", "./fetch-chainlink-prices-to-mock-oracles.js"]
