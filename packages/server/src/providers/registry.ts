import type { Provider } from "./types.js";
import { dataCatalog } from "../marketplace/catalog.js";

const providers = new Map<string, Provider>();

export function registerProvider(provider: Provider): void {
  providers.set(provider.slug, provider);
}

export function getProvider(slug: string): Provider | undefined {
  return providers.get(slug);
}

export function listProviders(): Array<{
  slug: string;
  name: string;
  description: string;
  price: string;
  params: Provider["params"];
}> {
  return Array.from(providers.values()).map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    params: p.params,
  }));
}

export function buildX402Routes(
  payTo: string
): Record<string, { accepts: Array<{ scheme: string; network: "hedera:testnet"; price: string; payTo: string }>; description: string }> {
  const routes: Record<string, unknown> = {};

  // Data provider routes
  for (const [slug, provider] of providers) {
    routes[`/api/data/${slug}`] = {
      accepts: [
        {
          scheme: "exact",
          network: "hedera:testnet" as const,
          price: provider.price,
          payTo,
        },
      ],
      description: provider.description,
    };
  }

  // Marketplace data item routes
  for (const item of dataCatalog) {
    routes[`/api/marketplace/${item.id}`] = {
      accepts: [
        {
          scheme: "exact",
          network: "hedera:testnet" as const,
          price: item.price,
          payTo,
        },
      ],
      description: item.description,
    };
  }

  return routes as ReturnType<typeof buildX402Routes>;
}
