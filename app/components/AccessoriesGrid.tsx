'use client';
import { AssetInfo } from '@/types';
import TooltipCard from './TooltipCard';

export default function AccessoriesGrid({ items }: { items: AssetInfo[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No equipped accessories</p>;
  }

  return (
    <div className="p-1.5 grid grid-cols-3 sm:grid-cols-4 gap-4 max-h-[280px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      {items.map((item) => (
        <TooltipCard key={item.assetId} item={item} />
      ))}
    </div>
  );
}
