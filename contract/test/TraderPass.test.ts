import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, setStorageAt } from "@nomicfoundation/hardhat-toolbox/network-helpers";

// Storage slot for `nextTokenId`, confirmed empirically (ERC721's name/symbol
// occupy slots 0-1, its four internal mappings reserve slots 2-5, so our
// contract's own first declared storage variable lands at slot 6).
const NEXT_TOKEN_ID_SLOT = 6;

describe("TraderPass", () => {
  async function deployFixture() {
    const [alice, bob, carol] = await ethers.getSigners();

    const Token = await ethers.getContractFactory("MockM2026");
    const token = await Token.deploy();

    const Factory = await ethers.getContractFactory("TraderPass");
    const pass = await Factory.deploy(await token.getAddress());

    // Alice and Bob hold enough m2026 to mint; Carol deliberately doesn't.
    await token.mint(alice.address, ethers.parseUnits("2", 18));
    await token.mint(bob.address, ethers.parseUnits("5", 18));
    await token.mint(carol.address, ethers.parseUnits("1", 18)); // below the 2 minimum

    return { pass, token, alice, bob, carol };
  }

  it("has the right name and symbol", async () => {
    const { pass } = await loadFixture(deployFixture);
    expect(await pass.name()).to.equal("DAT620 Trader Pass");
    expect(await pass.symbol()).to.equal("PASS");
  });

  it("mints token #1 to the first eligible caller and increments after that", async () => {
    const { pass, alice, bob } = await loadFixture(deployFixture);
    await pass.connect(alice).mint();
    expect(await pass.ownerOf(1)).to.equal(alice.address);
    expect(await pass.balanceOf(alice.address)).to.equal(1n);

    await pass.connect(bob).mint();
    expect(await pass.ownerOf(2)).to.equal(bob.address);
    expect(await pass.totalMinted()).to.equal(2n);
  });

  it("blocks a second mint from the same wallet", async () => {
    const { pass, alice } = await loadFixture(deployFixture);
    await pass.connect(alice).mint();
    await expect(pass.connect(alice).mint()).to.be.revertedWith("already minted a pass");
  });

  it("blocks minting for a wallet holding fewer than 2 m2026", async () => {
    const { pass, carol } = await loadFixture(deployFixture);
    await expect(pass.connect(carol).mint()).to.be.revertedWith("need at least 2 m2026 to mint");
  });

  it("allows minting the moment a wallet reaches 2 m2026", async () => {
    const { pass, token, carol } = await loadFixture(deployFixture);
    await token.mint(carol.address, ethers.parseUnits("1", 18)); // now has 2 total
    await expect(pass.connect(carol).mint()).to.not.be.reverted;
  });

  it("stops minting once MAX_SUPPLY is reached", async () => {
    const { pass, token, alice, bob } = await loadFixture(deployFixture);
    expect(await pass.MAX_SUPPLY()).to.equal(20000n);
    const passAddr = await pass.getAddress();

    // Jump nextTokenId straight to 20000 via direct storage write, rather
    // than minting 20,000 times, then prove the exact boundary: the
    // 20,000th mint succeeds, the 20,001st reverts.
    await setStorageAt(passAddr, NEXT_TOKEN_ID_SLOT, 20000n);
    expect(await pass.nextTokenId()).to.equal(20000n);

    await pass.connect(alice).mint(); // mints token #20000
    expect(await pass.totalMinted()).to.equal(20000n);
    expect(await pass.ownerOf(20000)).to.equal(alice.address);

    await expect(pass.connect(bob).mint()).to.be.revertedWith("all passes minted");
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
    expect(svg).to.include("url(#badge)"); // proves the glossy gradients are present
  });

  it("reverts tokenURI for a token that was never minted", async () => {
    const { pass } = await loadFixture(deployFixture);
    await expect(pass.tokenURI(99)).to.be.reverted;
  });
});
