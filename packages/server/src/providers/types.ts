export interface ProviderParam {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

export interface Provider {
  /** Unique slug used in URLs — e.g. "weather", "market" */
  slug: string;
  /** Human-readable name */
  name: string;
  /** What this provider returns */
  description: string;
  /** Price per request in USD — e.g. "$0.001" */
  price: string;
  /** Query parameters this provider accepts */
  params: ProviderParam[];
  /** Fetch data from the upstream source */
  fetch(params: Record<string, string>): Promise<unknown>;
}
