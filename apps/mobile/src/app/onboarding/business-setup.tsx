import { router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { FilterChip } from '@/components/common/filter-chip';
import { OnboardingNav } from '@/components/onboarding/onboarding-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const CURRENCIES = [
  { code: 'GHS', label: '₵ GHS' },
  { code: 'NGN', label: '₦ NGN' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: '€ EUR' },
] as const;

// TODO: currency selection and the name input are static for now — wire up
// real form state and persist the choice once this connects to a backend.
const ACTIVE_CURRENCY = 'GHS';

export default function OnboardingBusinessSetupScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
      ]}>
      <OnboardingNav onBack={() => router.back()} />

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
            placeholder="e.g. Amaka's Provisions"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Currency
          </ThemedText>
          <View style={styles.currencyRow}>
            {CURRENCIES.map((currency) => (
              <FilterChip
                key={currency.code}
                label={currency.label}
                active={currency.code === ACTIVE_CURRENCY}
              />
            ))}
          </View>
        </View>
      </View>

      {/* TODO: submit handler — persist business profile once backend exists */}
      <AppButton label="Finish setup" onPress={() => router.replace('/(tabs)')} />
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
