import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FilterChip } from '@/components/common/filter-chip';
import { ScreenContainer } from '@/components/common/screen-container';
import { ThemedText } from '@/components/themed-text';
import { ProductRow } from '@/components/inventory/product-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { products } from '@/mock-data/products';

const TOTAL_COUNT = products.length;
const LOW_COUNT = products.filter((product) => product.status === 'low').length;

export default function InventoryScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <ThemedText type="subtitle">Inventory</ThemedText>
        <Pressable
          onPress={() => router.push('/add-stock')}
          style={[
            styles.addButton,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          <Feather name="plus" size={20} color={theme.primary} />
        </Pressable>
      </View>

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement }]}>
        <Feather name="search" size={18} color={theme.textSecondary} />
        {/* TODO: wire up search filtering once real product data is available */}
        <TextInput
          placeholder="Search products"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
        />
      </View>

      {/* TODO: wire up filter state — chips are presentational only for now */}
      <View style={styles.chipRow}>
        <FilterChip label={`All · ${TOTAL_COUNT}`} active />
        <FilterChip label="In stock" />
        <FilterChip label={`Low · ${LOW_COUNT}`} />
        <FilterChip label="Out" />
      </View>

      <View style={styles.list}>
        {products.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
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
