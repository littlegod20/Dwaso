import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertBanner } from '@/components/common/alert-banner';
import { AppButton } from '@/components/common/app-button';
import { OnboardingNav } from '@/components/onboarding/onboarding-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSessionStore } from '@/stores/session';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { phone, devCode } = useLocalSearchParams<{ phone: string; devCode?: string }>();

  const verifyOtp = useSessionStore((state) => state.verifyOtp);
  const requestOtp = useSessionStore((state) => state.requestOtp);

  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(30);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1_000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const submit = async (value: string) => {
    setPending(true);
    setError(null);

    try {
      await verifyOtp(phone, value);
      // The auth gate takes it from here: it sends the trader to business setup
      // or to the app depending on whether she already has a shop.
    } catch (cause) {
      setCode('');
      setError(cause instanceof Error ? cause.message : 'That code did not work');
    } finally {
      setPending(false);
    }
  };

  const onChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digits);
    // Submitting on the last digit removes a tap from a flow the trader is
    // already impatient with.
    if (digits.length === CODE_LENGTH) void submit(digits);
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
      ]}
    >
      <OnboardingNav onBack={() => router.back()} />

      <View style={styles.body}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.headline}>
            Enter the code
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary">
            We sent a {CODE_LENGTH}-digit code to {phone}.
          </ThemedText>
        </View>

        <TextInput
          value={code}
          onChangeText={onChange}
          placeholder="000000"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          autoFocus
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />

        {/* Only ever populated when the API is running without an SMS provider,
            so a developer can sign in without an SMS bill. */}
        {devCode ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
            Development code: {devCode}
          </ThemedText>
        ) : null}

        {error ? (
          <AlertBanner icon="alert-circle" variant="danger" title="Try again" subtitle={error} />
        ) : null}
      </View>

      {pending ? (
        <ActivityIndicator color={theme.primary} />
      ) : (
        <AppButton
          label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          variant="secondary"
          disabled={resendIn > 0}
          onPress={() => {
            setResendIn(30);
            void requestOtp(phone);
          }}
        />
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
  input: {
    height: 64,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 28,
    letterSpacing: 12,
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
  },
});
