import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PaymentHistoryEntry } from '@/mock-data/creditors';
import { formatCurrency } from '@/utils/format-currency';

type PaymentTimelineProps = {
  history: PaymentHistoryEntry[];
};

export function PaymentTimeline({ history }: PaymentTimelineProps) {
  const theme = useTheme();

  return (
    <View>
      {history.map((entry, index) => {
        const isSale = entry.type === 'sale';
        const dotColor = isSale ? theme.danger : theme.success;
        const isLast = index === history.length - 1;

        return (
          <View key={entry.id} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
              {!isLast && <View style={[styles.line, { backgroundColor: theme.border }]} />}
            </View>
            <View style={styles.content}>
              <ThemedText type="default" style={styles.title}>
                {entry.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entry.date}
              </ThemedText>
              <ThemedText
                type="smallBold"
                themeColor={isSale ? 'danger' : 'success'}
                style={styles.amount}>
                {entry.amount >= 0 ? '+' : ''}
                {formatCurrency(entry.amount)}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rail: {
    alignItems: 'center',
    width: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  line: {
    flex: 1,
    width: StyleSheet.hairlineWidth * 2,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingBottom: Spacing.three,
    gap: 2,
  },
  title: {
    fontWeight: '700',
  },
  amount: {
    marginTop: 2,
  },
});
