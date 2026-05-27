import { NextResponse } from 'next/server';

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ROBLOX_API_KEY) {
  console.error('[api/avatar-3d] ROBLOX_API_KEY environment variable is missing');
  throw new Error('ROBLOX_API_KEY environment variable is required');
}

function getHashUrl(hash: string): string {
  let st = 31;
  for (let ii = 0; ii < hash.length; ii++) {
    st ^= hash[ii].charCodeAt(0);
  }
  return `https://t${(st % 8).toString()}.rbxcdn.com/${hash}`;
}

function getCdnHost(hash: string): string {
  let st = 31;
  for (let ii = 0; ii < hash.length; ii++) {
    st ^= hash[ii].charCodeAt(0);
  }
  return `https://t${(st % 8).toString()}.rbxcdn.com/`;
}

async function tryThumbnailApi(userId: string) {
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'x-api-key': ROBLOX_API_KEY as string,
    };

    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-3d?userId=${userId}`, { headers });
    if (!res.ok) {
      console.error('[api/avatar-3d] Thumbnail API returned non-ok status', { userId, status: res.status });
      return null;
    }

    const { imageUrl } = await res.json() as { imageUrl: string };
    if (!imageUrl) return null;

    const metaRes = await fetch(imageUrl);
    if (!metaRes.ok) {
      console.error('[api/avatar-3d] Failed to fetch thumbnail metadata URL', { userId, status: metaRes.status });
      return null;
    }

    const metadata = await metaRes.json() as {
      obj: string; mtl: string; textures: string[];
      aabb: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } };
      camera: { position: { x: number; y: number; z: number }; fov: number };
    };

    return {
      objUrl: getHashUrl(metadata.obj),
      mtlUrl: getHashUrl(metadata.mtl),
      textureUrl: metadata.textures?.[0] ? getHashUrl(metadata.textures[0]) : null,
      textureCdnHost: metadata.textures?.[0] ? getCdnHost(metadata.textures[0]) : null,
      aabb: metadata.aabb,
      cameraFov: metadata.camera.fov,
    };
  } catch (error) {
    console.error('[api/avatar-3d] Failed to load 3D avatar metadata', { userId }, error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;

  const result = await tryThumbnailApi(userId);

  if (!result) {
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({ available: true, ...result });
}
