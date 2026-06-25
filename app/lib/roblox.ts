const ENV_ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ENV_ROBLOX_API_KEY) {
  console.error('[roblox] ROBLOX_API_KEY environment variable is missing');
  throw new Error('ROBLOX_API_KEY environment variable is required');
}

export const ROBLOX_API_KEY = ENV_ROBLOX_API_KEY;

export const USER_API = 'https://users.roblox.com/v1/users/';
export const AVATAR_API = 'https://avatar.roblox.com/v1/users/';
export const ITEM_DETAILS_API = 'https://economy.roblox.com/v2/assets/';
export const INVENTORY_CLOUD_API = 'https://apis.roblox.com/cloud/v2/users/';
export const THUMBNAIL_API = 'https://thumbnails.roblox.com/v1/';

export const ASSET_TYPE_LABELS: Record<number, string> = {
  2: 'T-Shirt', 8: 'Hat', 11: 'Shirt', 12: 'Pants', 17: 'Head', 18: 'Face',
  19: 'Gear', 41: 'Hair', 42: 'Face', 43: 'Neck', 44: 'Shoulder', 45: 'Front',
  46: 'Back', 47: 'Waist', 57: 'Ear', 58: 'Eye', 64: 'T-Shirt', 65: 'Shirt',
  66: 'Pants', 67: 'Jacket', 68: 'Sweater', 69: 'Shorts', 70: 'Left Shoe',
  71: 'Right Shoe', 72: 'Skirt', 73: 'Dress', 76: 'Eyebrow', 77: 'Eyelash', 79: 'Head',
  1: 'Image', 3: 'Audio', 4: 'Mesh', 5: 'Lua', 6: 'HTML', 7: 'Text', 9: 'Place',
  10: 'Model', 13: 'Decal', 21: 'Badge', 24: 'Animation', 34: 'Gamepass',
  38: 'Plugin', 40: 'MeshPart', 48: 'AnimationAsset', 49: 'AnimationAsset',
};

export const DEV_ASSET_TYPES = new Set([
  'Image', 'Audio', 'Mesh', 'Lua', 'HTML', 'Text', 'Place', 'Model',
  'Decal', 'Badge', 'Animation', 'Gamepass', 'Plugin', 'MeshPart', 'AnimationAsset',
]);

export const OUTFIT_ASSET_TYPES = new Set([
  'T-Shirt', 'Hat', 'Shirt', 'Pants', 'Head', 'Face', 'Gear',
  'Hair', 'Neck', 'Shoulder', 'Front', 'Back', 'Waist', 'Ear', 'Eye',
  'Jacket', 'Sweater', 'Shorts', 'Left Shoe', 'Right Shoe', 'Skirt', 'Dress',
  'Eyebrow', 'Eyelash', 'Badge',
]);

export function assetTypeLabel(typeId: unknown): string | null {
  return typeof typeId === 'number' ? (ASSET_TYPE_LABELS[typeId] ?? null) : null;
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function getRobloxHeaders(customHeaders?: HeadersInit): Headers {
  const headers = new Headers(customHeaders);
  headers.set('User-Agent', 'AvatarsVercim/1.0');
  headers.set('x-api-key', ROBLOX_API_KEY);
  return headers;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function logApiError(message: string, meta: Record<string, unknown>, error: unknown) {
  console.error(`[api] ${message}`, meta, getErrorMessage(error));
}

async function readResponseBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 1000 ? `${text.slice(0, 1000)}...` : text || '<empty body>';
  } catch (error) {
    return `<failed to read body: ${getErrorMessage(error)}>`;
  }
}

async function timeoutFetch(url: string, options: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson(
  url: string,
  options: RequestInit = {},
  includeApiKey = true,
  retries = 3
): Promise<Record<string, unknown>> {
  const headers = includeApiKey ? getRobloxHeaders(options.headers) : new Headers(options.headers);
  try {
    const res = await timeoutFetch(url, { ...options, headers });

    if (res.status === 429 && retries > 0) {
      const retryAfter = res.headers.get('Retry-After');
      const waitTime = Math.min(retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000, 1000);
      await delay(waitTime);
      return fetchJson(url, options, includeApiKey, retries - 1);
    }

    if (!res.ok) {
      const body = await readResponseBody(res);
      throw new Error(`HTTP ${res.status} ${body}`);
    }
    return res.json();
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if ((name === 'AbortError' || name === 'FetchError') && retries > 0) {
      await delay(1000);
      return fetchJson(url, options, includeApiKey, retries - 1);
    }
    throw error;
  }
}

export interface ItemDetails {
  name: string;
  price: number | null;
  assetType: string | null;
  description: string;
}

export async function getItemDetails(assetId: number): Promise<ItemDetails> {
  try {
    const data = await fetchJson(`${ITEM_DETAILS_API}${assetId}/details`, {}, false);
    return {
      name: String(data.Name ?? `Item ${assetId}`),
      price: typeof data.PriceInRobux === 'number' ? data.PriceInRobux : data.IsFree ? 0 : null,
      assetType: assetTypeLabel(data.AssetTypeId),
      description: String(data.Description ?? ''),
    };
  } catch (error) {
    logApiError('Failed to fetch item details', { assetId }, error);
    return { name: `Item ${assetId}`, price: null, assetType: null, description: '' };
  }
}

export async function getThumbnailUrls(assetIds: number[]): Promise<Map<number, string>> {
  if (assetIds.length === 0) return new Map();

  const result = new Map<number, string>();
  const CHUNK_SIZE = 50;
  const missing = new Set(assetIds);

  for (let i = 0; i < assetIds.length; i += CHUNK_SIZE) {
    const chunk = assetIds.slice(i, i + CHUNK_SIZE);
    const idsParam = chunk.join(',');
    try {
      const data = await fetchJson(
        `${THUMBNAIL_API}assets?assetIds=${idsParam}&size=150x150&format=png&isCircular=false`
      );
      const items = data.data as Array<{ targetId: number; imageUrl: string }> | undefined;
      if (items) {
        for (const item of items) {
          if (item.imageUrl) {
            result.set(item.targetId, item.imageUrl);
            missing.delete(item.targetId);
          }
        }
      }
    } catch (error) {
      logApiError('Failed to fetch asset thumbnails', { assetIds: idsParam }, error);
    }
  }

  for (const id of missing) {
    result.set(id, `https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=150&height=150&format=png`);
  }

  return result;
}

export async function fetchItemDetailsPage(ids: number[]): Promise<Map<number, ItemDetails>> {
  const map = new Map<number, ItemDetails>();
  const CONCURRENCY = 5;
  let idx = 0;

  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= ids.length) return;
      const id = ids[i];
      map.set(id, await getItemDetails(id));
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker()));
  return map;
}
