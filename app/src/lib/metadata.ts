import type { AssetMetadata } from "./types";

const cache = new Map<string, Promise<AssetMetadata | null>>();

/** Fetch and cache off-chain metadata. Returns null instead of throwing. */
export function fetchAssetMetadata(uri?: string | null): Promise<AssetMetadata | null> {
  if (!uri) return Promise.resolve(null);

  const cached = cache.get(uri);
  if (cached) return cached;

  const request = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(uri, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      return (await response.json()) as AssetMetadata;
    } catch {
      return null;
    }
  })();

  cache.set(uri, request);
  return request;
}
