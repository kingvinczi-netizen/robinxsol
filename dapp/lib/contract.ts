import { type Address, isAddress } from "viem";
import { base, sepolia } from "wagmi/chains";

// Minimal ABI — only the parts the dapp actually calls.
export const RXS_ABI = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

// Contract address per chain, read from env. Empty string means "not deployed here yet".
const ADDRESS_BY_CHAIN: Record<number, string> = {
  [sepolia.id]: process.env.NEXT_PUBLIC_RXS_ADDRESS_SEPOLIA || "",
  [base.id]: process.env.NEXT_PUBLIC_RXS_ADDRESS_BASE || "",
};

// Returns the deployed address for a chain, or undefined if not configured / invalid.
export function getContractAddress(chainId?: number): Address | undefined {
  if (!chainId) return undefined;
  const addr = ADDRESS_BY_CHAIN[chainId];
  return addr && isAddress(addr) ? (addr as Address) : undefined;
}

export const SUPPORTED_CHAIN_NAMES: Record<number, string> = {
  [sepolia.id]: "Sepolia",
  [base.id]: "Base",
};
