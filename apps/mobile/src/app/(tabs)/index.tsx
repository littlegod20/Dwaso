import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AlertBanner } from '@/components/common/alert-banner';
import { QuickActionButton } from '@/components/common/quick-action-button';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { ActivityRow } from '@/components/home/activity-row';
import { ProfitCard } from '@/components/home/profit-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { recentActivity } from '@/mock-data/activity';
import { formatCurrency } from '@/utils/format-currency';

const BUSINESS_NAME = "Amaka's Provisions";
const LOW_STOCK_COUNT = 6;
const LOW_STOCK_PREVIEW = 'Rice, Sugar, Milo +3 more';
const OVERDUE_TOTAL = 824.0;
const OVERDUE_CUSTOMERS = 3;

export default function HomeScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            Good afternoon
          </ThemedText>
          <ThemedText type="subtitle" style={styles.businessName}>
            {BUSINESS_NAME}
          </ThemedText>
        </View>
        <Pressable
          onPress={() => router.push('/inventory')}
          style={[styles.headerIcon, { backgroundColor: theme.primary }]}>
          <Feather name="box" size={20} color={theme.primaryText} />
        </Pressable>
      </View>

      <ProfitCard profit={112} revenue={326} cost={214} percentVsYesterday={12} />

      <AlertBanner
        icon="alert-triangle"
        variant="warning"
        title={`${LOW_STOCK_COUNT} products running low`}
        subtitle={LOW_STOCK_PREVIEW}
        onPress={() => router.push('/inventory')}
      />
      <AlertBanner
        icon="users"
        variant="danger"
        title={`${formatCurrency(OVERDUE_TOTAL)} overdue`}
        subtitle={`${OVERDUE_CUSTOMERS} customers past due date`}
        onPress={() => router.push('/creditors')}
      />

      <View style={styles.quickActions}>
        <QuickActionButton icon="camera" label="Scan" highlighted onPress={() => router.push('/scan')} />
        {/* TODO: wire up navigation once a dedicated Add Product screen is designed */}
        <QuickActionButton icon="plus" label="Add product" />
        <QuickActionButton
          icon="user-plus"
          label="Add creditor"
          onPress={() => router.push('/add-creditor')}
        />
        <QuickActionButton icon="map-pin" label="Suppliers" onPress={() => router.push('/suppliers')} />
      </View>

      <View style={styles.activitySection}>
        <SectionHeader title="Recent activity" />
        {recentActivity.map((entry) => (
          <ActivityRow key={entry.id} entry={entry} />
        ))}
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
