import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { OnboardingNav } from '@/components/onboarding/onboarding-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSessionStore } from '@/stores/session';

/**
 * Phone number entry.
 *
 * There is no password and no email anywhere in this flow. The target trader
 * runs her business from a phone number, often on a handset she shares, and an
 * email-and-password account would be an obstacle before the app has shown her
 * anything useful.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const requestOtp = useSessionStore((state) => state.requestOtp);

  const [phone, setPhone] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);

    try {
      const response = await requestOtp(phone.trim());
      router.push({
        pathname: '/onboarding/verify',
        params: { phone: phone.trim(), devCode: response.devCode ?? '' },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the code');
    } finally {
      setPending(false);
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
      ]}>
      <OnboardingNav onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headline}>
            What&apos;s your number?
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            We&apos;ll text you a code to sign in. No password to remember.
          </ThemedText>
        </View>

        <View style={styles.field}>
          <ThemedText type="small" themeColor="textSecondary">
            Phone number
          </ThemedText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="024 123 4567"
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            autoFocus
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        {error ? (
          <AlertBanner
            icon="alert-circle"
            variant="danger"
            title="Couldn't send the code"
            subtitle={error}
          />
        ) : null}
      </KeyboardAvoidingView>

      {pending ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <AppButton label="Send code" onPress={submit} disabled={phone.trim().length < 6} />
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
  body: {
    flex: 1,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.two,
  },
  headline: {
    fontSize: 26,
    lineHeight: 32,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    height: 52,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 18,
    letterSpacing: 1,
  },
});
