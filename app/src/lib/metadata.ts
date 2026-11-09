import type { AssetMetadata } from "./types";

const cache = new Map<string, Promise<AssetMetadata | null>>();

/**
 * On-chain demo accounts were seeded before the repository moved from the
 * `pradeepbiswas/AssetX` account to `LevelVoid/AssetX`. The metadata URI is
 * stored on-chain, so resolve the legacy raw URL against the current repo.
 */
const LEGACY_DEMO_PREFIX =
  "https://raw.githubusercontent.com/pradeepbiswas/AssetX/";
const CURRENT_DEMO_PREFIX =
  "https://raw.githubusercontent.com/LevelVoid/AssetX/";

export function resolveMetadataUri(uri: string): string {
  return uri.startsWith(LEGACY_DEMO_PREFIX)
    ? `${CURRENT_DEMO_PREFIX}${uri.slice(LEGACY_DEMO_PREFIX.length)}`
    : uri;
}

/** Fetch and cache off-chain metadata. Returns null instead of throwing. */
export function fetchAssetMetadata(uri?: string | null): Promise<AssetMetadata | null> {
  if (!uri) return Promise.resolve(null);

  const resolvedUri = resolveMetadataUri(uri);
  const cached = cache.get(resolvedUri);
  if (cached) return cached;

  const request = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(resolvedUri, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const metadata = (await response.json()) as AssetMetadata;
      if (typeof metadata.image === "string") {
        metadata.image = resolveMetadataUri(metadata.image);
      }
      return metadata;
    } catch {
      return null;
    }
  })();

  cache.set(resolvedUri, request);
  return request;
}
