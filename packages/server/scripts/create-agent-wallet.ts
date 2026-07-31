import "dotenv/config";
import {
  AccountCreateTransaction,
  AccountId,
  Hbar,
  PrivateKey,
  Client,
  TransferTransaction,
  TokenId,
} from "@hiero-ledger/sdk";

function required(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var ${name}. Add it to packages/server/.env`);
    process.exit(1);
  }
  return val;
}

async function main() {
  const operatorId = AccountId.fromString(required("HEDERA_ACCOUNT_ID"));
  const operatorKey = PrivateKey.fromStringECDSA(required("HEDERA_PRIVATE_KEY"));

  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);

  const agentKey = PrivateKey.generateECDSA();
  const agentKeyDer = agentKey.toStringDer();

  console.log("AGENT_PRIVATE_KEY=" + agentKeyDer);

  const tx = await new AccountCreateTransaction()
    .setKey(agentKey.publicKey)
    .setInitialBalance(new Hbar(5))
    .setMaxAutomaticTokenAssociations(10)
    .execute(client);

  const receipt = await tx.getReceipt(client);
  const agentAccountId = receipt.accountId!;
  console.log("AGENT_ACCOUNT_ID=" + agentAccountId.toString());

  // Associate USDC with agent, then transfer 20 USDC
  const usdcTokenId = TokenId.fromString("0.0.429274");
  const transferTx = await new TransferTransaction()
    .addTokenTransfer(usdcTokenId, operatorId, -20_000_000)
    .addTokenTransfer(usdcTokenId, agentAccountId, 20_000_000)
    .execute(client);
  await transferTx.getReceipt(client);

  console.log("Transferred 20 USDC to agent");

  client.close();
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
