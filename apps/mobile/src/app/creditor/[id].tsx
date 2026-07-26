import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { PaymentTimeline } from '@/components/creditors/payment-timeline';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCreditorById } from '@/mock-data/creditors';
import { formatCurrency } from '@/utils/format-currency';
import { getCreditorStatusMeta } from '@/utils/creditor-status';

export default function CreditorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const creditor = getCreditorById(id ?? '');

  if (!creditor) {
    return (
      <ScreenContainer>
        <PageHeader title="Creditor detail" />
        <ThemedText themeColor="textSecondary">Creditor not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const status = getCreditorStatusMeta(creditor);
  const cardColor = status.variant === 'neutral' ? theme.border : theme[status.variant];
  const cardBg = status.variant === 'neutral' ? theme.card : theme[`${status.variant}Bg`];
  const dueLine =
    creditor.status === 'overdue'
      ? `${status.label} · was due ${creditor.dueDate}`
      : creditor.status === 'upcoming'
        ? `${status.label} · due ${creditor.dueDate}`
        : status.label;

  return (
    <ScreenContainer>
      {/* TODO: wire up "..." menu (edit, delete, etc.) once defined */}
      <PageHeader title={creditor.name} rightIcon="more-horizontal" />

      <Card borderColor={cardColor} style={{ backgroundColor: cardBg }}>
        <ThemedText type="small" themeColor="textSecondary">
          Balance owed
        </ThemedText>
        <ThemedText type="title" style={styles.balance}>
          {formatCurrency(creditor.balance)}
        </ThemedText>
        <ThemedText type="smallBold" themeColor={status.variant === 'neutral' ? 'textSecondary' : status.variant}>
          {dueLine}
        </ThemedText>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.phoneRow}>
          <Feather name="phone" size={16} color={theme.text} />
          <ThemedText type="default">{creditor.phone}</ThemedText>
        </View>
      </Card>

      <AppButton
        label="Send reminder"
        icon="bell"
        onPress={() => router.push({ pathname: '/reminder-schedule', params: { creditorId: creditor.id } })}
      />
      {/* TODO: build a dedicated Record payment flow — no design reference yet */}
      <AppButton label="Record payment" variant="secondary" />

      <View style={styles.section}>
        <SectionHeader title="Payment history" />
        <PaymentTimeline history={creditor.history} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balance: {
    fontSize: 34,
    lineHeight: 40,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    marginVertical: Spacing.three,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
});
