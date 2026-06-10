// Suite 00 - Step 0 sanity. Verify RPC reachable, all wallets have balance,
// contract reads work. Aborts the whole suite if anything's wrong.
import {
  makeClient, makeReadClient, readOrThrow, parseJsonReadResult,
  CONTRACT_ADDRESS, CHAIN_ID, RPC_URL, assert,
} from "../lib.mjs";

const WALLETS = [
  ["KEEPER_PRIVATE_KEY", "keeper"],
  ["TEST_WALLET_1_PRIVATE_KEY", "test1"],
  ["TEST_WALLET_2_PRIVATE_KEY", "test2"],
  ["TEST_WALLET_3_PRIVATE_KEY", "test3"],
];

export default async function suite00() {
  console.log(`Contract:       ${CONTRACT_ADDRESS}`);
  console.log(`Chain ID:       ${CHAIN_ID}`);
  console.log(`RPC:            ${RPC_URL}`);

  // Read client + contract reachability
  const read = await makeReadClient();
  const stats = parseJsonReadResult(await readOrThrow({ client: read, functionName: "get_protocol_stats" }));
  console.log(`get_protocol_stats →`, stats);
  assert(stats && typeof stats === "object", "get_protocol_stats did not return JSON");
  for (const k of ["policies", "claims", "evidence", "reviews", "disputes"]) {
    assert(typeof stats[k] === "number", `protocol stats missing counter "${k}"`);
  }

  // Wallets - addresses + balances
  const balances = {};
  for (const [envName, label] of WALLETS) {
    if (!process.env[envName]) throw new Error(`Missing ${envName} in .env.local`);
    const { client, address } = await makeClient(envName);
    let bal = null;
    try {
      // viem-style: client.getBalance({ address })
      if (typeof client.getBalance === "function") {
        bal = await client.getBalance({ address });
      }
    } catch { /* tolerate */ }
    balances[label] = { address, balance: bal !== null ? bal.toString() : "unknown" };
    console.log(`wallet ${label}: ${address}  balance=${balances[label].balance}`);
    if (bal !== null && bal === 0n) {
      throw new Error(`Wallet ${label} (${address}) has zero balance - fund it on Studionet before running the suite.`);
    }
  }

  return { stats, balances };
}
