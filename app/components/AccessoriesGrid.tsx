'use client';
import { AssetInfo } from '@/types';
import TooltipCard from './TooltipCard';

export default function AccessoriesGrid({ items }: { items: AssetInfo[] }) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm text-center py-8">No equipped accessories</p>;
  }

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <TooltipCard key={item.assetId} item={item} />
      ))}
    </div>
  );
}
