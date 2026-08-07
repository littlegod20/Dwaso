import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { FilterChip } from '@/components/common/filter-chip';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSessionStore } from '@/stores/session';
import type { Currency } from '@dwaso/shared-types';

const CURRENCIES = [
  { code: 'GHS', label: '₵ GHS' },
  { code: 'NGN', label: '₦ NGN' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' },
] as const;

/**
 * The last step before the app is usable, and the point at which a shop exists.
 *
 * Currency is chosen once here and never again: it applies to every figure in
 * the product, and letting it vary per transaction would make every total and
 * margin in the ledger meaningless.
 */
export default function OnboardingBusinessSetupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const completeSetup = useSessionStore((state) => state.completeSetup);

  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<Currency>('GHS');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);

    try {
      await completeSetup({ name: name.trim(), currency });
      // The auth gate redirects into the tabs once the session reports a shop.
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not set up your shop');
    } finally {
      setPending(false);
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.four, paddingBottom: insets.bottom + Spacing.three },
      ]}>
      <View style={styles.header}>
        <ThemedText type="title" style={styles.headline}>
          Set up your shop
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          This is how your business and its currency will show up across the app.
        </ThemedText>
      </View>

      <View style={styles.form}>
        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Business name
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Amaka's Provisions"
            placeholderTextColor={theme.textSecondary}
            autoFocus
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Currency
          </ThemedText>
          <View style={styles.currencyRow}>
            {CURRENCIES.map((option) => (
              <FilterChip
                key={option.code}
                label={option.label}
                active={option.code === currency}
                onPress={() => setCurrency(option.code)}
              />
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            You can&apos;t change this later, so pick the currency you actually sell in.
          </ThemedText>
        </View>

        {error ? (
          <AlertBanner icon="alert-circle" variant="danger" title="Setup failed" subtitle={error} />
        ) : null}
      </View>

      {pending ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <AppButton label="Finish setup" onPress={submit} disabled={name.trim().length === 0} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
  },
  form: {
    flex: 1,
    gap: Spacing.four,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
