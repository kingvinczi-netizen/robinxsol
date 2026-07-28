import { ethers, network } from "hardhat";

const M2026_ADDRESS = "0x590c8C64d29598318F5dc6d13910e9B80159D57c";

async function main() {
  if (network.name !== "sepolia") {
    throw new Error(`Refusing to deploy to '${network.name}' — this project targets Sepolia.`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Pass = await ethers.getContractFactory("TraderPass");
  const pass = await Pass.deploy(M2026_ADDRESS);
  await pass.waitForDeployment();

  const address = await pass.getAddress();
  console.log(`\nTraderPass deployed at: ${address}`);
  console.log(`\nVerify with:\n  npx hardhat verify --network sepolia ${address} ${M2026_ADDRESS}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
