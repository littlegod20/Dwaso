import { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Card } from '@/components/common/card';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { ScreenContainer } from '@/components/common/screen-container';
import { SyncIndicator } from '@/components/common/sync-indicator';
import { CreditorRow } from '@/components/creditors/creditor-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCreditors } from '@/lib/queries/creditors';
import { useSyncNow } from '@/lib/sync/provider';
import { useSyncStore } from '@/stores/sync';
import { useMoney } from '@/utils/format-currency';

type CreditFilter = 'all' | 'overdue' | 'upcoming' | 'clear';

export default function CreditorsScreen() {
  const theme = useTheme();
  const { format } = useMoney();
  const [filter, setFilter] = useState<CreditFilter>('all');

  const syncStatus = useSyncStore((state) => state.status);
  const syncNow = useSyncNow();

  const { data: creditors = [], isLoading } = useCreditors();

  const overdue = useMemo(
    () => creditors.filter((creditor) => creditor.status === 'overdue'),
    [creditors],
  );
  const overdueTotalMinor = useMemo(
    () => overdue.reduce((sum, creditor) => sum + creditor.balanceMinor, 0),
    [overdue],
  );

  const visible = useMemo(
    () =>
      filter === 'all' ? creditors : creditors.filter((creditor) => creditor.status === filter),
    [creditors, filter],
  );

  const addButton = (
    <Pressable
      onPress={() => router.push('/add-creditor')}
      style={[
        styles.addButton,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <Feather name="plus" size={20} color={theme.primary} />
    </Pressable>
  );

  if (!creditors.length && !isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <ThemedText type="subtitle">Creditors</ThemedText>
          {addButton}
        </View>
        <EmptyState
          icon="users"
          title="No debtors yet"
          description="Credit sales you record show up here, with balances and due dates tracked automatically."
          actionLabel="Add creditor"
          onActionPress={() => router.push('/add-creditor')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={syncStatus === 'syncing'}
          onRefresh={syncNow}
          tintColor={theme.primary}
        />
      }
    >
      <View style={styles.header}>
        <ThemedText type="subtitle">Creditors</ThemedText>
        {addButton}
      </View>

      <SyncIndicator />

      {overdue.length ? (
        <Card borderColor={theme.danger} style={{ backgroundColor: theme.dangerBg }}>
          <ThemedText type="small" themeColor="textSecondary">
            Total overdue
          </ThemedText>
          <ThemedText type="title" themeColor="danger" style={styles.overdueAmount}>
            {format(overdueTotalMinor)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {overdue.length} customer{overdue.length === 1 ? '' : 's'} past due date
          </ThemedText>
        </Card>
      ) : null}

      <View style={styles.chipRow}>
        <FilterChip
          label={`All · ${creditors.length}`}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterChip
          label={`Overdue · ${overdue.length}`}
          active={filter === 'overdue'}
          onPress={() => setFilter('overdue')}
        />
        <FilterChip
          label="Upcoming"
          active={filter === 'upcoming'}
          onPress={() => setFilter('upcoming')}
        />
        <FilterChip
          label="Settled"
          active={filter === 'clear'}
          onPress={() => setFilter('clear')}
        />
      </View>

      <View style={styles.list}>
        {visible.map((creditor) => (
          <CreditorRow key={creditor.id} creditor={creditor} />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  overdueAmount: {
    fontSize: 34,
    lineHeight: 40,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  list: {
    gap: Spacing.one,
  },
});
