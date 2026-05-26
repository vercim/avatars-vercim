'use client';
import { useRef } from 'react';
import { AssetInfo } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const MAX_ROTATE_X = 10;
const MAX_ROTATE_Y = 12;
const MAX_SCALE = 1.13;

export default function TooltipCard({ item, showWornBadge = false }: { item: AssetInfo; showWornBadge?: boolean }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingTransform = useRef('rotateX(0deg) rotateY(0deg) scale(1)');

  const updateTransform = (transform: string) => {
    pendingTransform.current = transform;
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        if (cardRef.current) {
          cardRef.current.style.transform = pendingTransform.current;
        }
        frameRef.current = null;
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 2 * MAX_ROTATE_Y * -1;
    const rotateX = (y - 0.5) * 2 * MAX_ROTATE_X;
    updateTransform(`rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale(${MAX_SCALE})`);
  };

  const handleMouseLeave = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    updateTransform('rotateX(0deg) rotateY(0deg) scale(1)');
  };

  return (
    <a
      href={item.catalogUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      style={{ perspective: 1000 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Card
        ref={cardRef}
        className="p-2 cursor-pointer transition-transform duration-150 ease-out will-change-transform bg-secondary border-0 relative z-1"
        style={{
          transform: 'rotateX(0deg) rotateY(0deg) scale(1)',
          transformStyle: 'preserve-3d',
        }}
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
