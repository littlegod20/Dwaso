import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/common/app-button';
import { Card } from '@/components/common/card';
import { IconBadge } from '@/components/common/icon-badge';
import { ListRow } from '@/components/common/list-row';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { SectionHeader } from '@/components/common/section-header';
import { Sparkline } from '@/components/common/sparkline';
import { StatusPill } from '@/components/common/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getProductById } from '@/mock-data/products';
import { calculateMargin } from '@/utils/margin';
import { formatCurrency } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';

const DETAIL_STATUS_LABEL = {
  low: 'Low stock',
  'out-of-stock': 'Out of stock',
} as const;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const product = getProductById(id ?? '');

  if (!product) {
    return (
      <ScreenContainer>
        <PageHeader title="Product detail" />
        <ThemedText themeColor="textSecondary">Product not found.</ThemedText>
      </ScreenContainer>
    );
  }

  const status = getStatusMeta(product.status);
  const margin = calculateMargin(product.costPrice, product.sellPrice);
  const detailLabel =
    product.status === 'in-stock' ? null : DETAIL_STATUS_LABEL[product.status];

  return (
    <ScreenContainer>
      {/* TODO: wire up "..." menu (duplicate, archive, delete, etc.) once defined */}
      <PageHeader title="Product detail" rightIcon="more-horizontal" />

      <View style={styles.identity}>
        <IconBadge
          icon="box"
          color={theme[status.variant]}
          backgroundColor={theme[`${status.variant}Bg`]}
          size={56}
          iconSize={26}
        />
        <View style={styles.identityText}>
          <ThemedText type="default" style={styles.productName}>
            {product.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {product.category} · SKU {product.sku}
          </ThemedText>
          {detailLabel && <StatusPill label={detailLabel} variant={status.variant} />}
        </View>
      </View>

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Current stock
        </ThemedText>
        <ThemedText type="title" style={styles.stockNumber}>
          {product.quantity} units
        </ThemedText>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
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
      </Card>

      <View style={styles.actionsRow}>
        {/* TODO: build a dedicated Log sale screen — no design reference yet */}
        <AppButton label="Log sale" icon="arrow-up-right" variant="secondary" style={styles.actionButton} />
        <AppButton
          label="Add stock"
          icon="plus"
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/add-stock', params: { id: product.id } })}
        />
      </View>

      {product.priceHistory && product.lastPriceChange && (
        <View style={styles.section}>
          <SectionHeader title="Price history" />
          <Card>
            <Sparkline data={product.priceHistory} color={theme.primary} width={272} />
            <View style={styles.priceHistoryCaption}>
              <ThemedText type="small">
                Sell {formatCurrency(product.lastPriceChange.from)} →{' '}
                {formatCurrency(product.lastPriceChange.to)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {product.lastPriceChange.date}
              </ThemedText>
            </View>
          </Card>
        </View>
      )}

      {product.restockLog.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Restock log" />
          <Card style={styles.restockCard}>
            {product.restockLog.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <ListRow
                  title={`+${entry.unitsAdded} units restocked`}
                  subtitle={`${entry.supplier} · ${entry.date}`}
                  trailing={<ThemedText type="smallBold">{formatCurrency(entry.totalCost)}</ThemedText>}
                />
              </View>
            ))}
          </Card>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  identity: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  identityText: {
    gap: Spacing.half,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 19,
    fontWeight: '700',
  },
  stockNumber: {
    fontSize: 34,
    lineHeight: 40,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    marginVertical: Spacing.three,
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
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  priceHistoryCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  restockCard: {
    padding: 0,
    paddingHorizontal: Spacing.three,
  },
});
