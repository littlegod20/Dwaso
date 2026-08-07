import * as Crypto from 'expo-crypto';
import type { BarcodeCatalogEntry, ScanMatchResponse } from '@dwaso/shared-types';
import { ApiError, apiRequest } from '../api/client';
import { findProductByBarcode } from '../queries/products';
import type { ScanMatch } from '@/stores/scan';

/**
 * The scan cascade, device side.
 *
 * Three tiers, tried cheapest first:
 *
 *  1. **Barcode against the local catalog.** Free, instant, works with no
 *     signal. Most repeat scans in a shop end here.
 *  2. **Barcode against the shared catalog on the server.** Cheap, needs
 *     network. Once any trader anywhere has enrolled a barcode, every other
 *     trader's first scan of it resolves without inference.
 *  3. **The vision model.** Costs money and needs network, and enrols the
 *     product so the next sighting falls back into tier 1.
 *
 * The tier that matters most is the one that does not exist here: failure. If
 * every tier misses, the caller still gets a result it can attach to a sale. A
 * trader with a customer waiting must never be blocked by recognition.
 */

export type CascadeInput = {
  barcode: string | null;
  imageBase64: string | null;
};

export async function runCascade(input: CascadeInput): Promise<ScanMatch> {
  const scanEventId = Crypto.randomUUID();

  if (input.barcode) {
    const local = await findProductByBarcode(input.barcode);

    if (local) {
      // Reported to the server so the cascade's economics stay visible, but not
      // awaited: a free, correct match must not be slowed by telemetry.
      void reportTelemetry({
        scanEventId,
        tier: 'barcode',
        matchedProductId: local.id,
        confidence: 1,
        barcode: input.barcode,
      });

      return {
        productId: local.id,
        productName: local.name,
        confidence: 1,
        tier: 'barcode',
        queued: false,
        scanEventId,
        suggestion: null,
      };
    }

    const known = await lookupSharedBarcode(input.barcode);

    if (known) {
      return {
        productId: null,
        productName: known.name,
        confidence: 0.9,
        tier: 'barcode',
        queued: false,
        scanEventId,
        // No product id: this shop has never stocked it. The name and category
        // pre-fill the add-product form so enrolling it is a confirmation
        // rather than a typing exercise.
        suggestion: { name: known.name, category: known.category, barcode: input.barcode },
      };
    }
  }

  if (!input.imageBase64) {
    return unresolved(scanEventId, input.barcode);
  }

  try {
    const response = await apiRequest<ScanMatchResponse>('/scan/match', {
      method: 'POST',
      body: {
        scanEventId,
        imageBase64: input.imageBase64,
        barcode: input.barcode,
        capturedAt: new Date().toISOString(),
      },
      timeoutMs: 30_000,
    });

    return {
      productId: response.matchedProductId,
      productName:
        response.candidates.find((candidate) => candidate.productId === response.matchedProductId)
          ?.name ??
        response.suggestion?.name ??
        null,
      confidence: response.confidence,
      tier: response.tier,
      queued: false,
      scanEventId: response.scanEventId,
      suggestion: response.suggestion,
    };
  } catch (error) {
    // Offline, or the shop's daily vision budget is spent. Either way the sale
    // proceeds: the scan is marked queued, and the server links it to the sale
    // line once recognition catches up.
    if (error instanceof ApiError && error.retryable) {
      return { ...unresolved(scanEventId, input.barcode), queued: true };
    }
    return unresolved(scanEventId, input.barcode);
  }
}

function unresolved(scanEventId: string, barcode: string | null): ScanMatch {
  return {
    productId: null,
    productName: null,
    confidence: 0,
    tier: 'manual',
    queued: false,
    scanEventId,
    suggestion: barcode ? { name: null, category: null, barcode } : null,
  };
}

async function lookupSharedBarcode(barcode: string): Promise<BarcodeCatalogEntry | null> {
  try {
    return await apiRequest<BarcodeCatalogEntry>(`/scan/barcode/${encodeURIComponent(barcode)}`);
  } catch {
    return null;
  }
}

async function reportTelemetry(body: {
  scanEventId: string;
  tier: string;
  matchedProductId: string | null;
  confidence: number;
  barcode: string | null;
}): Promise<void> {
  try {
    await apiRequest('/scan/telemetry', { method: 'POST', body });
  } catch {
    // Telemetry is the first thing that should be dropped when the network is
    // bad; losing a data point costs nothing the trader can feel.
  }
}
