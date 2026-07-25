import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Matches the real Pyth BTC/USD feed's format: price is an int64, actual
// value = price * 10**expo. Real feed uses expo -8, so $60,000 is
// represented as price = 6_000_000_000_000, expo = -8.
const EXPO = -8;
const PRICE_ID = ethers.encodeBytes32String("BTC/USD-test");
const ROUND_DURATION = 80;

function toRawPrice(usd: number) {
  return BigInt(Math.round(usd * 10 ** -EXPO));
}

describe("BTCPredictionGame", () => {
  async function deployFixture() {
    const [deployer, alice, bob, carol] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockM2026");
    const token = await Token.deploy();

    const MockPyth = await ethers.getContractFactory("MockPyth");
    // 1 hour valid time period (unused since we always pass fresh updates),
    // 1 wei fee per update, matching typical testnet Pyth fee sizes.
    const pyth = await MockPyth.deploy(3600, 1);

    const Game = await ethers.getContractFactory("BTCPredictionGame");
    const game = await Game.deploy(
      await token.getAddress(),
      await pyth.getAddress(),
      PRICE_ID
    );

    // Fund each player with 10 m2026 (matches what students actually hold)
    // and pre-approve the game contract, mirroring the one-time approval
    // step done during the live demo setup.
    for (const player of [alice, bob, carol]) {
      await token.mint(player.address, ethers.parseUnits("10", 18));
      await token.connect(player).approve(await game.getAddress(), ethers.MaxUint256);
    }

    async function priceUpdate(usd: number, publishTime?: number) {
      const raw = toRawPrice(usd);
      const pt = publishTime ?? (await time.latest());
      const data = await pyth.createPriceFeedUpdateData(
        PRICE_ID,
        raw,
        1, // conf
        EXPO,
        raw, // emaPrice (unused by our contract)
        1, // emaConf
        pt,
        pt // prevPublishTime
      );
      return [data];
    }

    return { deployer, alice, bob, carol, token, pyth, game, priceUpdate };
  }

  it("starts round 1 on the first tick", async () => {
    const { game, priceUpdate } = await loadFixture(deployFixture);
    const update = await priceUpdate(60000);
    await game.tick(update, { value: 1 });

    expect(await game.currentRoundId()).to.equal(1n);
    const round = await game.rounds(1);
    expect(round.startPrice).to.equal(toRawPrice(60000));
    expect(round.settled).to.equal(false);
  });

  it("rejects stakes below the minimum or above the maximum", async () => {
    const { game, alice, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });

    await expect(
      game.connect(alice).stake(1, true, ethers.parseUnits("0.5", 18))
    ).to.be.revertedWith("stake must be 1-3 m2026");

    await expect(
      game.connect(alice).stake(1, true, ethers.parseUnits("3.5", 18))
    ).to.be.revertedWith("stake must be 1-3 m2026");
  });

  it("rejects a second stake from the same wallet in the same round", async () => {
    const { game, alice, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });
    await game.connect(alice).stake(1, true, ethers.parseUnits("1", 18));

    await expect(
      game.connect(alice).stake(1, false, ethers.parseUnits("1", 18))
    ).to.be.revertedWith("already staked this round");
  });

  it("rejects stakes after the round has closed", async () => {
    const { game, alice, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });
    await time.increase(ROUND_DURATION + 1);

    await expect(
      game.connect(alice).stake(1, true, ethers.parseUnits("1", 18))
    ).to.be.revertedWith("round closed");
  });

  it("splits the pool exactly per the worked example: 1 vs 3 vs 2", async () => {
    const { game, token, alice, bob, carol, priceUpdate } = await loadFixture(deployFixture);

    await game.tick(await priceUpdate(60000), { value: 1 });
    await game.connect(alice).stake(1, true, ethers.parseUnits("1", 18)); // UP
    await game.connect(bob).stake(1, true, ethers.parseUnits("3", 18)); // UP
    await game.connect(carol).stake(1, false, ethers.parseUnits("2", 18)); // DOWN

    await time.increase(ROUND_DURATION + 1);
    // Price rises -> UP wins. Total pool 6, UP pool 4.
    await game.tick(await priceUpdate(60100), { value: 1 });

    const round1 = await game.rounds(1);
    expect(round1.settled).to.equal(true);
    expect(round1.outcome).to.equal(1n); // Up
    expect(round1.refunded).to.equal(false);

    // Alice: 1 * (6/4) = 1.5. Bob: 3 * (6/4) = 4.5. Carol: 0.
    expect(await game.withdrawable(alice.address)).to.equal(ethers.parseUnits("1.5", 18));
    expect(await game.withdrawable(bob.address)).to.equal(ethers.parseUnits("4.5", 18));
    expect(await game.withdrawable(carol.address)).to.equal(0n);

    // And a new round should already be open, seeded with the same price
    // that just closed round 1 - no wasted extra oracle read.
    expect(await game.currentRoundId()).to.equal(2n);
    const round2 = await game.rounds(2);
    expect(round2.startPrice).to.equal(toRawPrice(60100));

    // Withdraw actually moves tokens and zeroes the ledger.
    await game.connect(bob).withdraw();
    expect(await token.balanceOf(bob.address)).to.equal(
      ethers.parseUnits("10", 18) - ethers.parseUnits("3", 18) + ethers.parseUnits("4.5", 18)
    );
    expect(await game.withdrawable(bob.address)).to.equal(0n);
  });

  it("refunds everyone when the price ties", async () => {
    const { game, alice, bob, priceUpdate } = await loadFixture(deployFixture);

    await game.tick(await priceUpdate(60000), { value: 1 });
    await game.connect(alice).stake(1, true, ethers.parseUnits("2", 18));
    await game.connect(bob).stake(1, false, ethers.parseUnits("3", 18));

    await time.increase(ROUND_DURATION + 1);
    await game.tick(await priceUpdate(60000), { value: 1 }); // identical price

    const round1 = await game.rounds(1);
    expect(round1.outcome).to.equal(3n); // Tie
    expect(round1.refunded).to.equal(true);

    expect(await game.withdrawable(alice.address)).to.equal(ethers.parseUnits("2", 18));
    expect(await game.withdrawable(bob.address)).to.equal(ethers.parseUnits("3", 18));
  });

  it("refunds everyone when nobody staked on the winning side (no contest)", async () => {
    const { game, alice, bob, priceUpdate } = await loadFixture(deployFixture);

    await game.tick(await priceUpdate(60000), { value: 1 });
    // Everyone bets UP...
    await game.connect(alice).stake(1, true, ethers.parseUnits("1", 18));
    await game.connect(bob).stake(1, true, ethers.parseUnits("2", 18));

    await time.increase(ROUND_DURATION + 1);
    // ...but price goes DOWN. DOWN pool is empty, so it's a no-contest, not a real win.
    await game.tick(await priceUpdate(59900), { value: 1 });

    const round1 = await game.rounds(1);
    expect(round1.outcome).to.equal(2n); // Down (that's what actually happened to price)
    expect(round1.refunded).to.equal(true); // but nobody was there to win it, so refund

    expect(await game.withdrawable(alice.address)).to.equal(ethers.parseUnits("1", 18));
    expect(await game.withdrawable(bob.address)).to.equal(ethers.parseUnits("2", 18));
  });

  it("does not settle or advance the round before its window has elapsed", async () => {
    const { game, alice, priceUpdate } = await loadFixture(deployFixture);
    await game.tick(await priceUpdate(60000), { value: 1 });
    await game.connect(alice).stake(1, true, ethers.parseUnits("1", 18));

    // Only 10 seconds in - well before the 80s window closes.
    await time.increase(10);
    await game.tick(await priceUpdate(60050), { value: 1 });

    expect(await game.currentRoundId()).to.equal(1n); // still round 1
    const round1 = await game.rounds(1);
    expect(round1.settled).to.equal(false);
  });

  it("reverts withdraw() when there is nothing to withdraw", async () => {
    const { game, alice } = await loadFixture(deployFixture);
    await expect(game.connect(alice).withdraw()).to.be.revertedWith("nothing to withdraw");
  });
});
