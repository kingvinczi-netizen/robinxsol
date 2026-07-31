# ROBINXSOL (RXS)

<!-- Deployed to Vercel automatically from main via GitHub integration. -->

A fixed-supply, ownerless ERC20 token and a web dapp to view balances and send tokens.

- **Token:** ROBINXSOL, symbol **RXS**, 18 decimals, fixed supply of **1,000,000,000** (1B).
- **Design:** all tokens minted once to the deployer. No mint function, no owner — the supply can never grow and there is no admin key to lose or leak.
- **Deploy path:** Sepolia testnet first (prove it works), then Base mainnet for the real launch.

## Layout

```
erc20-token-dapp/
├── contract/     Hardhat project — the Solidity token, tests, deploy scripts
└── dapp/         Next.js frontend — wallet connect, balance, transfer
```

## Contract (`contract/`)

Built with Hardhat + OpenZeppelin 5. The token is `contracts/ROBINXSOL.sol`.

### Install and test

```bash
cd contract
npm install
npx hardhat compile
npx hardhat test
```

All six tests should pass (name/symbol/decimals, 1B supply to deployer, transfer, insufficient-balance revert, approve + transferFrom, and a check that no mint/owner exists).

### Configure secrets

```bash
cp .env.example .env
```

Fill in `.env`:

- `SEPOLIA_RPC_URL` — an RPC endpoint (Infura/Alchemy/public).
- `BASE_RPC_URL` — defaults to `https://mainnet.base.org`.
- `PRIVATE_KEY` — a **fresh, dedicated** deployer wallet. Never a personal wallet with real funds.
- `ETHERSCAN_API_KEY` — one Etherscan v2 key verifies on both Etherscan and Basescan.

`.env` is git-ignored. Never commit it.

### Deploy — Stage 1 (Sepolia testnet, do this first)

```bash
# Get free Sepolia test ETH from a faucet first, then:
npm run deploy:sepolia
npx hardhat verify --network sepolia <deployed-address>
```

The contract has no constructor arguments, so verify needs only the address.

### Deploy — Stage 2 (Base mainnet, only after Stage 1 works)

Fund the deployer wallet with a few dollars of real ETH **on Base** (bridge via bridge.base.org — deployment itself costs only cents).

```bash
npm run deploy:base
npx hardhat verify --network base <deployed-address>
```

## Dapp (`dapp/`)

Next.js (App Router) + wagmi + viem + RainbowKit.

### Install and run

```bash
cd dapp
npm install
cp .env.local.example .env.local   # fill in the values below
npm run dev                         # http://localhost:3000
```

`.env.local`:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — free id from https://cloud.reown.com.
- `NEXT_PUBLIC_RXS_ADDRESS_SEPOLIA` — the Sepolia contract address from Stage 1.
- `NEXT_PUBLIC_RXS_ADDRESS_BASE` — the Base contract address from Stage 2.

### What it does

- Connect a wallet (RainbowKit).
- Read and show token name, symbol, total supply, and your RXS balance.
- Send RXS to any address with a transfer form.
- Detects when the wallet is on an unsupported network and prompts to switch.

## Security notes

- ERC20 logic comes from audited OpenZeppelin — nothing is hand-rolled.
- Solidity version is pinned (`0.8.24`) and the OpenZeppelin version is pinned (`5.1.0`).
- The contract is intentionally ownerless: no mint, no pause, no blacklist, no way to touch anyone else's tokens.
- The dapp uses `parseUnits`/`formatUnits` for all amounts (no manual decimal math), validates the recipient address and amount, and blocks sending more than your balance.
- Run a static analyzer before mainnet: `pip install slither-analyzer && slither .` inside `contract/`.
- Test everything on Sepolia before deploying to Base mainnet.
