import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/common/card';
import { StatusPill } from '@/components/common/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatCurrency } from '@/utils/format-currency';

type ProfitCardProps = {
  profit: number;
  revenue: number;
  cost: number;
  percentVsYesterday: number;
};

export function ProfitCard({ profit, revenue, cost, percentVsYesterday }: ProfitCardProps) {
  const isPositive = percentVsYesterday >= 0;

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        Today&apos;s profit
      </ThemedText>
      <ThemedText type="title" style={styles.profit}>
        {formatCurrency(profit)}
      </ThemedText>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Revenue <ThemedText type="smallBold">{formatCurrency(revenue)}</ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Cost <ThemedText type="smallBold">{formatCurrency(cost)}</ThemedText>
        </ThemedText>
      </View>

      <StatusPill
        variant={isPositive ? 'success' : 'danger'}
        label={`${isPositive ? '↗' : '↘'} ${isPositive ? '+' : ''}${percentVsYesterday}% vs yesterday`}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  profit: {
    fontSize: 36,
    lineHeight: 42,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.four,
    marginBottom: Spacing.three,
  },
});
