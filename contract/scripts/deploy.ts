import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in .env for live networks."
    );
  }

  console.log(`Network:  ${network.name}`);
  console.log(`Deployer: ${deployer.address}`);

  const Factory = await ethers.getContractFactory("ROBINXSOL");
  const token = await Factory.deploy();
  await token.waitForDeployment();

  const address = await token.getAddress();
  const supply = await token.totalSupply();

  console.log(`\nROBINXSOL (RXS) deployed at: ${address}`);
  console.log(`Total supply (base units):  ${supply.toString()}`);
  console.log(`Total supply (whole RXS):   ${ethers.formatUnits(supply, 18)}`);
  console.log(
    `\nVerify with:\n  npx hardhat verify --network ${network.name} ${address}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
