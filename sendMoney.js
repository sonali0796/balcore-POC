import { JsonRpcProvider, formatEther, Wallet, parseEther } from "ethers";

// 1. Connect to Avalanche Fuji Testnet
// const RPC_URL = "https://api.avax.network/ext/bc/C/rpc";
const RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc";
const provider = new JsonRpcProvider(RPC_URL);

const PRIVATE_KEY = process.env.PRIVATE_KEY;

const TO_ADDRESS = "0x545153b4f97765b6ED0722f33618a9295C838310";

async function main() {
  // 2. Check network
  const network = await provider.getNetwork();
  console.log("Connected to chain:", network.chainId); // 43113

  // 3. Get latest block
  const block = await provider.getBlockNumber();
  console.log("Latest block:", block);

  // 4. Check wallet balance
  const address = "0x7bE5c075EcA7f5549180c9A4C82BD0484243c2C9";
  const balance = await provider.getBalance(address);

  console.log("Balance:", formatEther(balance), "AVAX");
}


async function sendTransaction() {
   // Create wallet signer
  const wallet = new Wallet(PRIVATE_KEY, provider);

  console.log("Sender:", wallet.address);

  // Check sender balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Sender balance:", formatEther(balance), "AVAX");

  // Send 0.1 AVAX
  const tx = await wallet.sendTransaction({
    to: TO_ADDRESS,
    value: parseEther("0.1")
  });

  console.log("Transaction sent!");
  console.log("TX Hash:", tx.hash);

  // Wait for confirmation
  await tx.wait();
  console.log("Transaction confirmed ✅");
}

sendTransaction();
