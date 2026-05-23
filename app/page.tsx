'use client';
import { useState, useEffect, useCallback } from 'react';
import { UserData } from '@/types';
import SearchBar from '@/components/SearchBar';
import UserProfile from '@/components/UserProfile';
import Avatar3D from '@/components/Avatar3D';
import AccessoriesGrid from '@/components/AccessoriesGrid';
import InventoryList from '@/components/InventoryList';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Home() {
  const [userId, setUserId] = useState('2254875642');
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadUser = useCallback(async (id: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user/${id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const userData: UserData = await res.json();
      if (!userData.user) throw new Error('User not found');
      setData(userData);
      setUserId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const isLoading = loading;

  useEffect(() => {
    loadUser('2254875642'); // eslint-disable-line react-hooks/set-state-in-effect
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      setError(customEvent.detail);
    };
    window.addEventListener('search-error', handler);
    return () => window.removeEventListener('search-error', handler);
  }, [loadUser]);

  return (
    <div className="min-h-screen">
      <main className="max-w-5xl mx-auto w-full px-4 py-8 space-y-8">
        <section className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">avatars.verc.im</h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Enter a username or user ID to see their avatar and inventory
          </p>
        </section>

        <SearchBar onSearch={loadUser} loading={isLoading} />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-6 py-16">
            <Spinner className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading avatar data...</p>
          </div>
        )}

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
                    <CardTitle>Equipped ({data.wornItems.length})</CardTitle>
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
