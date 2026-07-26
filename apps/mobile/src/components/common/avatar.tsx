import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type AvatarProps = {
  label: string;
  color: string;
  backgroundColor: string;
  icon?: keyof typeof Feather.glyphMap;
  size?: number;
};

export function Avatar({ label, color, backgroundColor, icon, size = 44 }: AvatarProps) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor },
      ]}>
      {icon ? (
        <Feather name={icon} size={size * 0.5} color={color} />
      ) : (
        <ThemedText type="smallBold" style={{ color }}>
          {label}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
