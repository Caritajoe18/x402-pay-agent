import type { Provider } from "./types.js";

/**
 * Tax and regulatory compliance data.
 * Uses publicly available rate tables.
 * In production, replace with a real tax API (e.g. Avalara, TaxJar).
 */
interface TaxJurisdiction {
  name: string;
  salesTaxRate: number;
  digitalServicesTax: number;
  vatRate: number;
  notes: string;
}

const TAX_DB: Record<string, TaxJurisdiction> = {
  US: {
    name: "United States",
    salesTaxRate: 7.25,
    digitalServicesTax: 0,
    vatRate: 0,
    notes: "Federal base rate; state rates vary 0-10.25%",
  },
  "US-CA": {
    name: "California",
    salesTaxRate: 7.25,
    digitalServicesTax: 0,
    vatRate: 0,
    notes: "Combined state + avg local: ~8.68%",
  },
  "US-NY": {
    name: "New York",
    salesTaxRate: 4.0,
    digitalServicesTax: 0,
    vatRate: 0,
    notes: "Combined state + NYC: 8.875%",
  },
  EU: {
    name: "European Union",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 21,
    notes: "Standard VAT; member states range 17-27%",
  },
  DE: {
    name: "Germany",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 19,
    notes: "Standard VAT rate",
  },
  FR: {
    name: "France",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 20,
    notes: "Standard VAT rate",
  },
  UK: {
    name: "United Kingdom",
    salesTaxRate: 0,
    digitalServicesTax: 2,
    vatRate: 20,
    notes: "UK DST applies to large tech companies",
  },
  SG: {
    name: "Singapore",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 9,
    notes: "GST rate",
  },
  JP: {
    name: "Japan",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 10,
    notes: "Consumption tax rate",
  },
  AU: {
    name: "Australia",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 10,
    notes: "GST rate; applies to digital services",
  },
  IN: {
    name: "India",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 18,
    notes: "GST on digital services",
  },
  BR: {
    name: "Brazil",
    salesTaxRate: 0,
    digitalServicesTax: 0,
    vatRate: 17,
    notes: "ICMS rate; varies by state",
  },
};

export const complianceProvider: Provider = {
  slug: "compliance",
  name: "Tax & Regulatory Compliance",
  description: "Tax rates and regulatory compliance data by jurisdiction",
  price: "$0.005",
  params: [
    {
      name: "jurisdiction",
      description:
        "ISO country or region code (e.g. 'US', 'EU', 'DE', 'UK', 'US-CA')",
      required: true,
    },
  ],

  async fetch(params) {
    const code = (params.jurisdiction || "US").toUpperCase();
    const entry = TAX_DB[code];

    if (!entry) {
      const available = Object.keys(TAX_DB).join(", ");
      return {
        error: `Jurisdiction "${code}" not found`,
        available,
      };
    }

    return {
      jurisdiction: code,
      name: entry.name,
      salesTaxRate: entry.salesTaxRate ? `${entry.salesTaxRate}%` : "N/A",
      vatRate: entry.vatRate ? `${entry.vatRate}%` : "N/A",
      digitalServicesTax: entry.digitalServicesTax
        ? `${entry.digitalServicesTax}%`
        : "N/A",
      complianceStatus: "verified",
      notes: entry.notes,
      source: "pay-agent tax database",
      disclaimer: "Verify with local tax authority for production use",
    };
  },
};
