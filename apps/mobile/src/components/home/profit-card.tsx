import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/common/card';
import { StatusPill } from '@/components/common/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useMoney } from '@/utils/format-currency';

type ProfitCardProps = {
  profitMinor: number;
  revenueMinor: number;
  costMinor: number;
  /** Null on the trader's first day, when there is no baseline to compare to. */
  percentVsYesterday: number | null;
};

export function ProfitCard({
  profitMinor,
  revenueMinor,
  costMinor,
  percentVsYesterday,
}: ProfitCardProps) {
  const { format } = useMoney();
  const isPositive = (percentVsYesterday ?? 0) >= 0;

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">
        Today&apos;s profit
      </ThemedText>
      <ThemedText type="title" style={styles.profit}>
        {format(profitMinor)}
      </ThemedText>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary">
          Revenue <ThemedText type="smallBold">{format(revenueMinor)}</ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Cost <ThemedText type="smallBold">{format(costMinor)}</ThemedText>
        </ThemedText>
      </View>

      {percentVsYesterday === null ? (
        <StatusPill variant="neutral" label="No sales yesterday to compare" />
      ) : (
        <StatusPill
          variant={isPositive ? 'success' : 'danger'}
          label={`${isPositive ? '↗' : '↘'} ${isPositive ? '+' : ''}${percentVsYesterday}% vs yesterday`}
        />
      )}
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
