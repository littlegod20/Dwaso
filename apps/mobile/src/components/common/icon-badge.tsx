import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

type IconBadgeProps = {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  backgroundColor: string;
  size?: number;
  iconSize?: number;
};

export function IconBadge({
  icon,
  color,
  backgroundColor,
  size = 48,
  iconSize = 22,
}: IconBadgeProps) {
  return (
    <View
      style={[styles.badge, { width: size, height: size, backgroundColor, borderRadius: size / 3 }]}
    >
      <Feather name={icon} size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
  },
});
