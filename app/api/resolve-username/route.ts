import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let username: string | null = null;
  try {
    const payload = await request.json();
    username = typeof payload.username === 'string' ? payload.username : null;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'AvatarsVercim/1.0' },
      body: JSON.stringify({ usernames: [username.trim()], excludeBannedUsers: true }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to resolve username' }, { status: res.status });
    }

    const data = await res.json();

    if (!data.data || data.data.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ userId: data.data[0].id, displayName: data.data[0].displayName });
  } catch (error) {
    console.error('[api/resolve-username] Failed to resolve username', { username }, error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
