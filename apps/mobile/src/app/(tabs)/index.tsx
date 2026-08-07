import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { AlertBanner } from '@/components/common/alert-banner';
import { EmptyState } from '@/components/common/empty-state';
import { QuickActionButton } from '@/components/common/quick-action-button';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { SyncIndicator } from '@/components/common/sync-indicator';
import { ActivityRow } from '@/components/home/activity-row';
import { ProfitCard } from '@/components/home/profit-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDashboard, useRecentActivity } from '@/lib/queries/dashboard';
import { useSyncNow } from '@/lib/sync/provider';
import { useSessionStore } from '@/stores/session';
import { useSyncStore } from '@/stores/sync';
import { useMoney } from '@/utils/format-currency';

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const theme = useTheme();
  const { format } = useMoney();

  const businessName = useSessionStore((state) => state.shop?.name ?? 'Your shop');
  const syncStatus = useSyncStore((state) => state.status);
  const syncNow = useSyncNow();

  const dashboard = useDashboard();
  const activity = useRecentActivity();

  const data = dashboard.data;

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={syncStatus === 'syncing'}
          onRefresh={syncNow}
          tintColor={theme.primary}
        />
      }>
      <View style={styles.header}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            {greeting()}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.businessName}>
            {businessName}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/inventory')}
          style={[styles.headerIcon, { backgroundColor: theme.primary }]}>
          <Feather name="box" size={20} color={theme.primaryText} />
        </Pressable>
      </View>

      <SyncIndicator />

      <ProfitCard
        profitMinor={data?.todayProfitMinor ?? 0}
        revenueMinor={data?.todayRevenueMinor ?? 0}
        costMinor={data?.todayCostMinor ?? 0}
        percentVsYesterday={data?.percentVsYesterday ?? null}
      />

      {data && data.lowStockCount > 0 ? (
        <AlertBanner
          icon="alert-triangle"
          variant="warning"
          title={`${data.lowStockCount} product${data.lowStockCount === 1 ? '' : 's'} running low`}
          subtitle={
            data.lowStockCount > data.lowStockPreview.length
              ? `${data.lowStockPreview.join(', ')} +${data.lowStockCount - data.lowStockPreview.length} more`
              : data.lowStockPreview.join(', ')
          }
          onPress={() => router.push('/inventory')}
        />
      ) : null}

      {data && data.overdueCount > 0 ? (
        <AlertBanner
          icon="users"
          variant="danger"
          title={`${format(data.overdueTotalMinor)} overdue`}
          subtitle={`${data.overdueCount} customer${data.overdueCount === 1 ? '' : 's'} past due date`}
          onPress={() => router.push('/creditors')}
        />
      ) : null}

      <View style={styles.quickActions}>
        <QuickActionButton
          icon="camera"
          label="Scan"
          highlighted
          onPress={() => router.push('/scan')}
        />
        <QuickActionButton
          icon="plus"
          label="Add product"
          onPress={() => router.push('/add-product')}
        />
        <QuickActionButton
          icon="user-plus"
          label="Add creditor"
          onPress={() => router.push('/add-creditor')}
        />
        <QuickActionButton
          icon="map-pin"
          label="Suppliers"
          onPress={() => router.push('/suppliers')}
        />
      </View>

      <View style={styles.activitySection}>
        <SectionHeader title="Recent activity" />
        {activity.data?.length ? (
          activity.data.map((entry) => <ActivityRow key={entry.id} entry={entry} />)
        ) : (
          <EmptyState
            icon="activity"
            title="Nothing yet today"
            description="Sales, restocks and payments show up here as you record them."
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: Spacing.two,
  },
  businessName: {
    fontSize: 24,
    lineHeight: 30,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  activitySection: {
    gap: Spacing.one,
  },
});
