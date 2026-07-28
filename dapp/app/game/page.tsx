"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { useEffect, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  GAME_ABI,
  GAME_ADDRESS,
  M2026_ABI,
  M2026_ADDRESS,
  TRADER_PASS_ABI,
  TRADER_PASS_ADDRESS,
  OUTCOME_LABELS,
  formatPythUsd,
} from "@/lib/game";
import { useGameRound } from "@/lib/useGameRound";
import { usePriceFlash } from "@/lib/usePriceFlash";
import { CountdownRing } from "@/components/CountdownRing";
import { PriceTicker } from "@/components/PriceTicker";
import { TraderPassImage } from "@/components/TraderPassImage";

export default function GamePage() {
  const { address, isConnected, chainId } = useAccount();
  const { livePrice } = useGameRound();
  const livePriceStr = livePrice ? formatPythUsd(livePrice.price, livePrice.expo) : undefined;

  return (
    <main className="page">
      <PriceTicker price={livePriceStr} />
      <div className="header">
        <div className="brand">
          <img src="/logo.svg" alt="" width={40} height={40} />
          <div>
            <h1>BTC UP or DOWN</h1>
            <span>Stake m2026 · Sepolia</span>
          </div>
        </div>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <div className="card">
          <p className="center">Connect your wallet to play.</p>
        </div>
      ) : chainId !== sepolia.id ? (
        <div className="card">
          <h2>Wrong network</h2>
          <p className="hint">
            m2026 only exists on Sepolia. Switch your wallet to Sepolia using the
            network selector above.
          </p>
        </div>
      ) : (
        <Game account={address!} />
      )}

      <footer className="footer">
        <span>
          <Link href="/">ROBINXSOL</Link> · <Link href="/game/scoreboard">Scoreboard view</Link>
        </span>
      </footer>
    </main>
  );
}

function Game({ account }: { account: `0x${string}` }) {
  const { roundId, round, secondsLeft, livePrice, refetch } = useGameRound();
  const priceFlash = usePriceFlash(livePrice ? Number(livePrice.price) : undefined);

  const { data: decimals } = useReadContract({
    address: M2026_ADDRESS,
    abi: M2026_ABI,
    functionName: "decimals",
  });
  const dec = decimals ?? 18;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: M2026_ADDRESS,
    abi: M2026_ABI,
    functionName: "balanceOf",
    args: [account],
    query: { refetchInterval: 5000 },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: M2026_ADDRESS,
    abi: M2026_ABI,
    functionName: "allowance",
    args: [account, GAME_ADDRESS],
    query: { refetchInterval: 5000 },
  });

  const { data: myStakeAmount, refetch: refetchMyStake } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "stakeAmount",
    args: roundId !== undefined ? [roundId, account] : undefined,
    query: { enabled: roundId !== undefined, refetchInterval: 4000 },
  });

  const { data: myStakedUp } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "stakedUp",
    args: roundId !== undefined ? [roundId, account] : undefined,
    query: { enabled: roundId !== undefined, refetchInterval: 4000 },
  });

  const { data: withdrawable, refetch: refetchWithdrawable } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "withdrawable",
    args: [account],
    query: { refetchInterval: 5000 },
  });

  const { data: passBalance, refetch: refetchPass } = useReadContract({
    address: TRADER_PASS_ADDRESS,
    abi: TRADER_PASS_ABI,
    functionName: "balanceOf",
    args: [account],
    query: { refetchInterval: 5000 },
  });

  const hasPass = passBalance !== undefined && passBalance > 0n;
  const needsApproval = allowance !== undefined && allowance < maxUint256 / 2n;
  const hasStakedThisRound = myStakeAmount !== undefined && myStakeAmount > 0n;
  const roundOpen = roundId !== undefined && roundId > 0n && round && !round[6] && (secondsLeft ?? 0) > 0;

  function refetchAll() {
    refetch();
    refetchBalance();
    refetchAllowance();
    refetchMyStake();
    refetchWithdrawable();
    refetchPass();
  }

  return (
    <>
      <div className="card">
        <h2>Your m2026</h2>
        <div className="balance">
          {balance !== undefined ? formatUnits(balance, dec) : "…"} <small>m2026</small>
        </div>
      </div>

      {hasPass && <TraderPassImage account={account} />}

      <div className="card">
        <h2>Round {roundId?.toString() ?? "…"}</h2>
        {roundId === undefined || roundId === 0n ? (
          <p className="hint">Waiting for the game to start...</p>
        ) : (
          <>
            <CountdownRing seconds={secondsLeft} totalSeconds={80} size={140} />
            <div className="row">
              <span className="label">Opened at</span>
              <span className="value">
                {round ? formatPythUsd(round[2], -8) : "…"}
              </span>
            </div>
            <div className="row">
              <span className="label">Live BTC/USD</span>
              <span
                className={`value ${priceFlash === "up" ? "price-flash-up" : priceFlash === "down" ? "price-flash-down" : ""}`}
              >
                {livePrice ? formatPythUsd(livePrice.price, livePrice.expo) : "…"}
              </span>
            </div>
            <div className="row">
              <span className="label">UP pool</span>
              <span className="value">{round ? formatUnits(round[4], dec) : "0"} m2026</span>
            </div>
            <div className="row">
              <span className="label">DOWN pool</span>
              <span className="value">{round ? formatUnits(round[5], dec) : "0"} m2026</span>
            </div>
          </>
        )}
      </div>

      {roundId !== undefined && roundId > 0n && hasStakedThisRound && (
        <div className="card">
          <h2>Your bet this round</h2>
          <p className="hint">
            {formatUnits(myStakeAmount!, dec)} m2026 on{" "}
            <strong>{myStakedUp ? "UP" : "DOWN"}</strong>
          </p>
        </div>
      )}

      {roundId !== undefined && roundId > 0n && !hasStakedThisRound && (
        <>
          {!hasPass ? (
            <MintPassCard m2026Balance={balance ?? 0n} onDone={refetchAll} />
          ) : needsApproval ? (
            <ApproveCard onDone={refetchAll} />
          ) : (
            <StakeCard
              roundId={roundId}
              decimals={dec}
              balance={balance ?? 0n}
              roundOpen={!!roundOpen}
              onDone={refetchAll}
            />
          )}
        </>
      )}

      <div className="card">
        <h2>Winnings</h2>
        <div className="row">
          <span className="label">Withdrawable</span>
          <span className="value">
            {withdrawable !== undefined ? formatUnits(withdrawable, dec) : "0"} m2026
          </span>
        </div>
        <WithdrawButton
          disabled={!withdrawable || withdrawable === 0n}
          onDone={refetchAll}
        />
      </div>

      <div className="card">
        <h2>Recent rounds</h2>
        <RoundHistory currentRoundId={roundId} decimals={dec} />
      </div>
    </>
  );
}

function MintPassCard({ m2026Balance, onDone }: { m2026Balance: bigint; onDone: () => void }) {
  const { data: hash, error, writeContract, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const { data: totalMinted } = useReadContract({
    address: TRADER_PASS_ADDRESS,
    abi: TRADER_PASS_ABI,
    functionName: "totalMinted",
    query: { refetchInterval: 8000 },
  });
  const { data: maxSupply } = useReadContract({
    address: TRADER_PASS_ADDRESS,
    abi: TRADER_PASS_ABI,
    functionName: "MAX_SUPPLY",
  });

  useEffect(() => {
    if (isSuccess) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const eligible = m2026Balance >= parseUnits("2", 18);
  const soldOut = totalMinted !== undefined && maxSupply !== undefined && totalMinted >= maxSupply;

  return (
    <div className="card">
      <h2>Trader Pass required</h2>
      <p className="hint">
        This game requires a free Trader Pass NFT before you can bet. You
        need at least 2 m2026 to mint one, capped at 20,000 passes total.
      </p>
      {totalMinted !== undefined && maxSupply !== undefined && (
        <p className="hint">
          {totalMinted.toString()} / {maxSupply.toString()} minted
        </p>
      )}
      <button
        className="primary"
        disabled={!eligible || soldOut || isPending || isConfirming}
        onClick={() => {
          reset();
          writeContract({
            address: TRADER_PASS_ADDRESS,
            abi: TRADER_PASS_ABI,
            functionName: "mint",
          });
        }}
      >
        {soldOut
          ? "Sold out"
          : isPending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Minting…"
              : "Mint Trader Pass"}
      </button>
      {!eligible && !soldOut && (
        <div className="note pending">You need at least 2 m2026 in your wallet to mint a pass.</div>
      )}
      {isSuccess && <div className="note success">Pass minted. You can now place bets.</div>}
      {error && (
        <div className="note error">
          {(error as { shortMessage?: string }).shortMessage || "Mint failed."}
        </div>
      )}
    </div>
  );
}

function ApproveCard({ onDone }: { onDone: () => void }) {
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  return (
    <div className="card">
      <h2>One-time setup</h2>
      <p className="hint">
        Approve the game contract to spend your m2026 once. After this, every
        bet is a single transaction.
      </p>
      <button
        className="primary"
        disabled={isPending || isConfirming}
        onClick={() =>
          writeContract({
            address: M2026_ADDRESS,
            abi: M2026_ABI,
            functionName: "approve",
            args: [GAME_ADDRESS, maxUint256],
          })
        }
      >
        {isPending ? "Confirm in wallet…" : isConfirming ? "Approving…" : "Approve m2026"}
      </button>
    </div>
  );
}

function StakeCard({
  roundId,
  decimals,
  balance,
  roundOpen,
  onDone,
}: {
  roundId: bigint;
  decimals: number;
  balance: bigint;
  roundOpen: boolean;
  onDone: () => void;
}) {
  const [isUp, setIsUp] = useState<boolean | null>(null);
  const [amount, setAmount] = useState(1);

  const { data: hash, error, writeContract, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  const parsed = BigInt(amount) * 10n ** BigInt(decimals);
  const insufficientBalance = parsed > balance;

  return (
    <div className="card">
      <h2>Place your bet</h2>
      {!roundOpen && <p className="note pending">Round closing, please wait for the next one…</p>}

      <div className="direction-row">
        <button
          className={`direction-btn up ${isUp === true ? "selected" : ""}`}
          onClick={() => setIsUp(true)}
        >
          UP
        </button>
        <button
          className={`direction-btn down ${isUp === false ? "selected" : ""}`}
          onClick={() => setIsUp(false)}
        >
          DOWN
        </button>
      </div>

      <div className="amount-row">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            className={`amount-btn ${amount === n ? "selected" : ""}`}
            onClick={() => setAmount(n)}
          >
            {n} m2026
          </button>
        ))}
      </div>

      <button
        className="primary"
        disabled={isUp === null || !roundOpen || insufficientBalance || isPending || isConfirming}
        onClick={() => {
          reset();
          writeContract({
            address: GAME_ADDRESS,
            abi: GAME_ABI,
            functionName: "stake",
            args: [roundId, isUp!, parsed],
          });
        }}
      >
        {isPending ? "Confirm in wallet…" : isConfirming ? "Placing bet…" : "Place bet"}
      </button>

      {insufficientBalance && <div className="note error">Not enough m2026.</div>}
      {isSuccess && <div className="note success">Bet placed.</div>}
      {error && (
        <div className="note error">
          {(error as { shortMessage?: string }).shortMessage || "Transaction failed."}
        </div>
      )}
    </div>
  );
}

function WithdrawButton({ disabled, onDone }: { disabled: boolean; onDone: () => void }) {
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isSuccess) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  return (
    <button
      className="primary"
      disabled={disabled || isPending || isConfirming}
      onClick={() =>
        writeContract({ address: GAME_ADDRESS, abi: GAME_ABI, functionName: "withdraw" })
      }
    >
      {isPending ? "Confirm in wallet…" : isConfirming ? "Withdrawing…" : "Withdraw"}
    </button>
  );
}

function RoundHistory({
  currentRoundId,
  decimals,
}: {
  currentRoundId: bigint | undefined;
  decimals: number;
}) {
  if (currentRoundId === undefined || currentRoundId <= 1n) {
    return <p className="hint">No settled rounds yet.</p>;
  }
  const ids: bigint[] = [];
  for (let i = currentRoundId - 1n; i > 0n && ids.length < 5; i--) ids.push(i);

  return (
    <>
      {ids.map((id) => (
        <PastRound key={id.toString()} roundId={id} decimals={decimals} />
      ))}
    </>
  );
}

function PastRound({ roundId, decimals }: { roundId: bigint; decimals: number }) {
  const { data: round } = useReadContract({
    address: GAME_ADDRESS,
    abi: GAME_ABI,
    functionName: "rounds",
    args: [roundId],
  });
  if (!round || !round[6]) return null;

  const outcome = OUTCOME_LABELS[round[8]];
  const label = round[7] ? `${outcome} (refunded)` : outcome;

  return (
    <div className="row">
      <span className="label">Round {roundId.toString()}</span>
      <span className="value">
        {formatPythUsd(round[2], -8)} → {formatPythUsd(round[3], -8)} · {label}
      </span>
    </div>
  );
}
