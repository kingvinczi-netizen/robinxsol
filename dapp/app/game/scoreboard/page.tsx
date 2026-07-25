"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { GAME_ABI, GAME_ADDRESS, OUTCOME_LABELS, formatPythUsd } from "@/lib/game";
import { useGameRound } from "@/lib/useGameRound";
import { usePriceFlash } from "@/lib/usePriceFlash";
import { CountdownRing } from "@/components/CountdownRing";
import { PriceTicker } from "@/components/PriceTicker";

export default function ScoreboardPage() {
  const { roundId, round, secondsLeft, livePrice } = useGameRound();
  const dec = 18;

  const upPool = round ? round[4] : 0n;
  const downPool = round ? round[5] : 0n;
  const total = upPool + downPool;
  const upPct = total > 0n ? Number((upPool * 100n) / total) : 50;

  const livePriceStr = livePrice ? formatPythUsd(livePrice.price, livePrice.expo) : undefined;
  const flash = usePriceFlash(livePrice ? Number(livePrice.price) : undefined);

  return (
    <main className="scoreboard">
      <PriceTicker price={livePriceStr} />

      <div className="sb-header">
        <img src="/logo.svg" alt="" width={56} height={56} />
        <h1>BTC UP or DOWN</h1>
      </div>

      {roundId === undefined || roundId === 0n ? (
        <div className="sb-waiting">Waiting for the game to start…</div>
      ) : (
        <>
          <div className="sb-round">Round {roundId.toString()}</div>
          <CountdownRing seconds={secondsLeft} totalSeconds={80} size={260} />

          <div className="sb-price-row">
            <div>
              <div className="sb-label">Opened at</div>
              <div className="sb-price">{round ? formatPythUsd(round[2], -8) : "…"}</div>
            </div>
            <div>
              <div className="sb-label">Live BTC/USD</div>
              <div
                className={`sb-price live ${flash === "up" ? "price-flash-up" : flash === "down" ? "price-flash-down" : ""}`}
              >
                {livePriceStr ?? "…"}
              </div>
            </div>
          </div>

          <div className="sb-bar">
            <div className="sb-bar-up" style={{ width: `${upPct}%` }} />
            <div className="sb-bar-down" style={{ width: `${100 - upPct}%` }} />
            <div className="sb-bar-vs">VS</div>
          </div>
          <div className="sb-bar-labels">
            <span>UP · {formatUnits(upPool, dec)} m2026</span>
            <span>DOWN · {formatUnits(downPool, dec)} m2026</span>
          </div>
        </>
      )}

      <div className="sb-history">
        <h2>Recent results</h2>
        <ScoreboardHistory currentRoundId={roundId} />
      </div>
    </main>
  );
}

function ScoreboardHistory({ currentRoundId }: { currentRoundId: bigint | undefined }) {
  if (currentRoundId === undefined || currentRoundId <= 1n) {
    return <p className="sb-hint">No settled rounds yet.</p>;
  }
  const ids: bigint[] = [];
  for (let i = currentRoundId - 1n; i > 0n && ids.length < 8; i--) ids.push(i);

  return (
    <div className="sb-history-grid">
      {ids.map((id) => (
        <ScoreboardRound key={id.toString()} roundId={id} />
      ))}
    </div>
  );
}

function ScoreboardRound({ roundId }: { roundId: bigint }) {
  const { data: round } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "rounds",
    args: [roundId],
  });
  if (!round || !round[6]) return null;

  const outcome = OUTCOME_LABELS[round[8]];
  const cls = round[7] ? "tie" : outcome.toLowerCase();

  return (
    <div className={`sb-history-item ${cls}`}>
      <span className="sb-history-round">#{roundId.toString()}</span>
      <span className="sb-history-outcome">{round[7] ? "REFUND" : outcome}</span>
    </div>
  );
}
