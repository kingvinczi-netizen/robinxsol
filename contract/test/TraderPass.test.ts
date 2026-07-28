import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("TraderPass", () => {
  async function deployFixture() {
    const [alice, bob] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TraderPass");
    const pass = await Factory.deploy();
    return { pass, alice, bob };
  }

  it("has the right name and symbol", async () => {
    const { pass } = await loadFixture(deployFixture);
    expect(await pass.name()).to.equal("DAT620 Trader Pass");
    expect(await pass.symbol()).to.equal("PASS");
  });

  it("mints token #1 to the first caller and increments after that", async () => {
    const { pass, alice, bob } = await loadFixture(deployFixture);
    await pass.connect(alice).mint();
    expect(await pass.ownerOf(1)).to.equal(alice.address);
    expect(await pass.balanceOf(alice.address)).to.equal(1n);

    await pass.connect(bob).mint();
    expect(await pass.ownerOf(2)).to.equal(bob.address);
  });

  it("blocks a second mint from the same wallet", async () => {
    const { pass, alice } = await loadFixture(deployFixture);
    await pass.connect(alice).mint();
    await expect(pass.connect(alice).mint()).to.be.revertedWith("already minted a pass");
  });

  it("produces a fully on-chain tokenURI with a valid, self-contained SVG", async () => {
    const { pass, alice } = await loadFixture(deployFixture);
    await pass.connect(alice).mint();
    const uri = await pass.tokenURI(1);

    expect(uri.startsWith("data:application/json;base64,")).to.equal(true);
    const json = JSON.parse(
      Buffer.from(uri.replace("data:application/json;base64,", ""), "base64").toString("utf-8")
    );

    expect(json.name).to.equal("Trader Pass #1");
    expect(typeof json.description).to.equal("string");
    expect(json.image.startsWith("data:image/svg+xml;base64,")).to.equal(true);

    const svg = Buffer.from(
      json.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf-8");
    expect(svg.startsWith("<svg")).to.equal(true);
    expect(svg).to.include("TRADER PASS");
    expect(svg).to.include("No. 1");
  });

  it("reverts tokenURI for a token that was never minted", async () => {
    const { pass } = await loadFixture(deployFixture);
    await expect(pass.tokenURI(99)).to.be.reverted;
  });
});
