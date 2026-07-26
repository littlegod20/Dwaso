import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconBadge } from '@/components/common/icon-badge';
import { ScanTopBar } from '@/components/scan/scan-top-bar';
import { Viewfinder } from '@/components/scan/viewfinder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getProductById } from '@/mock-data/products';
import { DEMO_SCAN_RESULT } from '@/mock-data/scan';
import { getStatusMeta } from '@/utils/product-status';

export default function ScanRecognizedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const product = getProductById(DEMO_SCAN_RESULT.productId);

  if (!product) return null;

  const status = getStatusMeta(product.status);

  return (
    <ThemedView style={styles.container}>
      <View style={{ paddingTop: insets.top + Spacing.two }}>
        <ScanTopBar />
      </View>

      <Pressable style={styles.frameArea} onPress={() => router.push('/scan/confirm')}>
        <Viewfinder
          filled
          label={
            <View style={[styles.matchPill, { backgroundColor: theme.primary }]}>
              <View style={[styles.matchDot, { backgroundColor: theme.primaryText }]} />
              <ThemedText type="smallBold" style={{ color: theme.primaryText }}>
                {product.name} · {DEMO_SCAN_RESULT.confidence}%
              </ThemedText>
            </View>
          }
        />
      </Pressable>

      <Pressable
        onPress={() => router.push('/scan/confirm')}
        style={[
          styles.peekCard,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={styles.peekHandle} />
        <View style={styles.peekRow}>
          <IconBadge icon="box" color={theme[status.variant]} backgroundColor={theme[`${status.variant}Bg`]} />
          <View style={styles.peekText}>
            <ThemedText type="default" style={styles.peekTitle}>
              {product.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              In stock: {product.quantity} units
            </ThemedText>
          </View>
        </View>
        <View style={styles.swipeUpRow}>
          <ThemedText type="small" themeColor="textSecondary">
            Swipe up for details
          </ThemedText>
          <Feather name="chevron-up" size={16} color={theme.textSecondary} />
        </View>
      </Pressable>
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
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  matchDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  peekCard: {
    borderTopLeftRadius: Spacing.four,
    borderTopRightRadius: Spacing.four,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  peekHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  peekText: {
    gap: 2,
  },
  peekTitle: {
    fontWeight: '700',
  },
  swipeUpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
});
