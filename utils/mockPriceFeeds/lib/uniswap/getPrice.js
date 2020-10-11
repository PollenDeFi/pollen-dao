const axios = require("axios");

module.exports = async function getPrice(baseToken, quoteToken) {
    const url =
        "https://api.thegraph.com/subgraphs/name/pollendefi/uniswap-v2-ropsten";
    const query = `
    {
      pairs(
        where: {
          token0: "${quoteToken.toLowerCase()}"
          token1: "${baseToken.toLowerCase()}"
        }
      ) {
        token0Price
      }
    }
  `;
    const queryInverse = `
    {
      pairs(
        where: {
          token0: "${baseToken.toLowerCase()}"
          token1: "${quoteToken.toLowerCase()}"
        }
      ) {
        token1Price
      }
    }
  `;
    const { data } = await axios({
        url,
        method: "post",
        data: {
            query,
        },
    });

    const { data: dataInverse } = await axios({
        url,
        method: "post",
        data: {
            query: queryInverse,
        },
    });

    return (
        Number(data.data.pairs[0] ? data.data.pairs[0].token0Price : undefined) ||
        Number(dataInverse.data.pairs[0] ? dataInverse.data.pairs[0].token1Price : undefined) ||
        0
    );
}
