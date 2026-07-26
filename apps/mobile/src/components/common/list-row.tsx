import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListRowProps = {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  subtitleLines?: number;
  subtitleColor?: ThemeColor;
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
};

export function ListRow({
  leading,
  title,
  subtitle,
  subtitleLines = 1,
  subtitleColor = 'textSecondary',
  trailing,
  onPress,
  showChevron,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <View style={styles.row}>
      {leading}
      <View style={styles.textGroup}>
        <ThemedText type="default" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText type="small" themeColor={subtitleColor} numberOfLines={subtitleLines}>
            {subtitle}
          </ThemedText>
        )}
      </View>
      {trailing}
      {showChevron && <Feather name="chevron-right" size={18} color={theme.textSecondary} />}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});
