import { JsonRpcProvider, formatEther } from "ethers";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const provider = new JsonRpcProvider(process.env.RPC_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TX_HASH =
  "0x1f7a1d31e0b9adfa6f1fa33d3046dd40992d925fcce89c37689f9c0d5bda40ee";

async function run() {
  const tx = await provider.getTransaction(TX_HASH);
  const receipt = await provider.getTransactionReceipt(TX_HASH);
  const block = await provider.getBlock(tx.blockNumber);

  console.log("TX found in block:", tx.blockNumber);

  await pool.query(
    `
    INSERT INTO transactions
    (tx_hash, block_number, from_address, to_address, value_avax, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (tx_hash) DO NOTHING
    `,
    [
      tx.hash,
        block.number,
        tx.from,
        tx.to,
        formatEther(tx.value ?? 0n),
        block.timestamp, 
    ]
  );

  console.log("✅ Transaction saved successfully!");
}

run();