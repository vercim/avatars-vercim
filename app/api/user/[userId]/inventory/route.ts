import { NextResponse } from 'next/server';
import {
  INVENTORY_CLOUD_API,
  fetchJson, logApiError,
  getThumbnailUrls, fetchItemDetailsPage,
  OUTFIT_ASSET_TYPES,
} from '@/lib/roblox';

export const revalidate = 60;

export const PAGE_SIZE = 24;

async function fetchAllInventoryIds(userId: string): Promise<{ ids: number[]; available: boolean }> {
  try {
    const cloudPromise = fetchJson(
      `${INVENTORY_CLOUD_API}${userId}/inventory-items?maxPageSize=200`,
      {},
      true,
      1
    );
    const cloudData = await Promise.race([
      cloudPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);

    if (cloudData) {
      const ids = ((cloudData.inventoryItems ?? []) as Array<{ assetDetails?: { assetId?: string | number } }>)
        .map((item) => Number(item.assetDetails?.assetId))
        .filter((id) => Number.isFinite(id) && id > 0);
      return { ids, available: true };
    }
  } catch (error) {
    logApiError('Cloud inventory failed', { userId }, error);
  }

  try {
    const publicPromise = fetchJson(
      `https://inventory.roblox.com/v2/users/${userId}/inventory?assetTypes=8,18,19,21,41,42,43,44,45,46,47,48,49,50&limit=100`,
      {},
      false,
      1
    );
    const publicData = await Promise.race([
      publicPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);

    if (publicData) {
      const ids = ((publicData.data ?? []) as Array<Record<string, unknown>>).map(
        (item) => item.assetId as number
      );
      return { ids, available: true };
    }
  } catch (error) {
    logApiError('Public inventory failed', { userId }, error);
  }

  return { ids: [], available: false };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const page = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10));

  const { ids: allIds, available } = await fetchAllInventoryIds(userId);

  if (!available) {
    return NextResponse.json({ items: [], hasMore: false, total: 0, available: false });
  }

  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageIds = allIds.slice(start, end);

  if (pageIds.length === 0) {
    return NextResponse.json({ items: [], hasMore: false, total: allIds.length, available: true });
  }

  const [detailsMap, thumbnailMap] = await Promise.all([
    fetchItemDetailsPage(pageIds),
    getThumbnailUrls(pageIds),
  ]);

  const items = pageIds
    .map((id) => {
      const det = detailsMap.get(id) ?? { name: `Item ${id}`, price: null, assetType: null, description: '' };
      return {
        assetId: id,
        name: det.name,
        price: det.price,
        assetType: det.assetType,
        description: det.description,
        thumbnailUrl:
          thumbnailMap.get(id) ??
          `https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=150&height=150&format=png`,
        catalogUrl: `https://www.roblox.com/catalog/${id}`,
        worn: false,
      };
    })
    .filter((item) => item.assetType !== null && OUTFIT_ASSET_TYPES.has(item.assetType) && !item.name.startsWith(`Item ${item.assetId}`));

  return NextResponse.json({
    items,
    hasMore: end < allIds.length,
    total: allIds.length,
    available: true,
  });
}
