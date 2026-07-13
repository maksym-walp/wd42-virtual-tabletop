import { useRef, useState } from 'react';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Pan (mouse-drag or single-finger touch) + zoom (wheel or two-finger pinch)
// for an SVG <g transform="translate(x,y) scale(k)"> canvas. Shared between
// SkillTree.jsx and CharacterSheet.jsx's TreeTab, which each render their own
// node/edge markup on top and only delegate the pan/zoom half of the gesture
// handling here.
export default function useSvgPanZoom({ initial, minK = 0.2, maxK = 2.5 }) {
  const [transform, setTransform] = useState(initial);
  const pointers = useRef(new Map()); // pointerId -> {x, y} in client coords
  const panStart = useRef(null); // {x, y} offset for single-pointer pan
  const pinchStart = useRef(null); // {distance, midpoint, transform} snapshot

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      panStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      panStart.current = null;
      const [p1, p2] = [...pointers.current.values()];
      pinchStart.current = { distance: dist(p1, p2), midpoint: mid(p1, p2), transform };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [p1, p2] = [...pointers.current.values()];
      const start = pinchStart.current;
      const scale = dist(p1, p2) / start.distance;
      const newK = Math.min(maxK, Math.max(minK, start.transform.k * scale));
      const factor = newK / start.transform.k;
      const midpoint = mid(p1, p2);
      // Keep the world point under the fingers fixed as they move/pinch.
      setTransform({
        k: newK,
        x: midpoint.x - (start.midpoint.x - start.transform.x) * factor,
        y: midpoint.y - (start.midpoint.y - start.transform.y) * factor,
      });
      return;
    }

    if (pointers.current.size === 1 && panStart.current) {
      const p = pointers.current.values().next().value;
      const start = panStart.current;
      setTransform((t) => ({ ...t, x: p.x - start.x, y: p.y - start.y }));
    }
  };

  const endPointer = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 1) {
      const p = pointers.current.values().next().value;
      panStart.current = { x: p.x - transform.x, y: p.y - transform.y };
      pinchStart.current = null;
    } else if (pointers.current.size === 0) {
      panStart.current = null;
      pinchStart.current = null;
    }
  };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, k: Math.min(maxK, Math.max(minK, t.k * factor)) }));
  };

  return {
    transform,
    setTransform,
    bind: { onPointerDown, onPointerMove, onPointerUp: endPointer, onPointerCancel: endPointer, onWheel },
  };
}
