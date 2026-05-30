import { NextResponse } from 'next/server';

const ENV_ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ENV_ROBLOX_API_KEY) {
  console.error('[api/user] ROBLOX_API_KEY environment variable is missing');
  throw new Error('ROBLOX_API_KEY environment variable is required');
}

const ROBLOX_API_KEY = ENV_ROBLOX_API_KEY;

const USER_API = 'https://users.roblox.com/v1/users/';
const AVATAR_API = 'https://avatar.roblox.com/v1/users/';
const ITEM_DETAILS_API = 'https://economy.roblox.com/v2/assets/';
const INVENTORY_CLOUD_API = 'https://apis.roblox.com/cloud/v2/users/';
const THUMBNAIL_API = 'https://thumbnails.roblox.com/v1/';

// Roblox AssetTypeId → short, friendly category label shown on item cards.
const ASSET_TYPE_LABELS: Record<number, string> = {
  // Avatar wearables
  2: 'T-Shirt',
  8: 'Hat',
  11: 'Shirt',
  12: 'Pants',
  17: 'Head',
  18: 'Face',
  19: 'Gear',
  41: 'Hair',
  42: 'Face',
  43: 'Neck',
  44: 'Shoulder',
  45: 'Front',
  46: 'Back',
  47: 'Waist',
  57: 'Ear',
  58: 'Eye',
  64: 'T-Shirt',
  65: 'Shirt',
  66: 'Pants',
  67: 'Jacket',
  68: 'Sweater',
  69: 'Shorts',
  70: 'Left Shoe',
  71: 'Right Shoe',
  72: 'Skirt',
  73: 'Dress',
  76: 'Eyebrow',
  77: 'Eyelash',
  79: 'Head',
  // Non-avatar / development types (used for filtering only)
  1: 'Image',
  3: 'Audio',
  4: 'Mesh',
  5: 'Lua',
  6: 'HTML',
  7: 'Text',
  9: 'Place',
  10: 'Model',
  13: 'Decal',
  21: 'Badge',
  24: 'Animation',
  34: 'Gamepass',
  38: 'Plugin',
  40: 'MeshPart',
  48: 'AnimationAsset',
  49: 'AnimationAsset',
};

function assetTypeLabel(typeId: unknown): string | null {
  return typeof typeId === 'number' ? (ASSET_TYPE_LABELS[typeId] ?? null) : null;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRobloxHeaders(customHeaders?: HeadersInit) {
  const headers = new Headers(customHeaders);
  headers.set('User-Agent', 'AvatarsVercim/1.0');
  headers.set('x-api-key', ROBLOX_API_KEY);
  return headers;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function logApiError(message: string, meta: Record<string, unknown>, error: unknown) {
  console.error(`[api/user] ${message}`, meta, getErrorMessage(error));
}

async function readResponseBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.length > 1000 ? `${text.slice(0, 1000)}...` : text || '<empty body>';
  } catch (error) {
    return `<failed to read body: ${error instanceof Error ? error.message : String(error)}>`;
  }
}

async function timeoutFetch(url: string, options: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(
  url: string,
  options: RequestInit = {},
  includeApiKey = true,
  retries = 3
): Promise<Record<string, unknown>> {
  const headers = includeApiKey ? getRobloxHeaders(options.headers) : new Headers(options.headers);
  try {
    const res = await timeoutFetch(url, {
      ...options,
      headers,
    });

    if (res.status === 429 && retries > 0) {
      const retryAfter = res.headers.get('Retry-After');
      const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000;
      await delay(waitTime);
      return fetchJson(url, options, includeApiKey, retries - 1);
    }

    if (!res.ok) {
      const body = await readResponseBody(res);
      throw new Error(`HTTP ${res.status} ${body}`);
    }
    return res.json();
  } catch (error) {
    const name = (error as any)?.name;
    if ((name === 'AbortError' || name === 'FetchError') && retries > 0) {
      await delay(1000);
      return fetchJson(url, options, includeApiKey, retries - 1);
    }
    throw error;
  }
}

interface ItemDetails {
  name: string;
  price: number | null;
  assetType: string | null;
  description: string;
}

async function getItemDetails(assetId: number): Promise<ItemDetails> {
  try {
    const data = await fetchJson(`${ITEM_DETAILS_API}${assetId}/details`);
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

async function getThumbnailUrls(assetIds: number[]): Promise<Map<number, string>> {
  if (assetIds.length === 0) return new Map();

  const result = new Map<number, string>();
  const CHUNK_SIZE = 50; // max batch size for Roblox thumbnails API
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
      // fallback will be used
    }
  }

  // fallback for any missing: use direct asset-thumbnail URL
  for (const id of missing) {
    result.set(id, `https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=150&height=150&format=png`);
  }

  return result;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;

  const userInfoPromise = (async () => {
    try {
      const data = await fetchJson(`${USER_API}${userId}`);
      return {
        id: data.id as number,
        name: String(data.name ?? ''),
        displayName: String(data.displayName ?? ''),
        description: String(data.description ?? ''),
        created: String(data.created ?? ''),
        isBanned: Boolean(data.isBanned ?? false),
        externalAppDisplayName: data.externalAppDisplayName as string | null ?? null,
        hasVerifiedBadge: Boolean(data.hasVerifiedBadge ?? false),
      };
    } catch (error) {
      logApiError('Failed to load user info', { userId }, error);
      return null;
    }
  })();

  const thumbnailPromise = (async () => {
    try {
      const data = await fetchJson(
        `${THUMBNAIL_API}users/avatar?userIds=${userId}&size=720x720&format=png&isCircular=false`
      );
      const items = data.data as Array<{ imageUrl: string }> | undefined;
      if (items?.[0]?.imageUrl) return items[0].imageUrl;
    } catch (error) {
      logApiError('Failed to load avatar thumbnail', { userId }, error);
      // fallback below
    }
    // fallback: try without API key or with a public thumbnail path
    try {
      const data = await fetchJson(
        `${THUMBNAIL_API}users/avatar?userIds=${userId}&size=720x720&format=png&isCircular=false`
      );
      const items = data.data as Array<{ imageUrl: string }> | undefined;
      if (items?.[0]?.imageUrl) return items[0].imageUrl;
    } catch (error) {
      logApiError('Fallback failed for avatar thumbnail', { userId }, error);
      // fallback below
    }
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=720&height=720&format=png`;
  })();

  const headshotPromise = (async () => {
    try {
      const data = await fetchJson(
        `${THUMBNAIL_API}users/avatar-headshot?userIds=${userId}&size=720x720&format=png&isCircular=false`
      );
      const items = data.data as Array<{ imageUrl: string }> | undefined;
      if (items?.[0]?.imageUrl) return items[0].imageUrl;
    } catch (error) {
      logApiError('Failed to load avatar headshot', { userId }, error);
    }
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=720&height=720&format=png`;
  })();

  let wornAssets: number[] = [];
  try {
    const avatarData = await fetchJson(`${AVATAR_API}${userId}/avatar`);
    wornAssets = ((avatarData.assets ?? []) as Array<Record<string, unknown>>).map((a) => a.id as number);
  } catch (error) {
    logApiError('Failed to load avatar assets', { userId }, error);
    return NextResponse.json({ error: 'Failed to load avatar' }, { status: 502 });
  }

  await delay(200);

  let inventoryAssets: number[] = [];
  let inventoryAvailable = true;
  let inventoryError: string | null = null;

  try {
    // Open Cloud v2 inventory: assetId is nested under assetDetails and is a string.
    const cloudPromise = fetchJson(`${INVENTORY_CLOUD_API}${userId}/inventory-items?maxPageSize=100`, {}, true, 1);
    const cloudData = await Promise.race([cloudPromise, delay(2500).then(() => null)]);
    if (cloudData) {
      inventoryAssets = ((cloudData.inventoryItems ?? []) as Array<{ assetDetails?: { assetId?: string | number } }>)
        .map((item) => Number(item.assetDetails?.assetId))
        .filter((id) => Number.isFinite(id) && id > 0);
    } else {
      throw new Error('Cloud inventory timed out');
    }
  } catch (error) {
    logApiError('Failed to load inventory from cloud API', { userId }, error);
    try {
      const publicPromise = fetchJson(
        `https://inventory.roblox.com/v2/users/${userId}/inventory?assetTypes=8,18,19,21,41,42,43,44,45,46,47,48,49,50&limit=50`,
        {},
        false,
        1
      );
      const publicData = await Promise.race([publicPromise, delay(2000).then(() => null)]);
      if (publicData) {
        inventoryAssets = ((publicData.data ?? []) as Array<Record<string, unknown>>).map((item) => item.assetId as number);
      } else {
        throw new Error('Public inventory timed out');
      }
    } catch (fallbackError) {
      logApiError('Failed to load inventory from public API', { userId }, fallbackError);
      inventoryAvailable = false;
      inventoryError = getErrorMessage(fallbackError);
      // inventory is optional
    }
  }

  let allIds = [...new Set([...wornAssets, ...inventoryAssets])];
  const MAX_ASSETS = 50;
  if (allIds.length > MAX_ASSETS) {
    allIds = allIds.slice(0, MAX_ASSETS);
  }

  const [detailsMap, thumbnailMap] = await Promise.all([
    (async () => {
      const map = new Map<number, ItemDetails>();
      const CONCURRENCY = 5;
      let idx = 0;
      async function worker() {
        while (true) {
          const i = idx++;
          if (i >= allIds.length) return;
          const id = allIds[i];
          try {
            const details = await getItemDetails(id);
            map.set(id, details);
          } catch (error) {
            map.set(id, { name: `Item ${id}`, price: null, assetType: null, description: '' });
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, allIds.length) }, () => worker()));
      return map;
    })(),
    getThumbnailUrls(allIds),
  ]);

  const formatAsset = (id: number, worn: boolean) => {
    const det = detailsMap.get(id) ?? { name: `Item ${id}`, price: null, assetType: null, description: '' };
    return {
      assetId: id,
      name: det.name,
      price: det.price,
      assetType: det.assetType,
      description: det.description,
      thumbnailUrl: thumbnailMap.get(id) ?? `https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=150&height=150&format=png`,
      catalogUrl: `https://www.roblox.com/catalog/${id}`,
      worn,
    };
  };

  const wornItems = wornAssets.map((id: number) => formatAsset(id, true));
  const inventoryItems = inventoryAssets.map((id: number) =>
    formatAsset(id, wornAssets.includes(id))
  );

  const [userInfo, avatarThumbnail, avatarHeadshot] = await Promise.all([
    userInfoPromise,
    thumbnailPromise,
    headshotPromise,
  ]);

  return NextResponse.json({
    user: userInfo,
    avatarThumbnail,
    avatarHeadshot,
    wornItems,
    inventoryItems,
    inventoryAvailable,
    inventoryError,
  });
}
