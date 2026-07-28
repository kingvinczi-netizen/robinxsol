import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const EXPO = -8;
const PRICE_ID = ethers.encodeBytes32String("BTC/USD-test");
const ROUND_DURATION = 80;

function toRawPrice(usd: number) {
  return BigInt(Math.round(usd * 10 ** -EXPO));
}

describe("BTCPredictionGameV2", () => {
  async function deployFixture() {
    const [deployer, alice, bob, carol] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockM2026");
    const token = await Token.deploy();

    const Pass = await ethers.getContractFactory("TraderPass");
    const pass = await Pass.deploy();

    const MockPyth = await ethers.getContractFactory("MockPyth");
    const pyth = await MockPyth.deploy(3600, 1);

    const Game = await ethers.getContractFactory("BTCPredictionGameV2");
    const game = await Game.deploy(
      await token.getAddress(),
      await pyth.getAddress(),
      PRICE_ID,
      await pass.getAddress()
    );

    // Alice and Bob mint passes and get funded; Carol deliberately has no
    // pass, so we can prove the gate actually blocks her.
    for (const player of [alice, bob]) {
      await pass.connect(player).mint();
      await token.mint(player.address, ethers.parseUnits("10", 18));
      await token.connect(player).approve(await game.getAddress(), ethers.MaxUint256);
    }
    await token.mint(carol.address, ethers.parseUnits("10", 18));
    await token.connect(carol).approve(await game.getAddress(), ethers.MaxUint256);

    async function priceUpdate(usd: number, publishTime?: number) {
      const raw = toRawPrice(usd);
      const pt = publishTime ?? (await time.latest());
      const data = await pyth.createPriceFeedUpdateData(PRICE_ID, raw, 1, EXPO, raw, 1, pt, pt);
      return [data];
    }

    return { deployer, alice, bob, carol, token, pass, pyth, game, priceUpdate };
  }

  it("blocks staking for a wallet with no Trader Pass", async () => {
    const { game, carol, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });

    await expect(
      game.connect(carol).stake(1, true, ethers.parseUnits("1", 18))
    ).to.be.revertedWith("need a Trader Pass to bet");
  });

  it("allows staking once a Trader Pass is minted", async () => {
    const { game, pass, carol, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });

    await pass.connect(carol).mint();
    await expect(game.connect(carol).stake(1, true, ethers.parseUnits("1", 18))).to.not.be
      .reverted;
  });

  it("still splits the pool correctly for pass-holders (payout math unchanged)", async () => {
    const { game, token, alice, bob, priceUpdate } = await loadFixture(deployFixture);

    await game.tick(await priceUpdate(60000), { value: 1 });
    await game.connect(alice).stake(1, true, ethers.parseUnits("1", 18));
    await game.connect(bob).stake(1, false, ethers.parseUnits("2", 18));

    await time.increase(ROUND_DURATION + 1);
    await game.tick(await priceUpdate(60100), { value: 1 }); // UP wins

    // Total pool 3, UP pool 1 -> Alice gets 1 * (3/1) = 3.
    expect(await game.withdrawable(alice.address)).to.equal(ethers.parseUnits("3", 18));
    expect(await game.withdrawable(bob.address)).to.equal(0n);

    await game.connect(alice).withdraw();
    expect(await token.balanceOf(alice.address)).to.equal(
      ethers.parseUnits("10", 18) - ethers.parseUnits("1", 18) + ethers.parseUnits("3", 18)
    );
  });

  it("refunds a tie exactly as before", async () => {
    const { game, alice, bob, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });
    await game.connect(alice).stake(1, true, ethers.parseUnits("2", 18));
    await game.connect(bob).stake(1, false, ethers.parseUnits("1", 18));

    await time.increase(ROUND_DURATION + 1);
    await game.tick(await priceUpdate(60000), { value: 1 });

    expect(await game.withdrawable(alice.address)).to.equal(ethers.parseUnits("2", 18));
    expect(await game.withdrawable(bob.address)).to.equal(ethers.parseUnits("1", 18));
  });
});
