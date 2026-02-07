import { JsonRpcProvider, formatEther } from "ethers";
import pkg from "pg";
// import cron from "node-cron";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const provider = new JsonRpcProvider(process.env.RPC_URL);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const CONTRACT = "0x8315f1eb449Dd4B779495C3A0b05e5d194446c6e".toLowerCase();

async function getLastBlock() {
  const res = await pool.query("SELECT last_block FROM indexer_state WHERE id=1");
  return Number(res.rows[0].last_block);
}

async function updateLastBlock(block) {
  await pool.query("UPDATE indexer_state SET last_block=$1 WHERE id=1", [block]);
}

async function indexContractTx() {
  try {
    const latestBlock = await provider.getBlockNumber();
    let lastBlock = await getLastBlock();

    if (lastBlock === 0) lastBlock = latestBlock - 20; 

    console.log(`🔎 Indexing ${lastBlock} → ${latestBlock}`);

    for (let b = lastBlock; b <= latestBlock; b++) {
      const block = await provider.getBlock(b, true);
      if (!block) continue;

      for (const tx of block.transactions) {
        if (
          tx.to?.toLowerCase() !== CONTRACT &&
          tx.from?.toLowerCase() !== CONTRACT
        ) {
          continue;
        }

        
        await pool.query(
          `
          INSERT INTO transactions
          (tx_hash, block_number, from_address, to_address, value_avax, timestamp)
          VALUES ($1,$2,$3,$4,$5,$6)
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

        console.log(`✅ Saved ${action}: ${tx.hash}`);
      }
    }

    await updateLastBlock(latestBlock + 1);
  } catch (err) {
    console.error("❌ Indexer error:", err.message);
  }
}

indexContractTx();

// cron.schedule("*/15 * * * * *", indexContractTx); // every 15 sec

console.log("🚀 Smart Contract Indexer Running...");
