import { ethers } from "hardhat";

// Run this from your own machine during the live demo. It's what actually
// advances the game — settling the round that just ended and opening the
// next one — using YOUR wallet's Sepolia ETH for gas, independent of
// whether any student's wallet is connected. Fully permissionless on-chain
// (anyone's tick() would work), this is just the reliable way to drive it
// during class instead of hoping a browser tab does it.

const GAME = "0x2cca0dED136a4eA8a047b747Db3d40FBDf45D21F"; // BTCPredictionGameV2 (requires a Trader Pass to stake)
const BTC_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const POLL_INTERVAL_MS = 5000;

async function fetchHermesUpdate(): Promise<string> {
  const url = `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${BTC_ID}`;
  const res = await fetch(url);
  const json: any = await res.json();
  return "0x" + json.binary.data[0];
}

async function main() {
  const [signer] = await ethers.getSigners();
  const game = await ethers.getContractAt("BTCPredictionGameV2", GAME);
  const pythAddr = await game.pyth();
  const pyth = await ethers.getContractAt("IPyth", pythAddr);

  console.log(`Keeper running as ${signer.address}`);
  console.log(`Watching game at ${GAME}`);
  console.log(`Polling every ${POLL_INTERVAL_MS / 1000}s. Ctrl+C to stop.\n`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const remaining = await game.timeRemaining();
      const roundId = await game.currentRoundId();

      if (remaining === 0n) {
        console.log(`[${new Date().toISOString()}] Round ${roundId} needs advancing, ticking...`);
        const updateData = [await fetchHermesUpdate()];
        const fee = await pyth.getUpdateFee(updateData);
        const tx = await game.tick(updateData, { value: fee });
        await tx.wait();
        const newRoundId = await game.currentRoundId();
        const round = await game.rounds(newRoundId);
        console.log(
          `  -> now on round ${newRoundId}, opened at $${(Number(round.startPrice) / 1e8).toFixed(2)} ` +
            `(tx ${tx.hash.slice(0, 10)}...)`
        );
      } else {
        console.log(`[${new Date().toISOString()}] Round ${roundId}: ${remaining}s left, nothing to do.`);
      }
    } catch (e: any) {
      console.error("Keeper error (will retry):", e.message?.slice(0, 200));
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
