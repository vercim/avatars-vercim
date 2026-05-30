import { NextResponse } from 'next/server';
import {
  USER_API, AVATAR_API, THUMBNAIL_API,
  fetchJson, logApiError, delay,
  getThumbnailUrls, fetchItemDetailsPage,
} from '@/lib/roblox';

export const revalidate = 60;

export async function GET(
  _request: Request,
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
        externalAppDisplayName: (data.externalAppDisplayName as string | null) ?? null,
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

  const [detailsMap, thumbnailMap, userInfo, avatarThumbnail, avatarHeadshot] = await Promise.all([
    fetchItemDetailsPage(wornAssets),
    getThumbnailUrls(wornAssets),
    userInfoPromise,
    thumbnailPromise,
    headshotPromise,
  ]);

  const wornItems = wornAssets.map((id) => {
    const det = detailsMap.get(id) ?? { name: `Item ${id}`, price: null, assetType: null, description: '' };
    return {
      assetId: id,
      name: det.name,
      price: det.price,
      assetType: det.assetType,
      description: det.description,
      thumbnailUrl: thumbnailMap.get(id) ?? `https://www.roblox.com/asset-thumbnail/image?assetId=${id}&width=150&height=150&format=png`,
      catalogUrl: `https://www.roblox.com/catalog/${id}`,
      worn: true,
    };
  });

  return NextResponse.json({ user: userInfo, avatarThumbnail, avatarHeadshot, wornItems });
}
