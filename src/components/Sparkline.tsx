interface Props {
  data: number[];
  height?: number;
}

const LINE_COLOR = "#94a3b8"; // slate-400, de-emphasis hue for the trend line
const ACCENT_COLOR = "#2563eb"; // blue-600, accent for the latest reading

export default function Sparkline({ data, height = 40 }: Props) {
  if (data.length < 2) return null;

  const width = 200;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4; // keep the end-dot ring from clipping at the edges

  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = padding + (1 - (value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const path = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`오늘 추이, 최소 ${min}, 최대 ${max}, 최신값 ${data[data.length - 1]}`}
    >
      <path
        d={path}
        fill="none"
        stroke={LINE_COLOR}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={lastX} cy={lastY} r={4} fill={ACCENT_COLOR} stroke="#ffffff" strokeWidth={2} />
    </svg>
  );
}
