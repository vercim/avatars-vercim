'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

interface SearchHintArrowProps {
  /** The element the arrow tip should always point at. */
  targetRef: RefObject<HTMLButtonElement | null>;
}

// Geometry of public/drawn_arrow.svg.
const ARROW_VIEW_W = 359.52468125115774;
const ARROW_VIEW_H = 445.8232948673576;
const ARROW_RATIO = ARROW_VIEW_H / ARROW_VIEW_W;
// Where the arrowhead tip sits inside the SVG, as a fraction of its box.
const TIP_FRAC_X = 0.668;
const TIP_FRAC_Y = 0.02;
// Rendered widths per breakpoint and the gap between tip and the button.
const WIDTH_MOBILE = 132;
const WIDTH_DESKTOP = 196;
const MOBILE_MAX_WIDTH = 640;
const TIP_GAP = 30;

interface ArrowPos {
  left: number;
  top: number;
  width: number;
}

/**
 * Decorative hand-drawn arrow whose tip is positioned, every layout, directly
 * under the Search button. It measures the live button rect instead of relying
 * on fixed margins, so it stays locked on target across all screen sizes.
 */
export default function SearchHintArrow({ targetRef }: SearchHintArrowProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<ArrowPos | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const compute = () => {
      const button = targetRef.current;
      if (!button) return;

      const hostRect = host.getBoundingClientRect();
      const btnRect = button.getBoundingClientRect();

      const width =
        window.innerWidth < MOBILE_MAX_WIDTH ? WIDTH_MOBILE : WIDTH_DESKTOP;
      const height = width * ARROW_RATIO;

      // Desired tip position, just below the button center, in host coords.
      const tipX = btnRect.left + btnRect.width / 2 - hostRect.left;
      const tipY = btnRect.bottom + TIP_GAP - hostRect.top;

      setPos({
        left: tipX - TIP_FRAC_X * width,
        top: tipY - TIP_FRAC_Y * height,
        width,
      });
    };

    compute();
    // Re-measure once layout/fonts settle, and on every resize.
    const settle = window.setTimeout(compute, 120);
    window.addEventListener('resize', compute);

    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('resize', compute);
    };
  }, [targetRef]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="relative min-h-44 sm:min-h-56"
    >
      {pos && (
        <img
          src="/drawn_arrow.svg"
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none [-webkit-user-drag:none]"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
        />
      )}
    </div>
  );
}
