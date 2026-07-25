"use client";

/** A scrolling price tape across the top of every game page — the persistent reminder this is a live market, not a static form. */
export function PriceTicker({ price }: { price: string | undefined }) {
  const item = (
    <span className="ticker-item">
      <span className="live-dot" />
      BTC/USD <strong>{price ?? "…"}</strong> · LIVE MARKET DATA VIA PYTH NETWORK
    </span>
  );

  return (
    <div className="ticker">
      <div className="ticker-track">
        {item}
        {item}
        {item}
        {item}
        {item}
        {item}
      </div>
    </div>
  );
}
