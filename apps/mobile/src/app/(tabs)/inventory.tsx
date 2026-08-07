import { useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { ScreenContainer } from '@/components/common/screen-container';
import { SyncIndicator } from '@/components/common/sync-indicator';
import { ThemedText } from '@/components/themed-text';
import { ProductRow } from '@/components/inventory/product-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProducts } from '@/lib/queries/products';
import { useSyncNow } from '@/lib/sync/provider';
import { useSyncStore } from '@/stores/sync';

type StockFilter = 'all' | 'in-stock' | 'low' | 'out-of-stock';

export default function InventoryScreen() {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StockFilter>('all');

  const syncStatus = useSyncStore((state) => state.status);
  const syncNow = useSyncNow();

  // Search runs in SQL; the status filter runs here, because status is derived
  // from the movement fold and filtering on it in SQL would mean repeating that
  // subquery in the WHERE clause.
  const { data: products = [], isLoading } = useProducts(search.trim() || undefined);

  const counts = useMemo(
    () => ({
      all: products.length,
      'in-stock': products.filter((product) => product.status === 'in-stock').length,
      low: products.filter((product) => product.status === 'low').length,
      'out-of-stock': products.filter((product) => product.status === 'out-of-stock').length,
    }),
    [products],
  );

  const visible = useMemo(
    () => (filter === 'all' ? products : products.filter((product) => product.status === filter)),
    [products, filter],
  );

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={syncStatus === 'syncing'}
          onRefresh={syncNow}
          tintColor={theme.primary}
        />
      }
    >
      <View style={styles.header}>
        <ThemedText type="subtitle">Inventory</ThemedText>
        <Pressable
          onPress={() => router.push('/add-product')}
          style={[
            styles.addButton,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
        >
          <Feather name="plus" size={20} color={theme.primary} />
        </Pressable>
      </View>

      <SyncIndicator />

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search products"
          placeholderTextColor={theme.textSecondary}
          autoCorrect={false}
          style={[styles.searchInput, { color: theme.text }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <Feather name="x" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.chipRow}>
        <FilterChip
          label={`All · ${counts.all}`}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterChip
          label={`In stock · ${counts['in-stock']}`}
          active={filter === 'in-stock'}
          onPress={() => setFilter('in-stock')}
        />
        <FilterChip
          label={`Low · ${counts.low}`}
          active={filter === 'low'}
          onPress={() => setFilter('low')}
        />
        <FilterChip
          label={`Out · ${counts['out-of-stock']}`}
          active={filter === 'out-of-stock'}
          onPress={() => setFilter('out-of-stock')}
        />
      </View>

      <View style={styles.list}>
        {visible.length ? (
          visible.map((product) => <ProductRow key={product.id} product={product} />)
        ) : isLoading ? null : (
          <EmptyState
            icon="box"
            title={search ? 'No matches' : 'No products yet'}
            description={
              search
                ? `Nothing here matches "${search}".`
                : 'Scan an item or add one by hand to start tracking your stock.'
            }
            actionLabel={search ? undefined : 'Add product'}
            onActionPress={() => router.push('/add-product')}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    height: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  list: {
    gap: Spacing.one,
  },
});
