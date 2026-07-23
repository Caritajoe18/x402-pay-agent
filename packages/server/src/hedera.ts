import {
  Client,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicMessageQuery,
  Timestamp,
  PrivateKey,
  AccountId,
  AccountBalanceQuery,
  Hbar,
} from "@hiero-ledger/sdk";
import { config } from "./config.js";

// ── Hedera Client (lazy init) ───────────────────────────────────────────────
let _client: Client | null = null;

function getClient(): Client {
  if (!_client) {
    _client = Client.forTestnet();
    const key = config.hedera.privateKey;
    // Hedera portal generates ECDSA keys (0x-prefixed hex)
    // DER-encoded keys start with 30 and can be auto-detected
    let privateKey: PrivateKey;
    if (key.startsWith("30")) {
      privateKey = PrivateKey.fromStringDer(key);
    } else {
      privateKey = PrivateKey.fromStringECDSA(key);
    }
    _client.setOperator(
      AccountId.fromString(config.hedera.accountId),
      privateKey
    );
  }
  return _client;
}

// ── HCS Helpers ─────────────────────────────────────────────────────────────
let cachedTopicId = config.hcs.topicId;

export async function checkBalance(): Promise<void> {
  const client = getClient();
  const balance = await new AccountBalanceQuery()
    .setAccountId(config.hedera.accountId)
    .execute(client);
  const hbar = balance.hbars;
  console.log(`[hedera] Account ${config.hedera.accountId} balance: ${hbar.toString()}`);
  if (hbar.toTinybars().lt(Hbar.fromTinybars(10_000_000).toTinybars())) {
    console.warn(
      "[hedera] WARNING: Low balance. Fund your account at https://portal.hedera.com/faucet"
    );
  }
}

export async function ensureHcsTopic(): Promise<string> {
  if (cachedTopicId) return cachedTopicId;
  try {
    const client = getClient();
    const tx = new TopicCreateTransaction().setTopicMemo(
      "pay-agent audit trail"
    );
    const response = await tx.execute(client);
    const receipt = await response.getReceipt(client);
    cachedTopicId = receipt.topicId!.toString();
    console.log(`[HCS] Created audit topic: ${cachedTopicId}`);
    return cachedTopicId;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[HCS] Failed to create topic: ${msg}`);
    console.error(
      "[HCS] Make sure your account is funded: https://portal.hedera.com/faucet"
    );
    throw err;
  }
}

export async function logToHcs(event: Record<string, unknown>): Promise<{
  transactionId?: string;
  hashscanUrl?: string;
  topicId?: string;
}> {
  try {
    const client = getClient();
    const topicId = await ensureHcsTopic();
    const msg = JSON.stringify(event);
    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(msg);
    const response = await tx.execute(client);
    const transactionId = response.transactionId.toString();
    const hashscanUrl = `https://hashscan.io/testnet/transaction/${transactionId}`;
    return { transactionId, hashscanUrl, topicId };
  } catch (err) {
    console.error("[HCS] Failed to log event:", err instanceof Error ? err.message : err);
    return {};
  }
}

export async function queryHcsMessages(): Promise<{
  topicId: string;
  messages: Record<string, unknown>[];
}> {
  const client = getClient();
  const topicId = await ensureHcsTopic();
  const messages: Record<string, unknown>[] = [];
  const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await new Promise<void>((resolve) => {
    const query = new TopicMessageQuery({
      topicId,
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(new Date()),
    });

    const handle = query.subscribe(
      client,
      (_msg, error) => {
        console.error("[HCS query error]", error);
      },
      (message) => {
        try {
          const parsed = JSON.parse(
            new TextDecoder().decode(message.contents)
          );
          messages.push({
            ...parsed,
            consensusTimestamp:
              message.consensusTimestamp?.toString() ?? null,
          });
        } catch {
          /* skip malformed */
        }
      }
    );

    setTimeout(() => {
      handle.unsubscribe();
      resolve();
    }, 3000);
  });

  return { topicId, messages };
}
