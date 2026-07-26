import { wrapFetchWithPayment } from "@x402/fetch";
import {
  createClientHederaSigner,
  PrivateKey as HederaPrivateKey,
} from "@x402/hedera";
import { ExactHederaScheme } from "@x402/hedera/exact/client";
import { x402Client } from "@x402/core/client";
import { config } from "./config.js";

let _fetchWithPayment: ReturnType<typeof wrapFetchWithPayment> | null = null;

function createClient(): ReturnType<typeof wrapFetchWithPayment> {
  if (_fetchWithPayment) return _fetchWithPayment;

  const { accountId, privateKey } = config.hederaClient;

  let key: HederaPrivateKey;
  if (privateKey.startsWith("30")) {
    key = HederaPrivateKey.fromStringDer(privateKey);
  } else {
    key = HederaPrivateKey.fromStringECDSA(privateKey);
  }

  const signer = createClientHederaSigner(accountId, key, {
    network: "hedera:testnet",
  });

  const client = new x402Client().register(
    "hedera:*",
    new ExactHederaScheme(signer)
  );

  _fetchWithPayment = wrapFetchWithPayment(fetch, client);
  return _fetchWithPayment;
}

export function getFetchWithPayment() {
  return createClient();
}
