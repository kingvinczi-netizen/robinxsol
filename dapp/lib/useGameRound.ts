"use client";

import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { GAME_ABI, GAME_ADDRESS, PYTH_ADDRESS, PYTH_READ_ABI, BTC_USD_PRICE_ID } from "@/lib/game";

/** Polls the current round + a locally-ticking countdown, resynced from-chain every few seconds. */
export function useGameRound() {
  const { data: roundId, refetch: refetchRoundId } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "currentRoundId",
    query: { refetchInterval: 4000 },
  });

  const { data: round, refetch: refetchRound } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "rounds",
    args: roundId !== undefined ? [roundId] : undefined,
    query: { enabled: roundId !== undefined, refetchInterval: 4000 },
  });

  const { data: remainingOnChain } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "timeRemaining",
    query: { refetchInterval: 4000 },
  });

  const { data: livePrice } = useReadContract({
    address: PYTH_ADDRESS,
    abi: PYTH_READ_ABI,
    functionName: "getPriceUnsafe",
    args: [BTC_USD_PRICE_ID as `0x${string}`],
    query: { refetchInterval: 3000 },
  });

  // Smooth per-second countdown, resynced whenever the on-chain value updates.
  const [secondsLeft, setSecondsLeft] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (remainingOnChain !== undefined) setSecondsLeft(Number(remainingOnChain));
  }, [remainingOnChain]);
  useEffect(() => {
    if (secondsLeft === undefined) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s !== undefined && s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft === undefined]);

  return {
    roundId,
    round,
    secondsLeft,
    livePrice,
    refetch: () => {
      refetchRoundId();
      refetchRound();
    },
  };
}
