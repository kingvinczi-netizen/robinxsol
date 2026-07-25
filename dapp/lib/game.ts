import { type Address } from "viem";

// Sepolia only — m2026 (the lecturer's marks token used as stake) only
// exists there, so the whole game runs on Sepolia.
export const GAME_ADDRESS: Address = "0xB11c6C01E8A3a0da8Be97D3A9197Dc1E1Fa12D45";
export const M2026_ADDRESS: Address = "0x590c8C64d29598318F5dc6d13910e9B80159D57c";
export const PYTH_ADDRESS: Address = "0xDd24F84d36BF92C65F92307595335bdFab5Bbd21";
export const BTC_USD_PRICE_ID =
  "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43";

export const M2026_ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export const GAME_ABI = [
  { type: "function", name: "currentRoundId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "timeRemaining", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MIN_STAKE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "MAX_STAKE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "ROUND_DURATION", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "rounds",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "startPrice", type: "int64" },
      { name: "endPrice", type: "int64" },
      { name: "upPool", type: "uint256" },
      { name: "downPool", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "refunded", type: "bool" },
      { name: "outcome", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "stakeAmount",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "stakedUp",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "withdrawable",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "stake",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "isUp", type: "bool" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

// Read-only slice of Pyth's interface, just enough to show a live reference
// price. The authoritative settlement price is whatever the keeper posted
// on-chain at round open/close; this is purely for display.
export const PYTH_READ_ABI = [
  {
    type: "function",
    name: "getPriceUnsafe",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        name: "price",
        type: "tuple",
        components: [
          { name: "price", type: "int64" },
          { name: "conf", type: "uint64" },
          { name: "expo", type: "int32" },
          { name: "publishTime", type: "uint256" },
        ],
      },
    ],
  },
] as const;

export const OUTCOME_LABELS = ["Pending", "UP", "DOWN", "Tie"] as const;

export function formatPythUsd(price: bigint, expo: number): string {
  const value = Number(price) * 10 ** expo;
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
