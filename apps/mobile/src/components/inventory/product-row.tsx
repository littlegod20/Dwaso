import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { IconBadge } from '@/components/common/icon-badge';
import { ListRow } from '@/components/common/list-row';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ProductListItem } from '@/lib/queries/products';
import { useMoney } from '@/utils/format-currency';
import { getStatusMeta } from '@/utils/product-status';

type ProductRowProps = {
  product: ProductListItem;
};

export function ProductRow({ product }: ProductRowProps) {
  const theme = useTheme();
  const { format } = useMoney();
  const status = getStatusMeta(product.status);

  return (
    <ListRow
      onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
      leading={
        <IconBadge
          icon="box"
          color={theme[status.variant]}
          backgroundColor={theme[`${status.variant}Bg`]}
        />
      }
      title={product.name}
      subtitle={`Cost ${format(product.costPriceMinor)} · Sell ${format(product.sellPriceMinor)} · Margin ${product.marginPercent}%`}
      subtitleLines={2}
      trailing={
        <View style={styles.trailing}>
          <ThemedText type="smallBold">
            {product.quantity} {product.quantity === 1 ? product.unit : `${product.unit}s`}
          </ThemedText>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: theme[status.variant] }]} />
            <ThemedText type="small" style={{ color: theme[status.variant] }}>
              {status.label}
            </ThemedText>
          </View>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  trailing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
