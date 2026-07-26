import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ScanTopBar() {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
        <Feather name="x" size={20} color={theme.text} />
      </Pressable>
      {/* TODO: wire up real flash/torch toggle once camera hardware is integrated */}
      <Pressable
        hitSlop={12}
        style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
        <Feather name="zap" size={18} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
