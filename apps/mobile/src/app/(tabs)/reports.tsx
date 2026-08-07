import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/common/card';
import { EmptyState } from '@/components/common/empty-state';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { StatusPill, type StatusPillVariant } from '@/components/common/status-pill';
import { SyncIndicator } from '@/components/common/sync-indicator';
import { RevenueCostChart } from '@/components/reports/revenue-cost-chart';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReconciliation, useReport, type ReportPeriod } from '@/lib/queries/reports';
import { useSyncNow } from '@/lib/sync/provider';
import { useSyncStore } from '@/stores/sync';
import { useMoney } from '@/utils/format-currency';
import { marginPercent } from '@dwaso/domain';

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export default function ReportsScreen() {
  const theme = useTheme();
  const { format } = useMoney();
  const [period, setPeriod] = useState<ReportPeriod>('weekly');

  const syncStatus = useSyncStore((state) => state.status);
  const syncNow = useSyncNow();

  const { data: report } = useReport(period);
  const { data: reconciliation = [] } = useReconciliation();

  const hasSales = Boolean(report && report.totalRevenueMinor > 0);

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={syncStatus === 'syncing'}
          onRefresh={syncNow}
          tintColor={theme.primary}
        />
      }>
      <ThemedText type="subtitle" style={styles.heading}>
        Reports
      </ThemedText>

      <SyncIndicator />

      <View style={[styles.periodRow, { backgroundColor: theme.backgroundElement }]}>
        {PERIODS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setPeriod(option.id)}
            style={[
              styles.periodSegment,
              option.id === period && { backgroundColor: theme.primary },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: option.id === period ? theme.primaryText : theme.textSecondary }}>
              {option.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {hasSales && report ? (
        <>
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
              labels={report.labels}
              revenue={report.revenue}
              cost={report.cost}
              revenueColor={theme.primary}
              costColor={theme.textSecondary}
            />
          </Card>

          <View style={styles.statsRow}>
            <StatBox label="Revenue" value={format(report.totalRevenueMinor, { compact: true })} />
            <StatBox label="Cost" value={format(report.totalCostMinor, { compact: true })} />
            <StatBox
              label="Margin"
              value={`${marginPercent(report.totalRevenueMinor, report.totalCostMinor)}%`}
              accent
            />
          </View>
        </>
      ) : (
        <EmptyState
          icon="bar-chart-2"
          title="No sales in this period"
          description="Record a sale and your revenue, cost and margin will appear here."
        />
      )}

      {reconciliation.length ? (
        <View style={styles.section}>
          <SectionHeader title="Stock reconciliation" />
          {reconciliation.map((entry) => {
            const variant: StatusPillVariant =
              entry.delta < 0 ? 'danger' : entry.delta > 0 ? 'warning' : 'success';

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
                <StatusPill
                  label={entry.delta > 0 ? `+${entry.delta}` : `${entry.delta}`}
                  variant={variant}
                />
              </Card>
            );
          })}
        </View>
      ) : null}
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
