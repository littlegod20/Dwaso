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
import { usePriceHistory, useProduct, useRestockHistory } from '@/lib/queries/products';
import { quickSale } from '@/lib/mutations';
import { useLocalMutation } from '@/lib/mutations';
import { useMoney } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';
import { relativeTime } from '@/utils/relative-time';

const DETAIL_STATUS_LABEL = {
  low: 'Low stock',
  'out-of-stock': 'Out of stock',
} as const;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { format } = useMoney();

  const { data: product, isLoading } = useProduct(id);
  const { data: restocks = [] } = useRestockHistory(id);
  const { data: priceHistory = [] } = usePriceHistory(id);

  const logSale = useLocalMutation((productId: string) => quickSale(productId, 1));

  if (!product) {
    return (
      <ScreenContainer>
        <PageHeader title="Product detail" />
        <ThemedText themeColor="textSecondary">
          {isLoading ? 'Loading…' : 'Product not found.'}
        </ThemedText>
      </ScreenContainer>
    );
  }

  const status = getStatusMeta(product.status);
  const detailLabel = product.status === 'in-stock' ? null : DETAIL_STATUS_LABEL[product.status];

  // Only the sell price is plotted: a trader reading this wants to see what she
  // has been charging, and overlaying cost on the same tiny sparkline makes
  // neither line legible.
  const sellPrices = priceHistory
    .map((point) => point.toSellMinor)
    .filter((value): value is number => value !== null);
  const lastChange = priceHistory[priceHistory.length - 1];

  return (
    <ScreenContainer>
      <PageHeader title="Product detail" />

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
            {[product.category, product.sku ? `SKU ${product.sku}` : null]
              .filter(Boolean)
              .join(' · ') || 'No category set'}
          </ThemedText>
          {detailLabel && <StatusPill label={detailLabel} variant={status.variant} />}
        </View>
      </View>

      <Card>
        <ThemedText type="small" themeColor="textSecondary">
          Current stock
        </ThemedText>
        <ThemedText type="title" style={styles.stockNumber}>
          {product.quantity} {product.quantity === 1 ? product.unit : `${product.unit}s`}
        </ThemedText>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
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
              {product.marginPercent}%
            </ThemedText>
          </View>
        </View>
      </Card>

      <View style={styles.actionsRow}>
        <AppButton
          label={logSale.isPending ? 'Logging…' : 'Sold 1'}
          icon="arrow-up-right"
          variant="secondary"
          style={styles.actionButton}
          disabled={logSale.isPending || product.quantity <= 0}
          onPress={() => logSale.mutate(product.id)}
        />
        <AppButton
          label="Add stock"
          icon="plus"
          style={styles.actionButton}
          onPress={() => router.push({ pathname: '/add-stock', params: { id: product.id } })}
        />
      </View>

      <AppButton
        label="Edit price"
        icon="edit-2"
        variant="secondary"
        onPress={() => router.push({ pathname: '/edit-price', params: { id: product.id } })}
      />

      {sellPrices.length > 1 && lastChange ? (
        <View style={styles.section}>
          <SectionHeader title="Price history" />
          <Card>
            <Sparkline data={sellPrices} color={theme.primary} width={272} />
            <View style={styles.priceHistoryCaption}>
              <ThemedText type="small">
                Sell {format(lastChange.fromSellMinor ?? 0)} → {format(lastChange.toSellMinor ?? 0)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {relativeTime(lastChange.occurredAt)}
              </ThemedText>
            </View>
          </Card>
        </View>
      ) : null}

      {restocks.length > 0 && (
        <View style={styles.section}>
          <SectionHeader title="Restock log" />
          <Card style={styles.restockCard}>
            {restocks.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                <ListRow
                  title={`+${entry.delta} ${entry.delta === 1 ? product.unit : `${product.unit}s`} restocked`}
                  subtitle={[entry.supplierName, relativeTime(entry.occurredAt)]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <ThemedText type="smallBold">{format(entry.totalCostMinor)}</ThemedText>
                  }
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
    flex: 1,
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
