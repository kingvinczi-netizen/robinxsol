"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, http, type Address } from "viem";
import { sepolia } from "wagmi/chains";
import { useReadContract } from "wagmi";
import {
  TRADER_PASS_ABI,
  TRADER_PASS_ADDRESS,
  TRADER_PASS_DEPLOY_BLOCK,
} from "@/lib/game";

// The pass art and metadata live entirely on-chain (base64 SVG in tokenURI),
// so the dapp can render the exact image itself — no wallet, marketplace, or
// image host needed.

// Dedicated client for the one event-log lookup. The app's default RPC caps
// getLogs at a tiny block range; this public endpoint allows the full range
// in a single call.
const logClient = createPublicClient({
  chain: sepolia,
  transport: http("https://sepolia.drpc.org"),
});

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
} as const;

export function TraderPassImage({ account }: { account: Address }) {
  const [tokenId, setTokenId] = useState<bigint | undefined>();
  const [failed, setFailed] = useState(false);

  // Find which token id this wallet minted, from its mint event.
  useEffect(() => {
    let cancelled = false;
    setTokenId(undefined);
    setFailed(false);
    (async () => {
      try {
        const logs = await logClient.getLogs({
          address: TRADER_PASS_ADDRESS,
          event: TRANSFER_EVENT,
          args: { to: account },
          fromBlock: TRADER_PASS_DEPLOY_BLOCK,
          toBlock: "latest",
        });
        if (cancelled) return;
        if (logs.length > 0) {
          setTokenId(logs[logs.length - 1].args.tokenId);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account]);

  const { data: uri } = useReadContract({
    address: TRADER_PASS_ADDRESS,
    abi: TRADER_PASS_ABI,
    functionName: "tokenURI",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: { enabled: tokenId !== undefined },
  });

  const image = useMemo(() => {
    if (!uri) return undefined;
    try {
      const json = JSON.parse(atob((uri as string).split(",")[1]));
      return json.image as string;
    } catch {
      return undefined;
    }
  }, [uri]);

  // If the lookup fails, quietly render nothing rather than a broken card —
  // the pass still works for betting regardless of whether the art shows.
  if (failed) return null;

  return (
    <div className="card">
      <h2>Your Trader Pass{tokenId !== undefined ? ` #${tokenId}` : ""}</h2>
      {image ? (
        <img src={image} alt="Trader Pass" className="pass-image" />
      ) : (
        <p className="hint">Loading your pass art…</p>
      )}
    </div>
  );
}
