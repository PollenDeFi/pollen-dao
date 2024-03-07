interface Asset {
    symbol: string,
    address: string,
    feed: string
}

export interface AssetsByNetwork {
    [index: string]: Asset[]
}

export interface ContractAddressesByNetwork {
    [index: string]: {
        [index: string]: string
    }
}
