import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { base, sepolia } from "wagmi/chains";

// Sepolia (testnet) and Base (mainnet) — the two chains ROBINXSOL deploys to.
export const config = getDefaultConfig({
  appName: "ROBINXSOL Dapp",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "PLACEHOLDER_PROJECT_ID",
  chains: [sepolia, base],
  ssr: true,
});
