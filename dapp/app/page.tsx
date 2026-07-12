"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, isAddress, parseUnits, type Address } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  RXS_ABI,
  getContractAddress,
  SUPPORTED_CHAIN_NAMES,
} from "@/lib/contract";

const CONTACT_EMAIL = "kingvinczi@gmail.com";
const GITHUB_URL = "https://github.com/kingvinczi-netizen/robinxsol";
const BASESCAN_URL =
  "https://basescan.org/token/0xf371Aebf460aC70611A4Ada084d7f4aCADAC72c1";

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const contract = getContractAddress(chainId);

  return (
    <main className="page">
      <div className="header">
        <div className="brand">
          <img src="/logo.svg" alt="RXS" width={40} height={40} />
          <div>
            <h1>ROBINXSOL</h1>
            <span>RXS · fixed-supply ERC20</span>
          </div>
        </div>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <div className="card">
          <p className="center">Connect your wallet to view your RXS balance.</p>
        </div>
      ) : !contract ? (
        <div className="card">
          <h2>Wrong network</h2>
          <p className="hint">
            ROBINXSOL isn&apos;t configured on this chain. Switch your wallet to{" "}
            {Object.values(SUPPORTED_CHAIN_NAMES).join(" or ")} using the network
            selector above.
          </p>
        </div>
      ) : (
        <Dashboard
          account={address as Address}
          contract={contract}
          chainId={chainId}
        />
      )}

      <footer className="footer">
        <span>
          Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </span>
        <span>
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>{" "}
          ·{" "}
          <a href={BASESCAN_URL} target="_blank" rel="noreferrer">
            Contract on Basescan
          </a>
        </span>
      </footer>
    </main>
  );
}

function Dashboard({
  account,
  contract,
  chainId,
}: {
  account: Address;
  contract: Address;
  chainId?: number;
}) {
  const base = { address: contract, abi: RXS_ABI } as const;

  const { data: name } = useReadContract({ ...base, functionName: "name" });
  const { data: symbol } = useReadContract({ ...base, functionName: "symbol" });
  const { data: decimals } = useReadContract({
    ...base,
    functionName: "decimals",
  });
  const { data: totalSupply } = useReadContract({
    ...base,
    functionName: "totalSupply",
  });
  const { data: balance, refetch: refetchBalance } = useReadContract({
    ...base,
    functionName: "balanceOf",
    args: [account],
  });

  const dec = decimals ?? 18;

  return (
    <>
      <div className="card">
        <h2>Your balance</h2>
        <div className="balance">
          {balance !== undefined ? formatUnits(balance, dec) : "—"}{" "}
          <small>{(symbol as string) ?? "RXS"}</small>
        </div>
      </div>

      <div className="card">
        <h2>Token</h2>
        <div className="row">
          <span className="label">Name</span>
          <span className="value">{(name as string) ?? "…"}</span>
        </div>
        <div className="row">
          <span className="label">Symbol</span>
          <span className="value">{(symbol as string) ?? "…"}</span>
        </div>
        <div className="row">
          <span className="label">Total supply</span>
          <span className="value">
            {totalSupply !== undefined
              ? Number(formatUnits(totalSupply, dec)).toLocaleString()
              : "…"}
          </span>
        </div>
        <div className="row">
          <span className="label">Network</span>
          <span className="value">
            {chainId ? SUPPORTED_CHAIN_NAMES[chainId] ?? "Unsupported" : "—"}
          </span>
        </div>
      </div>

      <TransferForm
        contract={contract}
        decimals={dec}
        symbol={(symbol as string) ?? "RXS"}
        balance={(balance as bigint) ?? 0n}
        onSuccess={() => refetchBalance()}
      />
    </>
  );
}

function TransferForm({
  contract,
  decimals,
  symbol,
  balance,
  onSuccess,
}: {
  contract: Address;
  decimals: number;
  symbol: string;
  balance: bigint;
  onSuccess: () => void;
}) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const { data: hash, error, isPending, writeContract, reset } =
    useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Refetch balance once the tx confirms.
  useEffect(() => {
    if (isSuccess) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  // Validate inputs before allowing submit. parseUnits can throw on junk input.
  const validation = useMemo(() => {
    if (!to && !amount) return { ok: false, msg: "" };
    if (!isAddress(to)) return { ok: false, msg: "Enter a valid recipient address." };
    let parsed: bigint;
    try {
      parsed = parseUnits(amount || "0", decimals);
    } catch {
      return { ok: false, msg: "Enter a valid amount." };
    }
    if (parsed <= 0n) return { ok: false, msg: "Amount must be greater than 0." };
    if (parsed > balance)
      return { ok: false, msg: "Amount exceeds your balance." };
    return { ok: true, msg: "", parsed };
  }, [to, amount, decimals, balance]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validation.ok || validation.parsed === undefined) return;
    reset();
    writeContract({
      address: contract,
      abi: RXS_ABI,
      functionName: "transfer",
      args: [to as Address, validation.parsed],
    });
  }

  return (
    <div className="card">
      <h2>Send {symbol}</h2>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Recipient address</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="0x…"
            spellCheck={false}
          />
        </label>
        <label className="field">
          <span>Amount ({symbol})</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value.trim())}
            placeholder="0.0"
            inputMode="decimal"
          />
        </label>

        <button
          className="primary"
          type="submit"
          disabled={!validation.ok || isPending || isConfirming}
        >
          {isPending
            ? "Confirm in wallet…"
            : isConfirming
              ? "Sending…"
              : `Send ${symbol}`}
        </button>
      </form>

      {validation.msg && to && amount && (
        <div className="note error">{validation.msg}</div>
      )}
      {isSuccess && <div className="note success">Transfer confirmed.</div>}
      {error && (
        <div className="note error">
          {(error as { shortMessage?: string }).shortMessage || "Transaction failed."}
        </div>
      )}
    </div>
  );
}
