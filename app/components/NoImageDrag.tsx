'use client';

import { useEffect } from 'react';

/**
 * Globally suppress native image dragging. CSS `-webkit-user-drag` covers
 * Chrome/Safari; this dragstart guard also covers Firefox, where images are
 * draggable by default and ignore that property.
 */
export default function NoImageDrag() {
  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      if (e.target instanceof Element && e.target.tagName === 'IMG') {
        e.preventDefault();
      }
    };
    document.addEventListener('dragstart', onDragStart);
    return () => document.removeEventListener('dragstart', onDragStart);
  }, []);

  return null;
}
