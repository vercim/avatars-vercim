'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';


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

// Gap between the spark and the arrow.
const SPARK_GAP = 26;

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
  const rafRef = useRef<number | null>(null);
  const [pos, setPos] = useState<ArrowPos | null>(null);

  // Callback ref fires the moment the element enters/leaves the DOM —
  // unlike useRef+useEffect which misses the mount because pos starts null.
  const sparkCallbackRef = useCallback((el: HTMLImageElement | null) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const y = -5  * Math.sin(t * 1.1) - 1.5 * Math.sin(t * 2.3 + 0.8);
      const x =  3  * Math.sin(t * 0.7 + 0.4) + 1 * Math.sin(t * 1.9 + 1.2);
      const s = 1 + 0.03 * Math.sin(t * 0.9 + 0.6) + 0.01 * Math.sin(t * 2.1);
      const r = 2.5 * Math.sin(t * 0.5 + 0.3) + 1 * Math.sin(t * 1.7);
      el.style.transform =
        `translate(${x.toFixed(2)}px,${y.toFixed(2)}px) ` +
        `scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

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

  const sparkPos = pos
    ? { left: pos.left - pos.width - SPARK_GAP, top: pos.top + 60 }
    : null;

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
      {sparkPos && (
        <img
          ref={sparkCallbackRef}
          src="/drawn_spark.svg"
          alt=""
          draggable={false}
          className="pointer-events-none absolute select-none [-webkit-user-drag:none]"
          style={{ left: sparkPos.left, top: sparkPos.top, width: pos!.width }}
        />
      )}
    </div>
  );
}
