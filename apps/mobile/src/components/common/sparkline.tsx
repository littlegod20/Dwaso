import Svg, { Circle, Polyline } from 'react-native-svg';

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color: string;
};

export function Sparkline({ data, width = 280, height = 64, color }: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 8;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - paddingY - ((value - min) / range) * (height - paddingY * 2);
    return [x, y] as const;
  });

  const polylinePoints = points.map(([x, y]) => `${x},${y}`).join(' ');
  const [lastX, lastY] = points[points.length - 1];

  return (
    <Svg width={width} height={height}>
      <Polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={lastX} cy={lastY} r={5} fill={color} />
    </Svg>
  );
}
