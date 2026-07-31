import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val || val === "0x..." || val === "0.0.12345") {
    console.error(
      `\n[config] Missing or placeholder value for ${key}.\n` +
        `  Copy packages/server/.env.example to packages/server/.env and fill in real values.\n` +
        `  Get testnet credentials at https://portal.hedera.com/faucet\n`
    );
    process.exit(1);
  }
  return val;
}

export const config = {
  hedera: {
    accountId: required("HEDERA_ACCOUNT_ID"),
    privateKey: required("HEDERA_PRIVATE_KEY"),
  },
  hederaClient: {
    accountId: process.env.HEDERA_CLIENT_ID || required("HEDERA_ACCOUNT_ID"),
    privateKey: process.env.HEDERA_CLIENT_KEY || required("HEDERA_PRIVATE_KEY"),
  },
  hcs: {
    topicId: process.env.HCS_TOPIC_ID || "",
  },
  facilitator: {
    url: process.env.FACILITATOR_URL || "https://api.testnet.blocky402.com",
  },
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.2:3b",
    apiKey: process.env.OLLAMA_API_KEY || "",
  },
  maxSpendUsdc: process.env.MAX_SPEND_USDC
    ? parseFloat(process.env.MAX_SPEND_USDC)
    : null,
  port: parseInt(process.env.PORT || "4021", 10),
} as const;
