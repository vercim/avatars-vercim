'use client';
import { AssetInfo } from '@/types';
import TooltipCard from './TooltipCard';
import { Spinner } from './ui/spinner';

interface InventoryListProps {
  items: AssetInfo[];
  available?: boolean;
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function InventoryList({
  items,
  available = true,
  loading = false,
  hasMore = false,
  onLoadMore,
}: InventoryListProps) {
  if (!loading && items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        {available ? 'Inventory is empty or private.' : 'Inventory is unavailable at the moment.'}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {items.map((item) => (
          <TooltipCard key={item.assetId} item={item} showWornBadge />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <Spinner className="size-5" />
        </div>
      )}

      {!loading && hasMore && onLoadMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={onLoadMore}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-md border border-border hover:border-foreground/30"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
