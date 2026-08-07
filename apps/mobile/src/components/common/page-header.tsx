import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type PageHeaderProps = {
  title: string;
  onBack?: () => void;
  rightIcon?: keyof typeof Feather.glyphMap;
  onRightPress?: () => void;
  rightLabel?: string;
  onRightLabelPress?: () => void;
};

export function PageHeader({
  title,
  onBack,
  rightIcon,
  onRightPress,
  rightLabel,
  onRightLabelPress,
}: PageHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}
      >
        <Feather name="chevron-left" size={20} color={theme.text} />
      </Pressable>

      <ThemedText type="default" style={styles.title} numberOfLines={1}>
        {title}
      </ThemedText>

      {rightLabel ? (
        <ThemedText type="smallBold" themeColor="primary" onPress={onRightLabelPress}>
          {rightLabel}
        </ThemedText>
      ) : rightIcon ? (
        <Pressable
          onPress={onRightPress}
          hitSlop={12}
          style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}
        >
          <Feather name={rightIcon} size={20} color={theme.text} />
        </Pressable>
      ) : (
        <View style={styles.iconCircle} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 17,
  },
});
