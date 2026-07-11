# Build Prompt: ERC20 Token + Dapp

Paste this whole thing into your AI coding assistant (Claude Code, Cursor, etc.).
Fill in the four bracketed values in the "Token spec" section first, then send it.

---

## The task

Build a complete, working ERC20 token and a web dapp to interact with it. Deliver:

1. A Solidity ERC20 smart contract using OpenZeppelin (audited library, don't hand-roll it).
2. A Hardhat project that compiles, tests, and deploys the contract to a testnet.
3. A Next.js dapp (wagmi + viem + RainbowKit) that connects a wallet and shows the balance, plus a transfer form.

Deploy in two stages: first to the **Sepolia** testnet (free test ETH, no real money) to prove everything works, then to **Base mainnet** for the real launch. Verify the contract on the block explorer at both stages so the source is public.

## Token spec (LOCKED — build exactly this)

- Token name: **ROBINXSOL**
- Symbol: **RXS**
- Decimals: **18** (default, don't change)
- Total supply: **1,000,000,000** (one billion) whole tokens — i.e. `1_000_000_000 * 10**18` base units.
- Supply type: **Fixed.** All 1B tokens are minted once to the deployer in the constructor. No mint function. Supply can never grow.
- Ownership: **None.** Because supply is fixed and there's nothing for an owner to do, do NOT inherit `Ownable`. An ownerless contract has no admin key to lose or leak — this is the safest option and it's intentional.

## Contract requirements

- Solidity **pinned to an exact version** (`pragma solidity 0.8.24;`, not `^0.8.20`). A floating pragma can compile with a different, untested compiler.
- Pin the OpenZeppelin version in `package.json` too (e.g. `@openzeppelin/contracts@5.x` exact, not `^`).
- Import `@openzeppelin/contracts/token/ERC20/ERC20.sol` only. **No `Ownable`, no mint function** — supply is fixed and the contract is ownerless by design.
- Constructor: `ERC20("ROBINXSOL", "RXS")` then `_mint(msg.sender, 1_000_000_000 * 10 ** decimals());`. The deployer receives the full 1B supply. Default decimals is 18 — don't change it.
- Keep it minimal. No transfer taxes, no hidden fees, no backdoors, no pausable, no blacklist. Anything that lets anyone move or freeze another wallet's tokens is a rug-pull red flag — don't add it.

## Project setup

- Use Hardhat. Structure: `contracts/`, `test/`, `scripts/` (or `ignition/` for Hardhat Ignition).
- Install: `@openzeppelin/contracts`, `hardhat`, `@nomicfoundation/hardhat-toolbox`.
- `.env` for secrets: `SEPOLIA_RPC_URL`, `PRIVATE_KEY`, `ETHERSCAN_API_KEY`. Never commit `.env` — add it to `.gitignore`.

## Security hardening (required)

**Contract**
- Use OpenZeppelin's audited base — never hand-write ERC20 balance/allowance logic.
- Run a static analyzer before deploying: `slither .` (or the Remix static analysis tab). Fix or explain every finding.
- Be aware of the `approve` race condition. Prefer `safeIncreaseAllowance` / `safeDecreaseAllowance` patterns in the dapp instead of overwriting an existing allowance with a new `approve`.
- If you add ANY custom logic (vendor, staking, etc. later), follow checks-effects-interactions and add `ReentrancyGuard` on functions that send ETH.
- This token is ownerless by design (fixed supply, no `Ownable`), so there is no admin key to compromise in the first place. Keep it that way — don't add owner-only functions.

**Keys & deployment**
- Deploy from a **fresh, dedicated wallet** — never your personal wallet with real funds. Test ETH only.
- Private key and API keys live in `.env` only. `.env` is git-ignored. Never paste a key into code, a chat, or a screenshot.
- Double-check you're on **Sepolia**, not mainnet, before every deploy. Mainnet costs real money and mistakes are permanent.
- Verify the contract on Etherscan so anyone can read the exact deployed source.

**Dapp**
- Handle decimals with `viem`'s `parseUnits` / `formatUnits`. A hardcoded `* 1e18` or manual math is how people accidentally send 1000x the intended amount.
- Validate every input: checksum the recipient address (`isAddress`), block empty/zero/negative amounts, and block sending more than the balance before the tx is sent.
- Guard the network: if the wallet is on the wrong chain, prompt the user to switch to Sepolia instead of letting the tx fail silently.
- Show a clear confirmation (recipient + amount + token) before the user signs.
- The WalletConnect `projectId` and any RPC URL go in env vars, not committed source.
- Never auto-submit a transaction. The user always reviews and signs in their wallet.

## Tests (required, don't skip)

Write tests that check:
- Name is `ROBINXSOL`, symbol is `RXS`, decimals is `18`.
- Total supply equals exactly `1_000_000_000 * 10**18` after deployment.
- The deployer holds the full 1B balance.
- `transfer` moves tokens and updates both balances.
- `transfer` reverts when the sender has insufficient balance.
- `approve` + `transferFrom` works for a spender.
- There is no `mint` function and no owner — confirm the contract has no way to increase supply.

Run `npx hardhat test` and make sure everything passes before deploying.

## Deploy + verify (two stages — testnet first, then mainnet)

Configure **two networks** in `hardhat.config.ts`: `sepolia` (testnet) and `base` (Base mainnet). Same deploy script runs against both — pass `--network`.

**Stage 1 — Sepolia testnet (do this first, always):**
1. Get free Sepolia test ETH from a faucet (e.g. a Google Cloud / Alchemy Sepolia faucet).
2. Deploy: `npx hardhat run scripts/deploy.ts --network sepolia`.
3. Verify on Etherscan: `npx hardhat verify --network sepolia <address>` (no constructor args — name/symbol/supply are hardcoded in the contract).
4. Point the dapp at this address and confirm the full flow works: connect wallet, see 1B RXS balance, transfer some, balance updates. Only move on once this is solid.

**Stage 2 — Base mainnet (the real launch, only after Stage 1 passes):**
1. Fund the deployer wallet with a small amount of real ETH **on Base** (bridge a few dollars via bridge.base.org — deployment costs only cents, but you need a little for gas).
2. Triple-check the network is `base` and the wallet is the intended fresh deployer.
3. Deploy: `npx hardhat run scripts/deploy.ts --network base`.
4. Verify on Basescan: `npx hardhat verify --network base <address>` (needs a Basescan/Etherscan v2 API key).
5. Report the Base contract address and the Basescan link.

Because the contract is a fixed-supply ERC20 with no constructor arguments, the exact same bytecode deploys to both networks — no code changes between stages.

## Dapp requirements

- Next.js (App Router) + TypeScript.
- Wallet connection via RainbowKit (`wagmi` + `viem` under the hood).
- Read and display: token name, symbol, connected wallet's balance, total supply.
- A transfer form: recipient address + amount, calls `transfer`, shows tx status (pending / success / error).
- Configure the dapp for both **Sepolia** and **Base mainnet**. Store the contract address per chain (env vars: one for Sepolia, one for Base). Import the ABI from the compiled artifact.
- Clean, simple UI. Mobile-friendly. No need for anything fancy.

## Definition of done

- `npx hardhat test` passes (all cases above green).
- `slither .` run, findings fixed or explained.
- Contract live and **verified on Sepolia** first, dapp confirmed working against it end-to-end.
- Then contract live and **verified on Base mainnet** (share the Basescan link).
- The dapp runs locally (`npm run dev`), connects a wallet on both chains, shows the RXS balance, and a transfer goes through and updates the balance.
- README with: how to install, run tests, deploy to Sepolia, deploy to Base, and run the dapp.

## Rules

- Use OpenZeppelin for the ERC20 base — do not write the token logic from scratch.
- Never put private keys or API keys in code or in git. Use `.env` (git-ignored).
- **Always deploy to Sepolia and fully test there before touching Base mainnet.** Mainnet is real money and permanent.
- Deploy from a fresh, dedicated wallet — never a personal wallet holding real funds.
- Build exactly the locked token spec (ROBINXSOL / RXS / fixed 1B / ownerless). Don't add features that weren't asked for.
- If anything is genuinely ambiguous, pick the simplest safe option and note the assumption in the README.
