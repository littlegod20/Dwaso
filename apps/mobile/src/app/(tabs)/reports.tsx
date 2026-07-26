import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/common/card';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { StatusPill, type StatusPillVariant } from '@/components/common/status-pill';
import { RevenueCostChart } from '@/components/reports/revenue-cost-chart';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { stockReconciliation, totalCost, totalRevenue, weeklyReport } from '@/mock-data/reports';
import { calculateMargin } from '@/utils/margin';
import { formatCurrency } from '@/utils/format-currency';

const PERIODS = ['Daily', 'Weekly', 'Monthly'] as const;
const ACTIVE_PERIOD = 'Weekly';

export default function ReportsScreen() {
  const theme = useTheme();
  const margin = calculateMargin(totalCost, totalRevenue);

  return (
    <ScreenContainer>
      <ThemedText type="subtitle" style={styles.heading}>
        Reports
      </ThemedText>

      {/* TODO: wire up period toggle — Weekly data is shown by default for now */}
      <View style={[styles.periodRow, { backgroundColor: theme.backgroundElement }]}>
        {PERIODS.map((period) => (
          <View
            key={period}
            style={[
              styles.periodSegment,
              period === ACTIVE_PERIOD && { backgroundColor: theme.primary },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: period === ACTIVE_PERIOD ? theme.primaryText : theme.textSecondary }}>
              {period}
            </ThemedText>
          </View>
        ))}
      </View>

      <Card>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Revenue
            </ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.textSecondary }]} />
            <ThemedText type="small" themeColor="textSecondary">
              Cost
            </ThemedText>
          </View>
        </View>
        <RevenueCostChart
          labels={weeklyReport.labels}
          revenue={weeklyReport.revenue}
          cost={weeklyReport.cost}
          revenueColor={theme.primary}
          costColor={theme.textSecondary}
        />
      </Card>

      <View style={styles.statsRow}>
        <StatBox label="Revenue" value={formatCurrency(totalRevenue)} />
        <StatBox label="Cost" value={formatCurrency(totalCost)} />
        <StatBox label="Margin" value={`${margin}%`} accent />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Stock reconciliation" />
        {stockReconciliation.map((entry) => {
          const delta = entry.counted - entry.expected;
          const variant: StatusPillVariant = delta < 0 ? 'danger' : delta > 0 ? 'warning' : 'success';
          const deltaLabel = delta > 0 ? `+${delta}` : `${delta}`;

          return (
            <Card key={entry.id} style={styles.reconciliationRow}>
              <View>
                <ThemedText type="default" style={styles.reconciliationTitle}>
                  {entry.productName}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Expected {entry.expected} · Counted {entry.counted}
                </ThemedText>
              </View>
              <StatusPill label={deltaLabel} variant={variant} />
            </Card>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.statBox, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="default" themeColor={accent ? 'primary' : 'text'} style={styles.statValue}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    paddingTop: Spacing.two,
  },
  periodRow: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: 4,
    gap: 4,
  },
  periodSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statBox: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    gap: 4,
  },
  statValue: {
    fontWeight: '700',
    fontSize: 15,
  },
  section: {
    gap: Spacing.two,
  },
  reconciliationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reconciliationTitle: {
    fontWeight: '700',
  },
});
