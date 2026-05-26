import { NextResponse } from 'next/server';

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ROBLOX_API_KEY) {
  throw new Error('ROBLOX_API_KEY environment variable is required');
}

const USER_API = 'https://users.roblox.com/v1/users/';
const AVATAR_API = 'https://avatar.roblox.com/v1/users/';
const ITEM_DETAILS_API = 'https://economy.roblox.com/v2/assets/';
const INVENTORY_CLOUD_API = 'https://apis.roblox.com/cloud/v2/users/';
const THUMBNAIL_API = 'https://thumbnails.roblox.com/v1/';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRobloxHeaders(customHeaders: Record<string, string> = {}) {
  return {
    'User-Agent': 'AvatarsVercim/1.0',
    'x-api-key': ROBLOX_API_KEY,
    ...customHeaders,
  };
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

async function fetchJson(url: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
  const res = await timeoutFetch(url, {
    ...options,
    headers: getRobloxHeaders({ ...(options.headers as Record<string, string> | undefined) }),
  });

  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After');
    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 3000;
    await delay(waitTime);
    return fetchJson(url, options);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

async function getItemDetails(assetId: number): Promise<{ name: string; price: number | null; description: string }> {
  try {
    const data = await fetchJson(`${ITEM_DETAILS_API}${assetId}/details`);
    return {
      name: String(data.Name ?? `Item ${assetId}`),
      price: typeof data.PriceInRobux === 'number' ? data.PriceInRobux : data.IsFree ? 0 : null,
      description: String(data.Description ?? ''),
    };
  } catch {
    return { name: `Item ${assetId}`, price: null, description: '' };
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
        `${THUMBNAIL_API}assets?assetIds=${idsParam}&size=150x150&format=png&isCircular=false`,
        { headers: { 'x-api-key': ROBLOX_API_KEY } }
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
    } catch {
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
    } catch {
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
    } catch {
      // fallback below
    }
    // fallback: try without API key or with a public thumbnail path
    try {
      const data = await fetchJson(
        `${THUMBNAIL_API}users/avatar?userIds=${userId}&size=720x720&format=png&isCircular=false`
      );
      const items = data.data as Array<{ imageUrl: string }> | undefined;
      if (items?.[0]?.imageUrl) return items[0].imageUrl;
    } catch {
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
    } catch {
      // fallback below
    }
    try {
      const data = await fetchJson(
        `${THUMBNAIL_API}users/avatar-headshot?userIds=${userId}&size=720x720&format=png&isCircular=false`
      );
      const items = data.data as Array<{ imageUrl: string }> | undefined;
      if (items?.[0]?.imageUrl) return items[0].imageUrl;
    } catch {
      // fallback below
    }
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=720&height=720&format=png`;
  })();

  let wornAssets: number[] = [];
  try {
    const avatarData = await fetchJson(`${AVATAR_API}${userId}/avatar`);
    wornAssets = ((avatarData.assets ?? []) as Array<Record<string, unknown>>).map((a) => a.id as number);
  } catch {
    return NextResponse.json({ error: 'Failed to load avatar' }, { status: 502 });
  }

  await delay(200);

  let inventoryAssets: number[] = [];
  try {
    const cloudData = await fetchJson(`${INVENTORY_CLOUD_API}${userId}/inventory?limit=50`);
    inventoryAssets = ((cloudData.inventoryItems ?? []) as Array<Record<string, unknown>>)
      .map((item) => item.assetId as number)
      .filter(Boolean);
  } catch {
    try {
      const publicData = await fetchJson(
        `https://inventory.roblox.com/v2/users/${userId}/inventory?assetTypes=8,18,19,21,41,42,43,44,45,46,47,48,49,50&limit=50`
      );
      inventoryAssets = ((publicData.data ?? []) as Array<Record<string, unknown>>).map((item) => item.assetId as number);
    } catch {
      // inventory is optional
    }
  }

  const allIds = [...new Set([...wornAssets, ...inventoryAssets])];

  const [detailsMap, thumbnailMap] = await Promise.all([
    (async () => {
      const map = new Map<number, { name: string; price: number | null; description: string }>();
      for (const id of allIds) {
        const details = await getItemDetails(id);
        map.set(id, details);
        await delay(30);
      }
      return map;
    })(),
    getThumbnailUrls(allIds),
  ]);

  const formatAsset = (id: number, worn: boolean) => {
    const det = detailsMap.get(id) ?? { name: `Item ${id}`, price: null, description: '' };
    return {
      assetId: id,
      name: det.name,
      price: det.price,
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
  });
}
