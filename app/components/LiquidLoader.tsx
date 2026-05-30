'use client';

import { useEffect, useRef, useState } from 'react';

interface LiquidLoaderProps {
  label?: string;
  /** Rendered size of the liquid mass, in CSS pixels. */
  size?: number;
}

/** A single metaball orbiting the center of the field. */
interface Blob {
  /** Orbit radius as a fraction of the field radius. */
  orbit: number;
  /** Blob radius as a fraction of the field radius. */
  scale: number;
  /** Angular velocity, radians per second. */
  speed: number;
  /** Starting angle, radians. */
  phase: number;
  /** Secondary wobble frequency for the orbit radius. */
  wobble: number;
}

const BLOBS: readonly Blob[] = [
  { orbit: 0.26, scale: 0.3, speed: 0.9, phase: 0, wobble: 1.7 },
  { orbit: 0.32, scale: 0.26, speed: -0.7, phase: 2.1, wobble: 1.1 },
  { orbit: 0.22, scale: 0.28, speed: 1.15, phase: 4.0, wobble: 2.3 },
];

const TAU = Math.PI * 2;

/**
 * A living, monochromatic liquid loader driven entirely in TypeScript.
 *
 * Every frame, metaballs are positioned with real orbital math on a canvas and
 * a central core morphs its corner radius between a soft square and a full
 * circle while it rotates and breathes. All shapes share the page foreground
 * color and are fused into one liquid mass by an SVG alpha-threshold goo
 * filter, so the result reads as a single body of moving fluid rather than a
 * CSS animation of separate dots.
 */
export default function LiquidLoader({
  label = 'Loading avatar data...',
  size = 132,
}: LiquidLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const fieldRadius = size / 2;
    const center = size / 2;

    // Pull the live theme color so the loader stays monochromatic in light and
    // dark mode alike. Canvas accepts the raw oklch token directly.
    const fg =
      getComputedStyle(document.documentElement)
        .getPropertyValue('--foreground')
        .trim() || 'oklch(0.145 0 0)';

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const drawCircle = (x: number, y: number, r: number) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    };

    /** Draw the morphing core: a rounded square that liquefies into a circle. */
    const drawCore = (elapsed: number) => {
      const side = fieldRadius * 0.92;
      const breathe = 1 + Math.sin(elapsed * 1.3) * 0.06;
      const half = (side * breathe) / 2;
      // 0 → soft square, 1 → perfect circle, eased back and forth.
      const morph = (Math.sin(elapsed * 0.8) + 1) / 2;
      const radius = half * (0.26 + 0.74 * morph);

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(elapsed * 0.6);
      ctx.beginPath();
      ctx.roundRect(-half, -half, half * 2, half * 2, radius);
      ctx.fill();
      ctx.restore();
    };

    const render = (elapsed: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = fg;

      drawCore(elapsed);

      for (const blob of BLOBS) {
        const angle = blob.phase + elapsed * blob.speed;
        const orbit =
          fieldRadius * blob.orbit * (1 + Math.sin(elapsed * blob.wobble) * 0.25);
        const x = center + Math.cos(angle) * orbit;
        const y = center + Math.sin(angle) * orbit;
        const r = fieldRadius * blob.scale * (1 + Math.sin(elapsed * blob.wobble + 1) * 0.12);
        drawCircle(x, y, r);
      }
    };

    if (reduceMotion) {
      render(0);
      return;
    }

    let frame = 0;
    let start = 0;
    const loop = (now: number) => {
      if (!start) start = now;
      render((now - start) / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(frame);
  }, [size]);

  return (
    <div className="flex flex-col items-center justify-center gap-7 py-16">
      <canvas
        ref={canvasRef}
        className="liquid-canvas"
        style={{ width: size, height: size }}
        role="status"
        aria-label={label}
      />

      <p className="liquid-label text-sm text-muted-foreground">
        {label}
        {seconds > 0 && (
          <span className="ml-2 tabular-nums opacity-60">{seconds}s</span>
        )}
      </p>

      {/* Alpha-threshold goo filter — fuses overlapping shapes into one mass. */}
      <svg className="absolute size-0" aria-hidden="true">
        <defs>
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            />
          </filter>
        </defs>
      </svg>
    </div>
  );
}
