import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/common/card';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { ScreenContainer } from '@/components/common/screen-container';
import { CreditorRow } from '@/components/creditors/creditor-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { creditors } from '@/mock-data/creditors';
import { formatCurrency } from '@/utils/format-currency';

const TOTAL_COUNT = creditors.length;
const OVERDUE_CREDITORS = creditors.filter((creditor) => creditor.status === 'overdue');
const TOTAL_OVERDUE = OVERDUE_CREDITORS.reduce((sum, creditor) => sum + creditor.balance, 0);

export default function CreditorsScreen() {
  const theme = useTheme();

  if (creditors.length === 0) {
    return (
      <ScreenContainer>
        <View style={styles.header}>
          <ThemedText type="subtitle">Creditors</ThemedText>
        </View>
        <EmptyState
          icon="users"
          title="No debtors yet"
          description="Credit sales you record will show up here, with balances and due dates tracked automatically."
          actionLabel="Add creditor"
          onActionPress={() => router.push('/add-creditor')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="subtitle">Creditors</ThemedText>
        <Pressable
          onPress={() => router.push('/add-creditor')}
          style={[
            styles.addButton,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Feather name="plus" size={20} color={theme.primary} />
        </Pressable>
      </View>

      <Card borderColor={theme.danger} style={{ backgroundColor: theme.dangerBg }}>
        <ThemedText type="small" themeColor="textSecondary">
          Total overdue
        </ThemedText>
        <ThemedText type="title" themeColor="danger" style={styles.overdueAmount}>
          {formatCurrency(TOTAL_OVERDUE)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {OVERDUE_CREDITORS.length} customers past due date
        </ThemedText>
      </Card>

      {/* TODO: wire up filter state — chips are presentational only for now */}
      <View style={styles.chipRow}>
        <FilterChip label={`All · ${TOTAL_COUNT}`} active />
        <FilterChip label={`Overdue · ${OVERDUE_CREDITORS.length}`} />
        <FilterChip label="Upcoming" />
      </View>

      <View style={styles.list}>
        {creditors.map((creditor) => (
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
