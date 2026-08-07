import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { IconBadge } from '@/components/common/icon-badge';
import { StatusPill } from '@/components/common/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProduct } from '@/lib/queries/products';
import { recordSale, useLocalMutation } from '@/lib/mutations';
import { useScanStore } from '@/stores/scan';
import { useMoney } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';
import { marginPercent } from '@dwaso/domain';

const DETAIL_STATUS_LABEL = {
  low: 'Low stock',
  'out-of-stock': 'Out of stock',
} as const;

export default function ScanConfirmScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { format } = useMoney();

  const candidate = useScanStore((state) => state.candidate);
  const reset = useScanStore((state) => state.reset);
  const { data: product } = useProduct(candidate?.productId ?? undefined);

  const [quantity, setQuantity] = useState(1);
  const sell = useLocalMutation(recordSale);

  if (!product) return null;

  const status = getStatusMeta(product.status);
  const detailLabel = product.status === 'in-stock' ? null : DETAIL_STATUS_LABEL[product.status];
  const lineTotal = product.sellPriceMinor * quantity;

  /**
   * The whole cascade exists to end here, in one tap, with the sale recorded
   * locally. Nothing on this path touches the network.
   */
  const confirmSale = () => {
    sell.mutate(
      { lines: [{ productId: product.id, quantity }] },
      {
        onSuccess: () => {
          reset();
          router.dismissTo('/(tabs)');
        },
      },
    );
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.three },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.identity}>
          <IconBadge
            icon="box"
            color={theme[status.variant]}
            backgroundColor={theme[`${status.variant}Bg`]}
          />
          <View style={styles.identityText}>
            <ThemedText type="default" style={styles.productName}>
              {product.name}
            </ThemedText>
            {detailLabel && <StatusPill label={detailLabel} variant={status.variant} />}
          </View>
        </View>

        <View style={styles.stockSection}>
          <ThemedText type="small" themeColor="textSecondary">
            Current stock
          </ThemedText>
          <ThemedText type="title" style={styles.stockNumber}>
            {product.quantity} {product.unit}
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Cost
            </ThemedText>
            <ThemedText type="default" style={styles.statValue}>
              {format(product.costPriceMinor)}
            </ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Sell
            </ThemedText>
            <ThemedText type="default" style={styles.statValue}>
              {format(product.sellPriceMinor)}
            </ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Margin
            </ThemedText>
            <ThemedText type="default" themeColor="primary" style={styles.statValue}>
              {marginPercent(product.sellPriceMinor, product.costPriceMinor)}%
            </ThemedText>
          </View>
        </View>

        <View style={[styles.quantityRow, { backgroundColor: theme.backgroundElement }]}>
          <Pressable
            onPress={() => setQuantity((value) => Math.max(1, value - 1))}
            hitSlop={8}
            style={styles.quantityButton}
          >
            <Feather name="minus" size={20} color={theme.text} />
          </Pressable>
          <ThemedText type="subtitle">
            {quantity} {product.unit}
          </ThemedText>
          <Pressable
            onPress={() => setQuantity((value) => value + 1)}
            hitSlop={8}
            style={styles.quantityButton}
          >
            <Feather name="plus" size={20} color={theme.text} />
          </Pressable>
        </View>

        <AppButton
          label={sell.isPending ? 'Recording…' : `Record sale · ${format(lineTotal)}`}
          icon="check"
          disabled={sell.isPending}
          onPress={confirmSale}
        />

        <View style={styles.secondaryRow}>
          <AppButton
            label="Add stock"
            variant="secondary"
            style={styles.secondaryButton}
            onPress={() => router.push({ pathname: '/add-stock', params: { id: product.id } })}
          />
          <AppButton
            label="View details"
            variant="secondary"
            style={styles.secondaryButton}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center',
  },
  identity: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'center',
  },
  identityText: {
    gap: Spacing.half,
  },
  productName: {
    fontSize: 18,
    fontWeight: '700',
  },
  stockSection: {
    gap: 4,
  },
  stockNumber: {
    fontSize: 34,
    lineHeight: 40,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statColumn: {
    gap: Spacing.half,
  },
  statValue: {
    fontWeight: '700',
    fontSize: 17,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  quantityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
  },
});
