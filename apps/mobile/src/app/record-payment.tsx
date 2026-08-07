import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useCreditor } from '@/lib/queries/creditors';
import { recordPayment, useLocalMutation } from '@/lib/mutations';
import { useMoney } from '@/utils/format-currency';
import { CURRENCY_META } from '@dwaso/domain';

export default function RecordPaymentScreen() {
  const { creditorId } = useLocalSearchParams<{ creditorId: string }>();
  const theme = useTheme();
  const { currency, format, parse, toMajor } = useMoney();

  const { data: creditor } = useCreditor(creditorId);
  const [amount, setAmount] = useState('');

  const save = useLocalMutation((input: { creditorId: string; amountMinor: number }) =>
    recordPayment(input.creditorId, input.amountMinor),
  );

  if (!creditor) {
    return (
      <ScreenContainer>
        <PageHeader title="Record payment" />
        <ThemedText themeColor="textSecondary">Creditor not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const amountMinor = parse(Number(amount) || 0);
  const remaining = creditor.balanceMinor - amountMinor;

  const submit = () => {
    save.mutate({ creditorId: creditor.id, amountMinor }, { onSuccess: () => router.back() });
  };

  return (
    <ScreenContainer>
      <PageHeader title="Record payment" />

      <View style={styles.header}>
        <ThemedText type="default" style={styles.name}>
          {creditor.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Owes {format(creditor.balanceMinor)}
        </ThemedText>
      </View>

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Amount received
        </ThemedText>
        <View style={[styles.input, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText themeColor="primary" style={styles.symbol}>
            {CURRENCY_META[currency].symbol}
          </ThemedText>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            autoFocus
            style={[styles.inputText, { color: theme.text }]}
          />
        </View>
      </View>

      {/* Paying the whole balance is the common case and should not require
          typing a number the app already knows. */}
      <AppButton
        label={`Pay full balance · ${format(creditor.balanceMinor)}`}
        variant="secondary"
        onPress={() => setAmount(toMajor(creditor.balanceMinor).toFixed(2))}
      />

      <Card
        borderColor={remaining <= 0 ? theme.success : theme.primary}
        style={{ backgroundColor: remaining <= 0 ? theme.successBg : theme.warningBg }}>
        <View style={styles.summaryRow}>
          <ThemedText type="default">
            {remaining <= 0 ? 'Settles this account' : 'Remaining after payment'}
          </ThemedText>
          <ThemedText
            type="default"
            themeColor={remaining <= 0 ? 'success' : 'primary'}
            style={styles.summaryValue}>
            {format(Math.max(0, remaining))}
          </ThemedText>
        </View>
      </Card>

      <AppButton
        label={save.isPending ? 'Saving…' : 'Record payment'}
        disabled={amountMinor <= 0 || save.isPending}
        onPress={submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.half,
  },
  name: {
    fontSize: 19,
    fontWeight: '700',
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 64,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  symbol: {
    fontSize: 24,
    fontWeight: '700',
  },
  inputText: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryValue: {
    fontWeight: '700',
  },
});
