'use client';
import { AssetInfo } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function TooltipCard({ item, showWornBadge = false }: { item: AssetInfo; showWornBadge?: boolean }) {
  return (
    <a href={item.catalogUrl} target="_blank" rel="noopener noreferrer" className="block">
      <Card
        className="p-2 cursor-pointer hover:scale-105 transition-transform bg-secondary border-0 relative"
      >
        <img
          src={item.thumbnailUrl}
          alt={item.name}
          className="w-full aspect-square object-contain bg-muted rounded-md"
          loading="lazy"
        />
        <p className="text-xs mt-1 truncate text-foreground/80">{item.name}</p>
        {showWornBadge && item.worn && (
          <Badge variant="destructive" className="absolute top-1 right-1 text-[0.6rem] px-1 py-0">
            worn
          </Badge>
        )}
      </Card>
    </a>
  );
}
