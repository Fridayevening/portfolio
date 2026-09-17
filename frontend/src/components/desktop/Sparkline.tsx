// The 36px avatar-slot sparkline — where email shows a face, market shows the
// price itself. Shared by the alert toast and the market window's symbol rows.

export default function Sparkline({ hist, up }: { hist: number[]; up: boolean }) {
  const color = up ? "#008000" : "#c02020";
  const min = Math.min(...hist);
  const max = Math.max(...hist);
  const span = max - min;
  const x = (i: number) => 2 + (i / Math.max(1, hist.length - 1)) * 32;
  const y = (v: number) => (span ? 33 - ((v - min) / span) * 30 : 18);
  return (
    <svg
      viewBox="0 0 36 36"
      className="h-[36px] w-[36px] shrink-0 border border-[#808080] bg-white"
      aria-hidden
    >
      <polyline
        points={hist.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.3"
      />
      {/* End-point square: the trading-terminal "last price" marker. */}
      <rect x={x(hist.length - 1) - 1.5} y={y(hist[hist.length - 1]) - 1.5} width="3" height="3" fill={color} />
    </svg>
  );
}
