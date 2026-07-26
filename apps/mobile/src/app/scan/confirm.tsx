import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/common/app-button';
import { IconBadge } from '@/components/common/icon-badge';
import { StatusPill } from '@/components/common/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getProductById } from '@/mock-data/products';
import { DEMO_SCAN_RESULT } from '@/mock-data/scan';
import { calculateMargin } from '@/utils/margin';
import { formatCurrency } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';

const DETAIL_STATUS_LABEL = {
  low: 'Low stock',
  'out-of-stock': 'Out of stock',
} as const;

export default function ScanConfirmScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const product = getProductById(DEMO_SCAN_RESULT.productId);

  if (!product) return null;

  const status = getStatusMeta(product.status);
  const margin = calculateMargin(product.costPrice, product.sellPrice);
  const detailLabel = product.status === 'in-stock' ? null : DETAIL_STATUS_LABEL[product.status];

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />

      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.three },
        ]}>
        <View style={styles.handle} />

        <View style={styles.identity}>
          <IconBadge icon="box" color={theme[status.variant]} backgroundColor={theme[`${status.variant}Bg`]} />
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
            {product.quantity} units
          </ThemedText>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Cost
            </ThemedText>
            <ThemedText type="default" style={styles.statValue}>
              {formatCurrency(product.costPrice)}
            </ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Sell
            </ThemedText>
            <ThemedText type="default" style={styles.statValue}>
              {formatCurrency(product.sellPrice)}
            </ThemedText>
          </View>
          <View style={styles.statColumn}>
            <ThemedText type="small" themeColor="textSecondary">
              Margin
            </ThemedText>
            <ThemedText type="default" themeColor="primary" style={styles.statValue}>
              {margin}%
            </ThemedText>
          </View>
        </View>

        <AppButton
          label="Add stock"
          icon="plus"
          onPress={() => router.push({ pathname: '/add-stock', params: { id: product.id } })}
        />

        <View style={styles.secondaryRow}>
          <AppButton
            label="View details"
            variant="secondary"
            style={styles.secondaryButton}
            onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
          />
          <AppButton
            label="Edit price"
            variant="secondary"
            style={styles.secondaryButton}
            onPress={() => router.push({ pathname: '/edit-price', params: { id: product.id } })}
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
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
  },
});
