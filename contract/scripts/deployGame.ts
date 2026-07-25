import { ethers, network } from "hardhat";

// Real, verified addresses on Sepolia (see conversation history for how
// these were confirmed on-chain before building against them):
const M2026_ADDRESS = "0x590c8C64d29598318F5dc6d13910e9B80159D57c";
const PYTH_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";
const BTC_USD_PRICE_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

async function main() {
  if (network.name !== "sepolia") {
    throw new Error(
      `This game stakes m2026, which only exists on Sepolia. Refusing to deploy to '${network.name}'.`
    );
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Game = await ethers.getContractFactory("BTCPredictionGame");
  const game = await Game.deploy(M2026_ADDRESS, PYTH_ADDRESS, BTC_USD_PRICE_ID);
  await game.waitForDeployment();

  const address = await game.getAddress();
  console.log(`\nBTCPredictionGame deployed at: ${address}`);
  console.log(`Staking token (m2026): ${M2026_ADDRESS}`);
  console.log(`Pyth oracle:           ${PYTH_ADDRESS}`);
  console.log(`Price feed id:         ${BTC_USD_PRICE_ID}`);
  console.log(
    `\nVerify with:\n  npx hardhat verify --network sepolia ${address} ${M2026_ADDRESS} ${PYTH_ADDRESS} ${BTC_USD_PRICE_ID}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
