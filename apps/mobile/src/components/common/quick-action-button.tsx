import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type QuickActionButtonProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress?: () => void;
  highlighted?: boolean;
};

export function QuickActionButton({ icon, label, onPress, highlighted }: QuickActionButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.container, pressed && onPress && styles.pressed]}
    >
      <View
        style={[
          styles.iconSquare,
          highlighted
            ? { backgroundColor: theme.primary }
            : {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderWidth: StyleSheet.hairlineWidth * 2,
              },
        ]}
      >
        <Feather name={icon} size={22} color={highlighted ? theme.primaryText : theme.text} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.label} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  iconSquare: {
    width: 52,
    height: 52,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
});
