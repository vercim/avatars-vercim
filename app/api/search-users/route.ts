import { NextResponse } from 'next/server';

interface RobloxSearchUser {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge?: boolean;
}

export interface UserSuggestion {
  id: number;
  name: string;
  displayName: string;
  hasVerifiedBadge: boolean;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword')?.trim() ?? '';

  if (keyword.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const res = await fetch(
      `https://users.roblox.com/v1/users/search?keyword=${encodeURIComponent(keyword)}&limit=10`,
      { headers: { 'User-Agent': 'AvatarsVercim/1.0' } }
    );

    if (!res.ok) {
      return NextResponse.json({ suggestions: [] }, { status: res.status });
    }

    const data = await res.json();
    const rows = (Array.isArray(data.data) ? data.data : []) as RobloxSearchUser[];

    const suggestions: UserSuggestion[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      hasVerifiedBadge: Boolean(row.hasVerifiedBadge),
    }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('[api/search-users] Failed to search users', { keyword }, error instanceof Error ? error.message : String(error));
    return NextResponse.json({ suggestions: [] }, { status: 500 });
  }
}
