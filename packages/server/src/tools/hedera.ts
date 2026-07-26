import { Client, PrivateKey } from "@hiero-ledger/sdk";
import { AgentMode } from "@hashgraph/hedera-agent-kit";
import { allCorePlugins } from "@hashgraph/hedera-agent-kit/plugins";
import { HcsAuditTrailHook } from "@hashgraph/hedera-agent-kit/hooks";
import { RejectToolPolicy } from "@hashgraph/hedera-agent-kit/policies";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
import { config } from "../config.js";

export function createHederaClient(): Client {
  const client = Client.forTestnet();
  const key = config.hedera.privateKey;
  const privateKey = key.startsWith("30")
    ? PrivateKey.fromStringDer(key)
    : PrivateKey.fromStringECDSA(key);
  client.setOperator(config.hedera.accountId, privateKey);
  return client;
}

export function createToolkit(client: Client) {
  const auditHook = new HcsAuditTrailHook(
    ["fetch_x402_merchant", "submit_topic_message_tool"],
    config.hcs.topicId,
    client
  );

  const rejectPolicy = new RejectToolPolicy([
    "delete_account_tool",
    "delete_topic_tool",
  ]);

  return new HederaLangchainToolkit({
    client,
    configuration: {
      plugins: allCorePlugins,
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: config.hedera.accountId,
        hooks: [auditHook, rejectPolicy],
      },
    },
  });
}
