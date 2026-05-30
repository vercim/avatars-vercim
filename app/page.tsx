'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { UserData } from '@/types';
import SearchBar from '@/components/SearchBar';
import SearchHintArrow from '@/components/SearchHintArrow';
import AvatarMark from '@/components/AvatarMark';
import UserProfile from '@/components/UserProfile';
import Avatar3D from '@/components/Avatar3D';
import AccessoriesGrid from '@/components/AccessoriesGrid';
import InventoryList from '@/components/InventoryList';
import LiquidLoader from '@/components/LiquidLoader';
import { getSearchStatus, recordSearch } from '@/lib/searchRateLimit';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fetchWithTimeout = async (
  input: RequestInfo,
  init: RequestInit | undefined,
  timeoutMs = 60000
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export default function Home() {
  const [userId, setUserId] = useState('2254875642');
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUser = useCallback(async (id: string) => {
    // Throttled — the Search button surfaces the countdown, so just bail.
    if (!getSearchStatus().allowed) return;

    recordSearch();
    setLoading(true);
    setError('');
    try {
      const res = await fetchWithTimeout(`/api/user/${id}`, undefined, 60000);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 502) {
          throw new Error(
            'Failed to fetch data from Roblox. This may happen when Roblox is blocked in your country or your VPN is not enabled. Try turning on a VPN or checking your network settings.'
          );
        }
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const userData: UserData = await res.json();
      if (!userData.user) throw new Error('User not found');
      setData(userData);
      setUserId(id);
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        setError('Request timed out after 1 minute. Please try again later or check your network connection.');
      } else {
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const isLoading = loading;
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setError(customEvent.detail);
    };
    window.addEventListener('search-error', handler);
    return () => window.removeEventListener('search-error', handler);
  }, [loadUser]);

  // Reflect the resolved user in the document title.
  useEffect(() => {
    const displayName = data?.user.displayName;
    document.title = displayName ? `Avatars / ${displayName}` : 'Avatars';
    return () => {
      document.title = 'Avatars';
    };
  }, [data]);

  return (
    <div className="min-h-screen">
      <main className="max-w-5xl mx-auto w-full px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <section className="flex flex-col items-center text-center gap-3">
          <h1 className="leading-none">
            <span className="sr-only">avatars.verc.im</span>
            <AvatarMark className="size-9 sm:size-11 text-foreground cursor-pointer" />
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Enter a username or user ID to see their avatar and inventory
          </p>
        </section>

        <SearchBar onSearch={loadUser} loading={isLoading} buttonRef={searchButtonRef} />

        {!data && !isLoading && !error && (
          <SearchHintArrow targetRef={searchButtonRef} />
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && <LiquidLoader />}

        {data && !isLoading && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div className="space-y-4">
                <Avatar3D key={userId} userId={userId} thumbnailUrl={data.avatarThumbnail} />
              </div>
              <div className="space-y-4">
                <UserProfile user={data.user} headshotUrl={data.avatarHeadshot} />

                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span>Equipped ({data.wornItems.length})</span>
                      {(() => {
                        const total = data.wornItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
                        return total > 0 ? (
                          <span className="text-sm font-normal text-muted-foreground">
                            · {total.toLocaleString('en-US')} Robux
                          </span>
                        ) : null;
                      })()}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <AccessoriesGrid items={data.wornItems} />
                  </CardContent>
                </Card>
              </div>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Inventory ({data.inventoryItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <InventoryList items={data.inventoryItems} />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
