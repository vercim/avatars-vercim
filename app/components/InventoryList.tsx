'use client';
import { AssetInfo } from '@/types';
import TooltipCard from './TooltipCard';

export default function InventoryList({ items }: { items: AssetInfo[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">Inventory is empty or private</p>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {items.map((item) => (
        <TooltipCard key={item.assetId} item={item} showWornBadge />
      ))}
    </div>
  );
}
