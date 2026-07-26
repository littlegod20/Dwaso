import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { FilterChip } from '@/components/common/filter-chip';
import { ListRow } from '@/components/common/list-row';
import { PageHeader } from '@/components/common/page-header';
import { ScreenContainer } from '@/components/common/screen-container';
import { MapPlaceholder } from '@/components/suppliers/map-placeholder';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { suppliers } from '@/mock-data/suppliers';

const RESTOCKING_PRODUCT = 'Rice 50kg Bag';

export default function SuppliersScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer>
      <PageHeader title="Suppliers" />

      <View style={[styles.contextPill, { backgroundColor: theme.warningBg }]}>
        <Feather name="home" size={14} color={theme.primary} />
        <ThemedText type="smallBold" themeColor="primary">
          Restocking: {RESTOCKING_PRODUCT}
        </ThemedText>
      </View>

      {/* TODO: wire up Map/List toggle — Map view is shown by default for now */}
      <View style={styles.toggleRow}>
        <FilterChip label="Map" active />
        <FilterChip label="List" />
      </View>

      <MapPlaceholder />

      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
        Distance & category shown only — call ahead to confirm current stock.
      </ThemedText>

      <View style={styles.list}>
        {suppliers.map((supplier) => (
          <ListRow
            key={supplier.id}
            leading={
              <View
                style={[
                  styles.pinBadge,
                  { backgroundColor: supplier.highlighted ? theme.warningBg : theme.backgroundElement },
                ]}>
                <Feather
                  name="map-pin"
                  size={20}
                  color={supplier.highlighted ? theme.primary : theme.textSecondary}
                />
              </View>
            }
            title={supplier.name}
            subtitle={`${supplier.distanceKm}km away · ${supplier.type} · ${supplier.category}`}
            subtitleLines={2}
            trailing={
              // TODO: wire up tel: link once real phone numbers are confirmed
              <Pressable style={[styles.callButton, { backgroundColor: theme.backgroundElement }]}>
                <Feather name="phone" size={18} color={theme.primary} />
              </Pressable>
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
