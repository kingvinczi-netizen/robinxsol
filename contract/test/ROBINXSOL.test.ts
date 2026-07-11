import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ROBINXSOL", () => {
  // 1 billion tokens with 18 decimals, in base units.
  const TOTAL_SUPPLY = 1_000_000_000n * 10n ** 18n;

  async function deployFixture() {
    const [deployer, alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ROBINXSOL");
    const token = await Factory.deploy();
    await token.waitForDeployment();
    return { token, deployer, alice, bob };
  }

  it("has the correct name, symbol, and decimals", async () => {
    const { token } = await loadFixture(deployFixture);
    expect(await token.name()).to.equal("ROBINXSOL");
    expect(await token.symbol()).to.equal("RXS");
    expect(await token.decimals()).to.equal(18);
  });

  it("mints exactly 1B to the deployer and nothing to anyone else", async () => {
    const { token, deployer } = await loadFixture(deployFixture);
    expect(await token.totalSupply()).to.equal(TOTAL_SUPPLY);
    expect(await token.balanceOf(deployer.address)).to.equal(TOTAL_SUPPLY);
  });

  it("transfers tokens and updates both balances", async () => {
    const { token, deployer, alice } = await loadFixture(deployFixture);
    const amount = ethers.parseUnits("1000", 18);
    await expect(token.transfer(alice.address, amount)).to.changeTokenBalances(
      token,
      [deployer, alice],
      [-amount, amount]
    );
  });

  it("reverts a transfer when the sender has insufficient balance", async () => {
    const { token, alice, bob } = await loadFixture(deployFixture);
    const amount = ethers.parseUnits("1", 18);
    // Alice starts with 0, so this must revert with OZ's custom error.
    await expect(
      token.connect(alice).transfer(bob.address, amount)
    ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
  });

  it("supports approve + transferFrom for a spender", async () => {
    const { token, deployer, alice, bob } = await loadFixture(deployFixture);
    const amount = ethers.parseUnits("500", 18);

    await token.approve(alice.address, amount);
    expect(await token.allowance(deployer.address, alice.address)).to.equal(
      amount
    );

    await expect(
      token.connect(alice).transferFrom(deployer.address, bob.address, amount)
    ).to.changeTokenBalances(token, [deployer, bob], [-amount, amount]);

    // Allowance is consumed after the transfer.
    expect(await token.allowance(deployer.address, alice.address)).to.equal(0n);
  });

  it("has no way to increase supply (no mint, no owner)", async () => {
    const { token } = await loadFixture(deployFixture);
    // These functions must not exist on a fixed-supply, ownerless token.
    expect((token as any).mint).to.equal(undefined);
    expect((token as any).owner).to.equal(undefined);
  });
});
