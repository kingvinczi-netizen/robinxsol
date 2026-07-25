"use client";

/**
 * The round's fuse. An SVG arc that burns down from full circle to empty
 * over the round window, shifting amber -> red in the final 10 seconds.
 * A flat number can't carry urgency; a depleting ring can.
 */
export function CountdownRing({
  seconds,
  totalSeconds,
  size = 220,
}: {
  seconds: number | undefined;
  totalSeconds: number;
  size?: number;
}) {
  const strokeWidth = Math.max(8, Math.round(size * 0.055));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped =
    seconds === undefined ? totalSeconds : Math.max(0, Math.min(seconds, totalSeconds));
  const fraction = totalSeconds > 0 ? clamped / totalSeconds : 0;
  const offset = circumference * (1 - fraction);
  const critical = seconds !== undefined && seconds <= 10;

  return (
    <div className={`ring${critical ? " critical" : ""}`} style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="ring-fuse"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={critical ? "var(--down)" : "var(--amber)"}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="ring-number" style={{ fontSize: size * 0.22 }}>
        {seconds ?? "…"}
      </span>
    </div>
  );
}
