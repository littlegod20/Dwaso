import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { TabListProps, TabTriggerSlotProps } from 'expo-router/ui';
import { Children, forwardRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TabButtonProps = TabTriggerSlotProps & {
  icon: keyof typeof Feather.glyphMap;
  label: string;
};

export const TabButton = forwardRef<View, TabButtonProps>(
  ({ icon, label, isFocused, ...props }, ref) => {
    const theme = useTheme();
    const color = isFocused ? theme.primary : theme.textSecondary;

    return (
      <Pressable ref={ref} {...props} style={styles.tabButton}>
        <Feather name={icon} size={22} color={color} />
        <ThemedText type="small" style={[styles.tabLabel, { color }]}>
          {label}
        </ThemedText>
      </Pressable>
    );
  }
);

export function AppTabBar(props: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const triggers = Children.toArray(props.children);
  const midpoint = Math.ceil(triggers.length / 2);
  const leftTriggers = triggers.slice(0, midpoint);
  const rightTriggers = triggers.slice(midpoint);

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom }]}>
      <View style={[styles.bar, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.side}>{leftTriggers}</View>
        <View style={styles.centerSlot} />
        <View style={styles.side}>{rightTriggers}</View>
      </View>

      <Pressable
        onPress={() => router.push('/scan')}
        accessibilityRole="button"
        accessibilityLabel="Scan"
        style={[styles.scanButton, { backgroundColor: theme.primary, borderColor: theme.background }]}>
        <Feather name="camera" size={24} color={theme.primaryText} />
      </Pressable>
    </View>
  );
}

const BAR_HEIGHT = 64;
const SCAN_BUTTON_SIZE = 60;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    height: BAR_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  centerSlot: {
    width: SCAN_BUTTON_SIZE + Spacing.two,
  },
  tabButton: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.one,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  scanButton: {
    position: 'absolute',
    top: -SCAN_BUTTON_SIZE / 2 + 14,
    width: SCAN_BUTTON_SIZE,
    height: SCAN_BUTTON_SIZE,
    borderRadius: SCAN_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
});
