import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCameraPermissions } from 'expo-camera';
import * as Notifications from 'expo-notifications';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { OnboardingNav } from '@/components/onboarding/onboarding-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Only two permissions are asked for here, and neither is contacts.
 *
 * Reading the whole address book to add one debtor would mean holding data about
 * dozens of people who never agreed to be in this app. That import is a single
 * system picker on the add-creditor screen instead, which needs no standing
 * permission at all.
 */
const PERMISSIONS = [
  {
    id: 'camera',
    icon: 'camera',
    title: 'Camera access',
    description: 'Scan products to log a sale or restock without typing.',
  },
  {
    id: 'notifications',
    icon: 'bell',
    title: 'Stock alerts',
    description: 'One message when something is about to run out. Nothing else.',
  },
] as const;

type PermissionId = (typeof PERMISSIONS)[number]['id'];

export default function OnboardingPermissionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [, requestCamera] = useCameraPermissions();
  const [granted, setGranted] = useState<PermissionId[]>([]);

  const request = async (id: PermissionId) => {
    const result =
      id === 'camera' ? await requestCamera() : await Notifications.requestPermissionsAsync();

    if (result?.granted) {
      setGranted((current) => [...current, id]);
    }
  };

  return (
    <ThemedView
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.three },
      ]}>
      <OnboardingNav onBack={() => router.back()} onSkip={() => router.push('/onboarding/sign-in')} />

      <View style={styles.header}>
        <ThemedText type="title" style={styles.headline}>
          Before we start
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.subtext}>
          A couple of permissions make scanning and adding creditors much faster.
        </ThemedText>
      </View>

      <View style={styles.list}>
        {PERMISSIONS.map((permission) => {
          const allowed = granted.includes(permission.id);

          return (
            <View
              key={permission.id}
              style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
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
              <Pressable
                onPress={() => request(permission.id)}
                disabled={allowed}
                style={[
                  styles.allowButton,
                  { borderColor: allowed ? theme.success : theme.border },
                ]}>
                <ThemedText type="smallBold" themeColor={allowed ? 'success' : 'primary'}>
                  {allowed ? 'Allowed' : 'Allow'}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          You can change these anytime in Settings.
        </ThemedText>
        <AppButton label="Continue" onPress={() => router.push('/onboarding/sign-in')} />
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
