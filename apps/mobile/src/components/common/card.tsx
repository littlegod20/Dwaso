import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
  bordered?: boolean;
  borderColor?: string;
};

export function Card({ children, style, onPress, bordered = true, borderColor }: CardProps) {
  const theme = useTheme();

  const cardStyle = [
    styles.base,
    {
      backgroundColor: theme.card,
      borderColor: borderColor ?? theme.border,
      borderWidth: bordered ? StyleSheet.hairlineWidth * 2 : 0,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
