import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { PaymentTimeline } from '@/components/creditors/payment-timeline';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest } from '@/lib/api/client';
import { useCreditor, useCreditorHistory } from '@/lib/queries/creditors';
import { useMoney } from '@/utils/format-currency';
import { getCreditorStatusMeta } from '@/utils/creditor-status';
import { formatDueDate } from '@/utils/relative-time';

export default function CreditorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { format } = useMoney();

  const { data: creditor, isLoading } = useCreditor(id);
  const { data: history = [] } = useCreditorHistory(id);

  const [notice, setNotice] = useState<{ tone: 'warning' | 'danger'; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  if (!creditor) {
    return (
      <ScreenContainer>
        <PageHeader title="Creditor detail" />
        <ThemedText themeColor="textSecondary">
          {isLoading ? 'Loading…' : 'Creditor not found.'}
        </ThemedText>
      </ScreenContainer>
    );
  }

  const status = getCreditorStatusMeta(creditor);
  const cardColor = status.variant === 'neutral' ? theme.border : theme[status.variant];
  const cardBg = status.variant === 'neutral' ? theme.card : theme[`${status.variant}Bg`];

  const dueLine =
    creditor.status === 'overdue'
      ? `${status.label} · was due ${formatDueDate(creditor.dueDate)}`
      : creditor.status === 'upcoming' && creditor.dueDate
        ? `${status.label} · due ${formatDueDate(creditor.dueDate)}`
        : status.label;

  /**
   * Sending a reminder is the one action here that needs the network, because it
   * queues a message on the server rather than writing to the local ledger. It
   * is the exception that proves the offline rule: nothing about recording money
   * requires signal, only reaching out to another person does.
   */
  const sendReminder = async () => {
    setSending(true);
    setNotice(null);

    try {
      await apiRequest('/reminders/send', {
        method: 'POST',
        body: { creditorId: creditor.id, channel: 'whatsapp' },
      });
      setNotice({ tone: 'warning', text: `A reminder is on its way to ${creditor.name}.` });
    } catch (cause) {
      setNotice({
        tone: 'danger',
        text: cause instanceof Error ? cause.message : 'Could not send the reminder',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenContainer>
      <PageHeader title={creditor.name} />

      <Card borderColor={cardColor} style={{ backgroundColor: cardBg }}>
        <ThemedText type="small" themeColor="textSecondary">
          Balance owed
        </ThemedText>
        <ThemedText type="title" style={styles.balance}>
          {format(creditor.balanceMinor)}
        </ThemedText>
        <ThemedText
          type="smallBold"
          themeColor={status.variant === 'neutral' ? 'textSecondary' : status.variant}>
          {dueLine}
        </ThemedText>
        {creditor.phone ? (
          <>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />
            <View style={styles.phoneRow}>
              <Feather name="phone" size={16} color={theme.text} />
              <ThemedText type="default">{creditor.phone}</ThemedText>
            </View>
          </>
        ) : null}
      </Card>

      {notice ? (
        <AlertBanner
          icon={notice.tone === 'danger' ? 'alert-circle' : 'check-circle'}
          variant={notice.tone}
          title={notice.tone === 'danger' ? 'Reminder not sent' : 'Reminder queued'}
          subtitle={notice.text}
        />
      ) : null}

      {creditor.remindersOptedOut ? (
        <AlertBanner
          icon="bell-off"
          variant="warning"
          title="Reminders turned off"
          subtitle="This customer asked not to be contacted, so no reminders will be sent."
        />
      ) : (
        <AppButton
          label={sending ? 'Sending…' : 'Send reminder'}
          icon="bell"
          disabled={sending || !creditor.phone || creditor.balanceMinor <= 0}
          onPress={sendReminder}
        />
      )}

      <AppButton
        label="Record payment"
        variant="secondary"
        disabled={creditor.balanceMinor <= 0}
        onPress={() =>
          router.push({ pathname: '/record-payment', params: { creditorId: creditor.id } })
        }
      />

      <AppButton
        label="Reminder schedule"
        icon="clock"
        variant="secondary"
        onPress={() =>
          router.push({ pathname: '/reminder-schedule', params: { creditorId: creditor.id } })
        }
      />

      <View style={styles.section}>
        <SectionHeader title="Payment history" />
        {history.length ? (
          <PaymentTimeline history={history} />
        ) : (
          <EmptyState
            icon="clock"
            title="Nothing recorded yet"
            description="Credit sales and payments for this customer will appear here."
          />
        )}
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
