import type { Provider } from "./types.js";

/**
 * Real market data from CoinGecko (free, no API key for basic endpoint).
 * Cached for 60s and falls back to Binance's public ticker when CoinGecko
 * rate-limits (HTTP 429) or is unavailable.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { ts: number; data: Record<string, unknown> }>();

function cacheKey(coinId: string, vsCurrency: string): string {
  return `${coinId}:${vsCurrency}`;
}

function getCached(coinId: string, vsCurrency: string) {
  const entry = cache.get(cacheKey(coinId, vsCurrency));
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(cacheKey(coinId, vsCurrency));
    return undefined;
  }
  return entry.data;
}

const COINGECKO_SYMBOLS: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  bnb: "BNB",
  ripple: "XRP",
  cardano: "ADA",
  dogecoin: "DOGE",
  polkadot: "DOT",
  avalanche: "AVAX",
  litecoin: "LTC",
};

async function fetchFromBinance(
  coinId: string,
  vsCurrency: string
): Promise<Record<string, unknown> | undefined> {
  const ticker = COINGECKO_SYMBOLS[coinId];
  if (!ticker || vsCurrency !== "usd") return undefined;
  const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}USDT`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return undefined;
  const t = (await res.json()) as {
    lastPrice: string;
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    quoteVolume: string;
  };
  return {
    coin: coinId.charAt(0).toUpperCase() + coinId.slice(1),
    symbol: ticker,
    price: parseFloat(t.lastPrice),
    change24h: `${parseFloat(t.priceChangePercent).toFixed(2)}%`,
    high24h: parseFloat(t.highPrice),
    low24h: parseFloat(t.lowPrice),
    marketCap: undefined,
    volume24h: parseFloat(t.quoteVolume),
    currency: vsCurrency,
    source: "binance.com (fallback)",
  };
}

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

    const cached = getCached(coinId, vsCurrency);
    if (cached) return cached;

    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (res.status === 429) {
      const binance = await fetchFromBinance(coinId, vsCurrency);
      if (binance) {
        cache.set(cacheKey(coinId, vsCurrency), { ts: Date.now(), data: binance });
        return binance;
      }
      return {
        error: `CoinGecko is rate-limited. ${coinId} is not available on the fallback source for "${vsCurrency}". Try again in a minute.`,
        status: 429,
      };
    }

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
    const result: Record<string, unknown> = {
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
    cache.set(cacheKey(coinId, vsCurrency), { ts: Date.now(), data: result });
    return result;
  },
};
