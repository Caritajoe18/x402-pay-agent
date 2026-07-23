import type { Provider } from "./types.js";

/**
 * Real market data from CoinGecko (free, no API key for basic endpoint).
 * https://docs.coingecko.com/reference/introduction
 */
export const marketProvider: Provider = {
  slug: "market",
  name: "Crypto Market Data",
  description: "Real-time crypto prices and market data from CoinGecko",
  price: "$0.002",
  params: [
    {
      name: "symbol",
      description: "Coin ID (e.g. 'bitcoin', 'ethereum', 'solana')",
      required: true,
    },
    {
      name: "currency",
      description: "Fiat currency for price (default: 'usd')",
      required: false,
      default: "usd",
    },
  ],

  async fetch(params) {
    const coinId = (params.symbol || "bitcoin").toLowerCase();
    const vsCurrency = (params.currency || "usd").toLowerCase();

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return { error: `Coin "${coinId}" not found`, status: res.status };
    }

    const data = (await res.json()) as {
      id: string;
      symbol: string;
      name: string;
      market_data: {
        current_price: Record<string, number>;
        price_change_percentage_24h: number;
        price_change_percentage_7d: number;
        market_cap: Record<string, number>;
        total_volume: Record<string, number>;
        high_24h: Record<string, number>;
        low_24h: Record<string, number>;
      };
    };

    const md = data.market_data;
    return {
      coin: data.name,
      symbol: data.symbol.toUpperCase(),
      price: md.current_price[vsCurrency],
      change24h: `${md.price_change_percentage_24h?.toFixed(2)}%`,
      change7d: `${md.price_change_percentage_7d?.toFixed(2)}%`,
      high24h: md.high_24h[vsCurrency],
      low24h: md.low_24h[vsCurrency],
      marketCap: md.market_cap[vsCurrency],
      volume24h: md.total_volume[vsCurrency],
      currency: vsCurrency,
      source: "coingecko.com",
    };
  },
};
