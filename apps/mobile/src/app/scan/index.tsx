import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScanTopBar } from '@/components/scan/scan-top-bar';
import { Viewfinder } from '@/components/scan/viewfinder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ScanIndexScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={styles.container}>
      <View style={{ paddingTop: insets.top + Spacing.two }}>
        <ScanTopBar />
      </View>

      {/* TODO: replace with a real camera feed (expo-camera) once CV integration begins.
          Tapping the frame below stands in for a product being detected. */}
      <Pressable style={styles.frameArea} onPress={() => router.push('/scan/recognized')}>
        <Viewfinder />
      </Pressable>

      <View style={[styles.captionRow, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={[styles.captionPill, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">Point camera at a product</ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  frameArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionRow: {
    alignItems: 'center',
  },
  captionPill: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
});
