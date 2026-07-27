export interface DataItem {
  id: string;
  name: string;
  description: string;
  price: string;
  category: string;
  data: unknown;
}

export const dataCatalog: DataItem[] = [
  {
    id: "btc-onchain",
    name: "Bitcoin On-Chain Analytics",
    description: "Latest block height, hash rate, mempool size, and fee estimates",
    price: "$0.001",
    category: "Blockchain",
    data: {
      blockHeight: 851234,
      hashRate: "612 EH/s",
      mempoolSize: "42,301 transactions",
      avgFee: "0.000045 BTC",
      nextHalving: "~210,000 blocks",
    },
  },
  {
    id: "eth-gas",
    name: "Ethereum Gas Tracker",
    description: "Current gas prices, network utilization, and L2 fee comparison",
    price: "$0.001",
    category: "Blockchain",
    data: {
      baseFee: "8.2 Gwei",
      priorityFee: "1.5 Gwei",
      networkUtilization: "62%",
      l2Arbitrum: "$0.04",
      l2Optimism: "$0.03",
      l2Base: "$0.01",
    },
  },
  {
    id: "macro-indicators",
    name: "Global Macro Indicators",
    description: "US 10Y yield, DXY index, gold price, VIX, and Fed funds rate",
    price: "$0.005",
    category: "Macro",
    data: {
      us10yYield: "4.25%",
      dxy: 104.32,
      goldOz: "$2,345",
      vix: 14.2,
      fedFundsRate: "5.25-5.50%",
      lastUpdated: new Date().toISOString(),
    },
  },
  {
    id: "defi-tvl",
    name: "Top DeFi Protocols by TVL",
    description: "Current TVL rankings for top 10 DeFi protocols across chains",
    price: "$0.003",
    category: "DeFi",
    data: {
      protocols: [
        { name: "Lido", tvl: "$28.4B", chain: "Ethereum" },
        { name: "EigenLayer", tvl: "$15.2B", chain: "Ethereum" },
        { name: "Aave", tvl: "$12.1B", chain: "Multi-chain" },
        { name: "MakerDAO", tvl: "$8.9B", chain: "Ethereum" },
        { name: "Uniswap", tvl: "$5.7B", chain: "Multi-chain" },
      ],
      totalDefiTvl: "$96.8B",
    },
  },
  {
    id: "sentiment-composite",
    name: "Crypto Fear & Greed Composite",
    description: "Aggregated sentiment from social, news, and on-chain metrics",
    price: "$0.002",
    category: "Sentiment",
    data: {
      fearGreedIndex: 72,
      label: "Greed",
      socialSentiment: "bullish",
      newsVolume: "high",
      googleTrends: "rising",
      dominantNarrative: "ETF inflows and halving anticipation",
    },
  },
];
