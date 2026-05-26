import { NextResponse } from 'next/server';

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;

if (!ROBLOX_API_KEY) {
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
    if (!res.ok) return null;

    const { imageUrl } = await res.json() as { imageUrl: string };
    if (!imageUrl) return null;

    const metaRes = await fetch(imageUrl);
    if (!metaRes.ok) return null;

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
  } catch {
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
