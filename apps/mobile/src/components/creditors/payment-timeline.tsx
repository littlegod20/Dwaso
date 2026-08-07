import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LedgerHistoryEntry } from '@/lib/queries/creditors';
import { useMoney } from '@/utils/format-currency';
import { relativeTime } from '@/utils/relative-time';

type PaymentTimelineProps = {
  history: LedgerHistoryEntry[];
};

const LABELS: Record<LedgerHistoryEntry['kind'], string> = {
  credit_sale: 'Bought on credit',
  payment: 'Payment received',
  adjustment: 'Balance adjusted',
  write_off: 'Written off',
};

export function PaymentTimeline({ history }: PaymentTimelineProps) {
  const theme = useTheme();
  const { format } = useMoney();

  return (
    <View>
      {history.map((entry, index) => {
        // A positive amount increases the debt, a negative one reduces it, so
        // the sign alone decides the colour — no separate type flag to fall out
        // of step with the number.
        const increasesDebt = entry.amountMinor > 0;
        const isLast = index === history.length - 1;

        return (
          <View key={entry.id} style={styles.row}>
            <View style={styles.rail}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: increasesDebt ? theme.danger : theme.success },
                ]}
              />
              {!isLast && <View style={[styles.line, { backgroundColor: theme.border }]} />}
            </View>
            <View style={styles.content}>
              <ThemedText type="default" style={styles.title}>
                {entry.note || LABELS[entry.kind]}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {relativeTime(entry.occurredAt)}
              </ThemedText>
              <ThemedText
                type="smallBold"
                themeColor={increasesDebt ? 'danger' : 'success'}
                style={styles.amount}>
                {format(entry.amountMinor, { showSign: true })}
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
