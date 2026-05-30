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

const SEARCH_API = 'https://users.roblox.com/v1/users/search';
const USERNAMES_API = 'https://users.roblox.com/v1/usernames/users';
const ROBLOX_HEADERS = { 'User-Agent': 'AvatarsVercim/1.0' };
const RESULT_LIMIT = 10;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toSuggestion(row: RobloxSearchUser): UserSuggestion {
  return {
    id: row.id,
    name: row.name,
    displayName: row.displayName,
    hasVerifiedBadge: Boolean(row.hasVerifiedBadge),
  };
}

/**
 * Fuzzy relevance search. Public but heavily rate-limited, so we retry once on
 * 429 and degrade to an empty list rather than throwing.
 */
async function fuzzySearch(keyword: string, retries = 1): Promise<UserSuggestion[]> {
  try {
    const res = await fetch(
      `${SEARCH_API}?keyword=${encodeURIComponent(keyword)}&limit=${RESULT_LIMIT}`,
      { headers: ROBLOX_HEADERS },
    );

    if (res.status === 429 && retries > 0) {
      await delay(400);
      return fuzzySearch(keyword, retries - 1);
    }
    if (!res.ok) return [];

    const data = await res.json();
    const rows = (Array.isArray(data.data) ? data.data : []) as RobloxSearchUser[];
    return rows.map(toSuggestion);
  } catch {
    return [];
  }
}

/**
 * Exact username resolution. Reliable even when the fuzzy search is throttled,
 * so an exact username always surfaces (e.g. "Joe_Lakerov").
 */
async function exactLookup(keyword: string): Promise<UserSuggestion | null> {
  // Roblox usernames: 3-20 chars, letters/digits and at most one underscore.
  if (!/^[A-Za-z0-9_]{3,20}$/.test(keyword)) return null;

  try {
    const res = await fetch(USERNAMES_API, {
      method: 'POST',
      headers: { ...ROBLOX_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [keyword], excludeBannedUsers: false }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const row = (Array.isArray(data.data) ? data.data : [])[0] as RobloxSearchUser | undefined;
    return row ? toSuggestion(row) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword')?.trim() ?? '';

  if (keyword.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Run both lookups in parallel; neither can reject.
  const [exact, fuzzy] = await Promise.all([exactLookup(keyword), fuzzySearch(keyword)]);

  // Exact match first, then fuzzy results, de-duplicated by id.
  const seen = new Set<number>();
  const suggestions: UserSuggestion[] = [];
  for (const candidate of [exact, ...fuzzy]) {
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    suggestions.push(candidate);
    if (suggestions.length >= RESULT_LIMIT) break;
  }

  return NextResponse.json({ suggestions });
}
