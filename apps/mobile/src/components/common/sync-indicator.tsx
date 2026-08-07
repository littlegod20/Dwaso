import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSyncNow } from '@/lib/sync/provider';
import { useSyncStore } from '@/stores/sync';

/**
 * Tells the trader whether her work has left the device.
 *
 * Deliberately silent when everything is fine and there is nothing pending —
 * a permanent status bar would train her to ignore it, and the one moment it
 * matters is the moment she needs to notice. Being offline is stated plainly
 * rather than as an error, because working offline is the expected condition,
 * not a fault.
 */
export function SyncIndicator() {
  const theme = useTheme();
  const status = useSyncStore((state) => state.status);
  const pending = useSyncStore((state) => state.pending);
  const syncNow = useSyncNow();

  if (status === 'idle' && pending === 0) return null;
  if (status === 'syncing' && pending === 0) return null;

  const offline = status === 'offline';
  const failed = status === 'error';

  const colors = failed
    ? { bg: theme.dangerBg, fg: theme.danger }
    : { bg: theme.backgroundElement, fg: theme.textSecondary };

  const message = offline
    ? pending > 0
      ? `Offline · ${pending} change${pending === 1 ? '' : 's'} waiting to upload`
      : 'Offline · your work is saved on this phone'
    : failed
      ? 'Could not sync · tap to try again'
      : `Syncing ${pending} change${pending === 1 ? '' : 's'}`;

  return (
    <Pressable onPress={failed || offline ? syncNow : undefined}>
      <View style={[styles.banner, { backgroundColor: colors.bg }]}>
        <Feather
          name={offline ? 'cloud-off' : failed ? 'alert-circle' : 'refresh-cw'}
          size={14}
          color={colors.fg}
        />
        <ThemedText type="small" style={{ color: colors.fg }}>
          {message}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
});
