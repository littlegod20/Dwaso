import { StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type RevenueCostChartProps = {
  labels: string[];
  revenue: number[];
  cost: number[];
  revenueColor: string;
  costColor: string;
  width?: number;
  height?: number;
};

function toPolylinePoints(
  data: number[],
  min: number,
  range: number,
  width: number,
  height: number,
) {
  const paddingY = 8;
  return data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - paddingY - ((value - min) / range) * (height - paddingY * 2);
      return `${x},${y}`;
    })
    .join(' ');
}

export function RevenueCostChart({
  labels,
  revenue,
  cost,
  revenueColor,
  costColor,
  width = 296,
  height = 140,
}: RevenueCostChartProps) {
  const allValues = [...revenue, ...cost];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;

  return (
    <View>
      <Svg width={width} height={height}>
        <Polyline
          points={toPolylinePoints(cost, min, range, width, height)}
          fill="none"
          stroke={costColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polyline
          points={toPolylinePoints(revenue, min, range, width, height)}
          fill="none"
          stroke={revenueColor}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={[styles.labelRow, { width }]}>
        {labels.map((label) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.label}>
            {label}
          </ThemedText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  label: {
    fontSize: 11,
  },
});
