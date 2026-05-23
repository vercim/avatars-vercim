'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

interface Props {
  onSearch: (userId: string) => void;
  loading: boolean;
}

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export default function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState('2254875642');
  const [resolving, setResolving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    if (isNumeric(trimmed)) {
      onSearch(trimmed);
      return;
    }

    setResolving(true);
    try {
      const res = await fetch('/api/resolve-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'User not found');
      }
      const data = await res.json();
      onSearch(String(data.userId));
    } catch (e) {
      const event = new CustomEvent('search-error', { detail: e instanceof Error ? e.message : 'User not found' });
      window.dispatchEvent(event);
    } finally {
      setResolving(false);
    }
  };

  const isBusy = loading || resolving;

  return (
    <form onSubmit={handleSubmit} className="flex justify-center gap-2 max-w-md mx-auto">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Username or user ID..."
          className="pl-9 h-10"
        />
      </div>
      <Button type="submit" disabled={isBusy} className="h-10">
        {isBusy ? 'Searching...' : 'Search'}
      </Button>
    </form>
  );
}
