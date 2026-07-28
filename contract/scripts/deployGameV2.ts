import { ethers, network } from "hardhat";

const M2026_ADDRESS = "0x590c8C64d29598318F5dc6d13910e9B80159D57c";
const PYTH_ADDRESS = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";
const BTC_USD_PRICE_ID = "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";
const TRADER_PASS_ADDRESS = "0x146fc4e90Efb17C58670cbE79B83F1699fd197BC";

async function main() {
  if (network.name !== "sepolia") {
    throw new Error(`m2026 only exists on Sepolia. Refusing to deploy to '${network.name}'.`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Game = await ethers.getContractFactory("BTCPredictionGameV2");
  const game = await Game.deploy(M2026_ADDRESS, PYTH_ADDRESS, BTC_USD_PRICE_ID, TRADER_PASS_ADDRESS);
  await game.waitForDeployment();

  const address = await game.getAddress();
  console.log(`\nBTCPredictionGameV2 deployed at: ${address}`);
  console.log(`Staking token (m2026): ${M2026_ADDRESS}`);
  console.log(`Pyth oracle:           ${PYTH_ADDRESS}`);
  console.log(`Price feed id:         ${BTC_USD_PRICE_ID}`);
  console.log(`Trader Pass gate:      ${TRADER_PASS_ADDRESS}`);
  console.log(
    `\nVerify with:\n  npx hardhat verify --network sepolia ${address} ${M2026_ADDRESS} ${PYTH_ADDRESS} ${BTC_USD_PRICE_ID} ${TRADER_PASS_ADDRESS}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
