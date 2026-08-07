import ngeohash from 'ngeohash';
import type { Redis } from 'ioredis';
import type { Env } from '../config/env.js';

export type DirectoryQuery = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  keyword?: string;
  category?: string;
  limit: number;
};

export type DirectoryResult = {
  externalId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  phone: string | null;
};

/**
 * The spec is explicit that Google Places is a placeholder for the MVP, so the
 * seam is the point. The Phase 3 self-listed wholesaler marketplace arrives as a
 * second implementation of this interface rather than a rewrite of the callers.
 */
export interface SupplierDirectory {
  search(query: DirectoryQuery): Promise<DirectoryResult[]>;
}

/**
 * Geohash precision 6 is roughly a 1.2km × 0.6km cell.
 *
 * A trader works from a fixed stall and will run the same search repeatedly, so
 * bucketing by cell turns a per-request billed lookup into a near-free one and
 * removes the latency. Precision 6 is deliberately coarse: finer cells would
 * fragment the cache and defeat the point, and supplier locations do not change
 * at street resolution.
 */
const GEOHASH_PRECISION = 6;

class GooglePlacesDirectory implements SupplierDirectory {
  constructor(
    private readonly apiKey: string,
    private readonly redis: Redis,
    private readonly cacheTtlSeconds: number,
  ) {}

  private cacheKey(query: DirectoryQuery): string {
    const cell = ngeohash.encode(query.latitude, query.longitude, GEOHASH_PRECISION);
    return `places:${cell}:${query.radiusMeters}:${query.category ?? 'any'}:${query.keyword ?? ''}`;
  }

  async search(query: DirectoryQuery): Promise<DirectoryResult[]> {
    const key = this.cacheKey(query);
    const cached = await this.redis.get(key);
    if (cached) return JSON.parse(cached) as DirectoryResult[];

    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.nationalPhoneNumber',
      },
      body: JSON.stringify({
        includedTypes: placeTypesFor(query.category),
        maxResultCount: query.limit,
        locationRestriction: {
          circle: {
            center: { latitude: query.latitude, longitude: query.longitude },
            radius: query.radiusMeters,
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // A Places outage should degrade supplier discovery to whatever the trader
      // has already saved, not take down the endpoint.
      return [];
    }

    const payload = (await response.json()) as {
      places?: {
        id: string;
        displayName?: { text: string };
        formattedAddress?: string;
        location?: { latitude: number; longitude: number };
        primaryType?: string;
        nationalPhoneNumber?: string;
      }[];
    };

    const results: DirectoryResult[] = (payload.places ?? []).map((place) => ({
      externalId: place.id,
      name: place.displayName?.text ?? 'Unknown supplier',
      address: place.formattedAddress ?? null,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      category: place.primaryType ?? null,
      phone: place.nationalPhoneNumber ?? null,
    }));

    await this.redis.set(key, JSON.stringify(results), 'EX', this.cacheTtlSeconds);
    return results;
  }
}

function placeTypesFor(category: string | undefined): string[] {
  switch (category) {
    case 'food':
    case 'grocery':
      return ['grocery_store', 'supermarket', 'food_store'];
    case 'hardware':
      return ['hardware_store', 'home_improvement_store'];
    case 'clothing':
      return ['clothing_store'];
    default:
      return ['wholesaler', 'store'];
  }
}

/** Returns nothing when no key is configured, so the app runs locally without a
 * billed Google account. */
class EmptyDirectory implements SupplierDirectory {
  async search(): Promise<DirectoryResult[]> {
    return [];
  }
}

export function createSupplierDirectory(env: Env, redis: Redis): SupplierDirectory {
  if (!env.GOOGLE_PLACES_API_KEY) return new EmptyDirectory();
  return new GooglePlacesDirectory(env.GOOGLE_PLACES_API_KEY, redis, env.PLACES_CACHE_TTL_SECONDS);
}

/** Great-circle distance in kilometres, for sorting and display. */
export function distanceKm(fromLat: number, fromLon: number, toLat: number, toLon: number): number {
  const earthRadiusKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(toLat - fromLat);
  const dLon = toRad(toLon - fromLon);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLon / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}
