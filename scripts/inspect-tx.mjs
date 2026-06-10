import { makeReadClient } from "./lib.mjs";

const hash = process.argv[2];
if (!hash) { console.error("usage: node scripts/inspect-tx.mjs <hash>"); process.exit(1); }

const client = await makeReadClient();
const tx = await client.getTransaction({ hash });
console.log(JSON.stringify(tx, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
