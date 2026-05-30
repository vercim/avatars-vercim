'use client';
import { AssetInfo } from '@/types';
import TooltipCard from './TooltipCard';

export default function InventoryList({
  items,
  inventoryAvailable = true,
}: {
  items: AssetInfo[];
  inventoryAvailable?: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm text-center py-8">
        {inventoryAvailable
          ? 'Inventory is empty or private.'
          : 'Inventory is unavailable at the moment.'}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {items.map((item) => (
        <TooltipCard key={item.assetId} item={item} showWornBadge />
      ))}
    </div>
  );
}
