'use client';
import { useEffect, useRef, useState, type Ref } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, BadgeCheck } from 'lucide-react';
import type { UserSuggestion } from '@/api/search-users/route';

interface Props {
  onSearch: (userId: string) => void;
  loading: boolean;
  /** Forwarded to the submit button so external UI can point at it. */
  buttonRef?: Ref<HTMLButtonElement>;
}

const SUGGEST_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export default function SearchBar({ onSearch, loading, buttonRef }: Props) {
  const [value, setValue] = useState('2254875642');
  const [resolving, setResolving] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Used to ignore stale autocomplete responses that resolve out of order.
  const requestIdRef = useRef(0);
  // Set right after a selection so the value-change effect doesn't re-open the list.
  const skipNextSuggestRef = useRef(false);

  // Debounced username suggestions.
  useEffect(() => {
    const trimmed = value.trim();

    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false;
      return;
    }

    if (trimmed.length < MIN_QUERY_LENGTH || isNumeric(trimmed)) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-users?keyword=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: { suggestions: UserSuggestion[] } = await res.json();
        if (requestId !== requestIdRef.current) return; // stale response
        setSuggestions(data.suggestions);
        setActiveIndex(-1);
        setOpen(data.suggestions.length > 0);
      } catch {
        // aborted or network error — ignore, keep current state
      }
    }, SUGGEST_DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [value]);

  // Close the dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (suggestion: UserSuggestion) => {
    skipNextSuggestRef.current = true;
    setValue(suggestion.name);
    setSuggestions([]);
    setOpen(false);
    setActiveIndex(-1);
    onSearch(String(suggestion.id));
  };

  const resolveByUsername = async (username: string) => {
    setResolving(true);
    try {
      const res = await fetch('/api/resolve-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'User not found');
      }
      const data = await res.json();
      onSearch(String(data.userId));
    } catch (e) {
      const event = new CustomEvent('search-error', {
        detail: e instanceof Error ? e.message : 'User not found',
      });
      window.dispatchEvent(event);
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    // If a suggestion is highlighted, pick it.
    if (open && activeIndex >= 0 && activeIndex < suggestions.length) {
      selectSuggestion(suggestions[activeIndex]);
      return;
    }

    setOpen(false);

    if (isNumeric(trimmed)) {
      onSearch(trimmed);
      return;
    }

    // Prefer an exact username match from the current suggestions.
    const exact = suggestions.find((s) => s.name.toLowerCase() === trimmed.toLowerCase());
    if (exact) {
      selectSuggestion(exact);
      return;
    }

    await resolveByUsername(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const isBusy = loading || resolving;

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto">
      <div className="flex justify-center gap-2">
        <div ref={containerRef} className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Username or user ID..."
            className="pl-9 h-10"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />

          {open && suggestions.length > 0 && (
            <ul
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
              role="listbox"
            >
              {suggestions.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    // onMouseDown fires before the input blur, so selection isn't lost.
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectSuggestion(s);
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      @{s.name}
                      {s.hasVerifiedBadge && <BadgeCheck className="size-3.5 shrink-0 text-sky-500" />}
                    </span>
                    {s.displayName && s.displayName !== s.name && (
                      <span className="truncate text-xs text-muted-foreground">{s.displayName}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Button ref={buttonRef} type="submit" disabled={isBusy} className="h-10 cursor-pointer">
          {isBusy ? 'Searching...' : 'Search'}
        </Button>
      </div>
    </form>
  );
}
