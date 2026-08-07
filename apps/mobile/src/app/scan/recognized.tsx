import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { IconBadge } from '@/components/common/icon-badge';
import { ScanTopBar } from '@/components/scan/scan-top-bar';
import { Viewfinder } from '@/components/scan/viewfinder';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProduct } from '@/lib/queries/products';
import { useScanStore } from '@/stores/scan';
import { getStatusMeta } from '@/utils/product-status';

export default function ScanRecognizedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const candidate = useScanStore((state) => state.candidate);
  const capturedUri = useScanStore((state) => state.capturedUri);
  const reset = useScanStore((state) => state.reset);

  const { data: product } = useProduct(candidate?.productId ?? undefined);

  if (!candidate) {
    router.replace('/scan');
    return null;
  }

  const dismiss = () => {
    reset();
    router.back();
  };

  const enrol = () => {
    reset();
    router.replace({
      pathname: '/add-product',
      params: {
        name: candidate.suggestion?.name ?? '',
        category: candidate.suggestion?.category ?? '',
        barcode: candidate.suggestion?.barcode ?? '',
      },
    });
  };

  const matched = Boolean(product);
  const status = product ? getStatusMeta(product.status) : null;

  return (
    <ThemedView style={styles.container}>
      {capturedUri ? (
        <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : null}

      <View style={{ paddingTop: insets.top + Spacing.two }}>
        <ScanTopBar />
      </View>

      <View style={styles.frameArea} pointerEvents="none">
        <Viewfinder
          filled={matched}
          label={
            <View
              style={[
                styles.matchPill,
                { backgroundColor: matched ? theme.primary : theme.backgroundElement },
              ]}
            >
              {matched ? (
                <View style={[styles.matchDot, { backgroundColor: theme.primaryText }]} />
              ) : null}
              <ThemedText
                type="smallBold"
                style={matched ? { color: theme.primaryText } : undefined}
              >
                {matched
                  ? `${product?.name} · ${Math.round(candidate.confidence * 100)}%`
                  : candidate.queued
                    ? 'Will identify when back online'
                    : 'Not recognised yet'}
              </ThemedText>
            </View>
          }
        />
      </View>

      <View
        style={[
          styles.peekCard,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.three },
        ]}
      >
        <View style={styles.peekHandle} />

        {product && status ? (
          <Pressable onPress={() => router.push('/scan/confirm')}>
            <View style={styles.peekRow}>
              <IconBadge
                icon="box"
                color={theme[status.variant]}
                backgroundColor={theme[`${status.variant}Bg`]}
              />
              <View style={styles.peekText}>
                <ThemedText type="default" style={styles.peekTitle}>
                  {product.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  In stock: {product.quantity} {product.unit}
                </ThemedText>
              </View>
            </View>
            <View style={styles.swipeUpRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Tap for details
              </ThemedText>
              <Feather name="chevron-up" size={16} color={theme.textSecondary} />
            </View>
          </Pressable>
        ) : (
          <View style={styles.unknownBlock}>
            <ThemedText type="default" style={styles.peekTitle}>
              {candidate.suggestion?.name ?? 'New item'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {candidate.queued
                ? 'Saved. It will be identified once you have signal — you can carry on selling.'
                : 'Add it once and every future scan will be instant.'}
            </ThemedText>
            <AppButton label="Add this product" icon="plus" onPress={enrol} />
            <AppButton label="Scan something else" variant="secondary" onPress={dismiss} />
          </View>
        )}
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
    paddingTop: Spacing.two,
  },
  unknownBlock: {
    gap: Spacing.two,
  },
});
