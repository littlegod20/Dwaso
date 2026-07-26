import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { OnboardingNav } from '@/components/onboarding/onboarding-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PERMISSIONS = [
  {
    id: 'camera',
    icon: 'camera',
    title: 'Camera access',
    description: "Scan products to add or restock inventory instantly.",
  },
  {
    id: 'contacts',
    icon: 'user-plus',
    title: 'Contacts access',
    description: "Quickly add creditors from your phone's address book.",
  },
] as const;

export default function OnboardingPermissionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
      ]}>
      <OnboardingNav onBack={() => router.back()} onSkip={() => router.push('/onboarding/business-setup')} />

      <View style={styles.header}>
        <ThemedText type="title" style={styles.headline}>
          Before we start
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtext}>
          A couple of permissions make scanning and adding creditors much faster.
        </ThemedText>
      </View>

      <View style={styles.list}>
        {/* TODO: wire up real permission requests (expo-camera, expo-contacts) */}
        {PERMISSIONS.map((permission) => (
          <View key={permission.id} style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={[styles.iconBadge, { backgroundColor: theme.warningBg }]}>
              <Feather name={permission.icon} size={22} color={theme.primary} />
            </View>
            <View style={styles.cardText}>
              <ThemedText type="default" style={styles.cardTitle}>
                {permission.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {permission.description}
              </ThemedText>
            </View>
            <Pressable style={[styles.allowButton, { borderColor: theme.border }]}>
              <ThemedText type="smallBold" themeColor="primary">
                Allow
              </ThemedText>
            </Pressable>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          You can change these anytime in Settings.
        </ThemedText>
        <AppButton label="Continue" onPress={() => router.push('/onboarding/business-setup')} />
      </View>
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
  subtext: {},
  list: {
    flex: 1,
    gap: Spacing.three,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontWeight: '700',
  },
  allowButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  footer: {
    gap: Spacing.two,
  },
  footnote: {
    textAlign: 'center',
  },
});
