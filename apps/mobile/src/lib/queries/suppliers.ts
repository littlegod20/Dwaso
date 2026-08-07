import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import type { NearbySupplierResult, SupplierView } from '@dwaso/shared-types';
import { apiRequest } from '../api/client';
import { queryKeys } from './keys';

/**
 * Suppliers are the one read that genuinely lives on the server.
 *
 * Everything else in this app reads from SQLite because it describes the
 * trader's own business, which she must be able to see with no signal. A list of
 * wholesalers near her right now is the opposite: it is about the outside world,
 * it changes without her, and there is nothing useful to show from cache when
 * she has moved to a different market.
 */
export function useSavedSuppliers() {
  return useQuery({
    queryKey: queryKeys.suppliers,
    queryFn: () => apiRequest<{ suppliers: SupplierView[] }>('/suppliers'),
    select: (data) => data.suppliers,
  });
}

export type NearbyOptions = {
  productId?: string;
  category?: string;
  enabled?: boolean;
};

export function useNearbySuppliers(options: NearbyOptions = {}) {
  return useQuery({
    queryKey: queryKeys.nearbySuppliers(options.productId, options.category),
    enabled: options.enabled ?? true,
    // Wholesalers do not move, and the trader usually does not either while this
    // screen is open. Refetching on every focus would burn Places quota to
    // redraw the same pins.
    staleTime: 10 * 60 * 1000,
    retry: 1,
    queryFn: async (): Promise<NearbySupplierResult> => {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (!permission.granted) {
        throw new Error('Location access is needed to find suppliers near you');
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const params = new URLSearchParams({
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
      });

      if (options.productId) params.set('productId', options.productId);
      if (options.category) params.set('category', options.category);

      return apiRequest<NearbySupplierResult>(`/suppliers/nearby?${params.toString()}`);
    },
  });
}
