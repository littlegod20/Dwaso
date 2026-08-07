import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useScanStore } from '@/stores/scan';

export function ScanTopBar() {
  const theme = useTheme();
  const torch = useScanStore((state) => state.torch);
  const toggleTorch = useScanStore((state) => state.toggleTorch);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        style={[styles.iconCircle, { backgroundColor: theme.backgroundElement }]}>
        <Feather name="x" size={20} color={theme.text} />
      </Pressable>
      <Pressable
        onPress={toggleTorch}
        hitSlop={12}
        style={[
          styles.iconCircle,
          { backgroundColor: torch ? theme.primary : theme.backgroundElement },
        ]}>
        <Feather name="zap" size={18} color={torch ? theme.primaryText : theme.text} />
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
