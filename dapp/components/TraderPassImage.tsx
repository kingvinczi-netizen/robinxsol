"use client";

import { useEffect, useMemo, useState } from "react";
import { createPublicClient, fallback, http, type Address } from "viem";
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
// getLogs at a tiny block range; these public endpoints allow bigger ranges.
// Falls back across providers so one rate-limited/down endpoint can't blank
// the whole card, and the chunked scan below keeps each call under whatever
// per-request range cap the active provider enforces (verified live:
// tenderly tolerates 100k+ block ranges, drpc caps at 10k on its free tier;
// publicnode now gates getLogs behind a paid archive token and
// rpc.sepolia.org no longer responds at all, so both were dropped).
const logClient = createPublicClient({
  chain: sepolia,
  transport: fallback([
    http("https://sepolia.gateway.tenderly.co"),
    http("https://sepolia.drpc.org"),
  ]),
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

const LOG_SCAN_CHUNK = 9_999n;

async function getMintLogs(account: Address) {
  const latest = await logClient.getBlockNumber();
  const logs = [];
  for (let from = TRADER_PASS_DEPLOY_BLOCK; from <= latest; from += LOG_SCAN_CHUNK) {
    const to = from + LOG_SCAN_CHUNK - 1n > latest ? latest : from + LOG_SCAN_CHUNK - 1n;
    const chunk = await logClient.getLogs({
      address: TRADER_PASS_ADDRESS,
      event: TRANSFER_EVENT,
      args: { to: account },
      fromBlock: from,
      toBlock: to,
    });
    logs.push(...chunk);
  }
  return logs;
}

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
        const logs = await getMintLogs(account);
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
