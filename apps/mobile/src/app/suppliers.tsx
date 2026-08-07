import { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { AlertBanner } from '@/components/common/alert-banner';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/common/filter-chip';
import { ListRow } from '@/components/common/list-row';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { MapPlaceholder } from '@/components/suppliers/map-placeholder';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProduct } from '@/lib/queries/products';
import { useNearbySuppliers, useSavedSuppliers } from '@/lib/queries/suppliers';

/**
 * Reached either from the menu or from a low-stock notification, which passes
 * the product that ran out so the search can be narrowed to wholesalers who
 * plausibly carry it.
 */
export default function SuppliersScreen() {
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const theme = useTheme();

  const [view, setView] = useState<'nearby' | 'saved'>('nearby');

  const { data: product } = useProduct(productId);
  const nearby = useNearbySuppliers({
    productId,
    category: product?.category ?? undefined,
    enabled: view === 'nearby',
  });
  const saved = useSavedSuppliers();

  const suppliers = view === 'nearby' ? (nearby.data?.suppliers ?? []) : (saved.data ?? []);
  const query = view === 'nearby' ? nearby : saved;

  const call = (phone: string | null) => {
    if (phone) void Linking.openURL(`tel:${phone}`);
  };

  return (
    <ScreenContainer>
      <PageHeader title="Suppliers" />

      {product ? (
        <View style={[styles.contextPill, { backgroundColor: theme.warningBg }]}>
          <Feather name="home" size={14} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">
            Restocking: {product.name}
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.toggleRow}>
        <FilterChip label="Nearby" active={view === 'nearby'} onPress={() => setView('nearby')} />
        <FilterChip label="Saved" active={view === 'saved'} onPress={() => setView('saved')} />
      </View>

      {view === 'nearby' ? <MapPlaceholder /> : null}

      {query.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Looking around you…
          </ThemedText>
        </View>
      ) : null}

      {query.isError ? (
        <AlertBanner
          icon="wifi-off"
          variant="warning"
          title="Could not search"
          subtitle={
            query.error instanceof Error
              ? query.error.message
              : 'Finding suppliers needs a connection.'
          }
        />
      ) : null}

      {nearby.data?.disclaimer && view === 'nearby' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
          {nearby.data.disclaimer}
        </ThemedText>
      ) : null}

      {!query.isLoading && !query.isError && suppliers.length === 0 ? (
        <EmptyState
          icon="map-pin"
          title={view === 'nearby' ? 'Nothing found nearby' : 'No saved suppliers'}
          description={
            view === 'nearby'
              ? 'Try again from the market, or save the wholesalers you already use.'
              : 'Suppliers you save from a search will appear here, even offline.'
          }
        />
      ) : null}

      <View style={styles.list}>
        {suppliers.map((supplier) => (
          <ListRow
            key={supplier.id}
            leading={
              <View style={[styles.pinBadge, { backgroundColor: theme.backgroundElement }]}>
                <Feather name="map-pin" size={20} color={theme.textSecondary} />
              </View>
            }
            title={supplier.name}
            subtitle={[
              supplier.distanceKm != null ? `${supplier.distanceKm.toFixed(1)}km away` : null,
              supplier.category,
              supplier.address,
            ]
              .filter(Boolean)
              .join(' · ')}
            subtitleLines={2}
            trailing={
              supplier.phone ? (
                <Pressable
                  onPress={() => call(supplier.phone)}
                  style={[styles.callButton, { backgroundColor: theme.backgroundElement }]}>
                  <Feather name="phone" size={18} color={theme.primary} />
                </Pressable>
              ) : undefined
            }
          />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contextPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  loading: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  caption: {
    textAlign: 'center',
  },
  list: {
    gap: Spacing.one,
  },
  pinBadge: {
    width: 44,
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
