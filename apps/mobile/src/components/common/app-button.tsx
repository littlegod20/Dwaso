import { Feather } from '@expo/vector-icons';
import { StyleSheet, type ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';

import { useTheme } from '@/hooks/use-theme';

type AppButtonProps = {
  label: string;
  onPress?: () => void;
  icon?: keyof typeof Feather.glyphMap;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
};

export function AppButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  style,
}: AppButtonProps) {
  const theme = useTheme();

  const renderIcon = icon
    ? ({ color, size }: { color: string; size: number }) => (
        <Feather name={icon} size={size} color={color} />
      )
    : undefined;

  if (variant === 'secondary') {
    return (
      <Button
        mode="outlined"
        onPress={onPress}
        disabled={disabled}
        icon={renderIcon}
        textColor={theme.text}
        style={[styles.button, { borderColor: theme.border }, style]}
        contentStyle={styles.content}
        labelStyle={styles.label}
      >
        {label}
      </Button>
    );
  }

  return (
    <Button
      mode="contained"
      onPress={onPress}
      disabled={disabled}
      icon={renderIcon}
      buttonColor={theme.primary}
      textColor={theme.primaryText}
      style={[styles.button, style]}
      contentStyle={styles.content}
      labelStyle={styles.label}
    >
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 28,
  },
  content: {
    height: 52,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
});
