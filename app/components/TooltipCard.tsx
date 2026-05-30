'use client';
import { useRef, useState } from 'react';
import { TextMorph } from 'torph/react';
import { AssetInfo } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const MAX_ROTATE_X = 10;
const MAX_ROTATE_Y = 12;
const MAX_SCALE = 1.06;

function formatPrice(price: number | null): string {
  if (price === null) return 'Off-sale';
  if (price === 0) return 'Free';
  return `${price.toLocaleString('en-US')} R$`;
}

/** Hover label: "Hair · 250 R$" — type and price, gracefully degrading. */
function formatHoverLabel(item: AssetInfo): string {
  const price = formatPrice(item.price);
  return item.assetType ? `${item.assetType} · ${price}` : price;
}

export default function TooltipCard({ item, showWornBadge = false }: { item: AssetInfo; showWornBadge?: boolean }) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingTransform = useRef('rotateX(0deg) rotateY(0deg) scale(1)');
  const [hovered, setHovered] = useState(false);

  const label = hovered ? formatHoverLabel(item) : item.name;
  const [imgError, setImgError] = useState(false);

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

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modifier/middle clicks (new tab, etc.) natively.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();

    // Open the catalog in a new tab, but keep focus on this page.
    const opened = window.open(item.catalogUrl, '_blank', 'noopener,noreferrer');
    if (opened) {
      opened.blur();
      window.focus();
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
    setHovered(false);
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
      className="block relative will-change-transform"
      style={{ perspective: 1000 }}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Card
        ref={cardRef}
        className="relative overflow-hidden p-2 cursor-pointer bg-secondary border-0 transition-transform duration-150 ease-out will-change-transform"
        style={{ transform: 'rotateX(0deg) rotateY(0deg) scale(1)' }}
      >
        {imgError ? (
          <div className="w-full aspect-square flex items-center justify-center bg-muted rounded-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8 text-muted-foreground/40"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <circle cx="9" cy="9" r="2" />
              <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
          </div>
        ) : (
          <img
            src={item.thumbnailUrl}
            alt={item.name}
            className="w-full aspect-square object-contain bg-muted rounded-md"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        )}
        <p className="text-xs mt-1 text-foreground/80 truncate">
          <TextMorph as="span" className="tabular-nums" ease={{ stiffness: 200, damping: 22 }}>
            {label}
          </TextMorph>
        </p>
        {showWornBadge && item.worn && (
          <Badge variant="destructive" className="absolute top-1 right-1 text-[0.6rem] px-1 py-0">
            worn
          </Badge>
        )}
      </Card>
    </a>
  );
}
