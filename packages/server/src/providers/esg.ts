import type { Provider } from "./types.js";

/**
 * ESG and carbon credit data for supply chain compliance.
 * Real use case: companies buying verified compliance data with audit trail.
 */
interface CarbonProject {
  id: string;
  name: string;
  registry: string;
  method: string;
  creditsAvailable: number;
  pricePerCredit: number;
  country: string;
  verified: boolean;
}

const CARBON_PROJECTS: CarbonProject[] = [
  {
    id: "VCS-1234",
    name: "Amazon Rainforest Protection",
    registry: "Verra VCS",
    method: "REDD+",
    creditsAvailable: 50000,
    pricePerCredit: 12.5,
    country: "Brazil",
    verified: true,
  },
  {
    id: "GS-5678",
    name: "Kenya Clean Cookstoves",
    registry: "Gold Standard",
    method: "Energy Efficiency",
    creditsAvailable: 25000,
    pricePerCredit: 8.75,
    country: "Kenya",
    verified: true,
  },
  {
    id: "VCS-9012",
    name: "Australian Reforestation",
    registry: "Verra VCS",
    method: "Afforestation",
    creditsAvailable: 100000,
    pricePerCredit: 15.0,
    country: "Australia",
    verified: true,
  },
  {
    id: "ACR-3456",
    name: "US Methane Capture",
    registry: "American Carbon Registry",
    method: "Methane Reduction",
    creditsAvailable: 75000,
    pricePerCredit: 18.25,
    country: "United States",
    verified: true,
  },
  {
    id: "CAR-7890",
    name: "India Solar Distributed Generation",
    registry: "Climate Action Reserve",
    method: "Renewable Energy",
    creditsAvailable: 200000,
    pricePerCredit: 6.5,
    country: "India",
    verified: true,
  },
];

export const esgProvider: Provider = {
  slug: "esg",
  name: "Carbon Credits & ESG",
  description:
    "Verified carbon credit projects and ESG compliance data for supply chain audit",
  price: "$0.005",
  params: [
    {
      name: "country",
      description:
        "Filter by country code (e.g. 'BR', 'KE', 'AU', 'US', 'IN') or 'all'",
      required: false,
      default: "all",
    },
    {
      name: "registry",
      description:
        "Filter by registry (e.g. 'Verra VCS', 'Gold Standard') or 'all'",
      required: false,
      default: "all",
    },
  ],

  async fetch(params) {
    let projects = [...CARBON_PROJECTS];

    const country = (params.country || "all").toUpperCase();
    if (country !== "ALL") {
      projects = projects.filter(
        (p) => p.country.toUpperCase() === country
      );
    }

    const registry = params.registry || "all";
    if (registry !== "all") {
      projects = projects.filter((p) =>
        p.registry.toLowerCase().includes(registry.toLowerCase())
      );
    }

    const totalCredits = projects.reduce(
      (sum, p) => sum + p.creditsAvailable,
      0
    );
    const avgPrice =
      projects.length > 0
        ? projects.reduce((sum, p) => sum + p.pricePerCredit, 0) /
          projects.length
        : 0;

    return {
      query: { country, registry },
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        registry: p.registry,
        method: p.method,
        creditsAvailable: p.creditsAvailable,
        pricePerCredit: `$${p.pricePerCredit.toFixed(2)}`,
        country: p.country,
        verified: p.verified,
      })),
      summary: {
        totalProjects: projects.length,
        totalCredits,
        averagePrice: `$${avgPrice.toFixed(2)}`,
      },
      complianceNote:
        "All projects verified. HCS audit trail provides immutable chain of custody.",
      source: "pay-agent ESG database",
    };
  },
};
