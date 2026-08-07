# 0001 — On-device embedding tier of the scan cascade

**Status:** accepted
**Date:** 2026-08-07

## Context

The scan cascade has three tiers: on-device barcode, on-device visual match, and
a server-side vision model. Tier 2 was the highest-technical-risk component and
the plan called for a spike before committing to it, with the fallback of
shipping barcode plus vision only.

The question was whether a small image encoder can run on the low-end Android
handsets our traders actually use.

## Findings

`react-native-executorch` (Software Mansion) exposes `useImageEmbeddings` with a
pre-exported CLIP ViT-B/32 image encoder, including a quantised variant.

| Property             | Value                                          |
| -------------------- | ---------------------------------------------- |
| Embedding dimensions | 512                                            |
| Input resolution     | 224×224                                        |
| Variants             | `CLIP_VIT_BASE_PATCH32_IMAGE`, `..._QUANTIZED` |

Requirements that turned out to be the real constraint:

- **Android 13 / API 33 minimum**, iOS 17 minimum
- React Native New Architecture only
- A custom development build; the library uses native modules, so Expo Go cannot
  run it

The 512-dimension output matches the `vector(512)` column already in the schema
and the ~2KB-per-product sync budget the plan assumed, so the storage and
transfer side of the design holds.

## Decision

**Tier 2 ships, but as a capability rather than an assumption.**

The Android 13 floor is the finding that matters. A meaningful share of the
target market — traders on entry-level handsets bought years ago — runs Android
10 to 12 and will never satisfy it. Building tier 2 as a requirement would mean
either abandoning those users or maintaining two product behaviours pretending
to be one.

So the device advertises whether it can encode, and the cascade adapts:

- **Capable device:** barcode → on-device embedding → vision.
- **Everything else:** barcode → vision, exactly the plan's fallback.

A trader on an older phone gets a slower, costlier second scan of each product,
never a broken one. Nothing in the API contract differs between the two.

## Consequence: the device computes embeddings, not the server

The plan had the server compute reference embeddings at enrolment. The spike
changes that, for a reason worth stating.

Tier 2 compares a freshly captured image against stored reference vectors, which
is only meaningful if both live in the same vector space. If the server produced
references with its own CLIP build while devices produced queries with
ExecuTorch's export, any drift between the two would degrade matching silently —
cosine similarity would still return a plausible-looking number, just a wrong
one.

Having the enrolling device compute the reference vector with the identical model
removes that failure mode by construction. It also removes a server-side
inference dependency entirely: `POST /v1/scan/enroll` accepts a 512-float vector,
validates its shape, and stores it.

Devices that cannot encode simply never call it. They still benefit from
embeddings enrolled by other devices in the same shop, because matching is what
they cannot do — not storage.

## Revisit if

- ExecuTorch lowers its Android floor below API 33.
- Telemetry shows the paid tier's share of scans is not falling for shops on
  capable devices, which would mean enrolment is not working and tier 2 is not
  earning its complexity.
