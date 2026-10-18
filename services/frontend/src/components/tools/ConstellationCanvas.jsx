import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import useSvgPanZoom from '../../hooks/useSvgPanZoom';
import { computeFitTransform, straightEdgePath } from '../../utils/skillTreeLayout';
import { STAR_LEVELS } from '../../utils/constellation';

const DRAG_CLICK_THRESHOLD_PX = 5;
const STAR_HIT_R = 18; // зона кліку більша за саму зірку — для пальця
const LINE_GAP = 4;    // лінія не доходить до краю зірки

// Нічне небо: використовується і в редакторі, і в режимі перегляду.
const SKY = 'radial-gradient(ellipse at 50% 30%, #1b2548 0%, #0b1026 70%, #05070f 100%)';

// SVG-полотно сузір'я з панорамою та зумом (useSvgPanZoom, як у дереві
// навичок). Режими:
//   'view'   — лише перегляд: клік по зірці її обирає;
//   'select' — перетягування зірок, клік по зірці обирає її;
//   'star'   — клік по порожньому місцю додає зірку (onBackgroundClick);
//   'line'   — клік по зірці будує лінію (onStarClick), клік по лінії видаляє її.
// Стан (зірки, лінії, вибір) тримає сторінка — полотно лише малює й повідомляє
// про дії. Ref дає метод fit() «вмістити все».
const ConstellationCanvas = forwardRef(function ConstellationCanvas({
  stars, lines, mode = 'view', selectedId = null, lineFromId = null,
  onBackgroundClick, onStarClick, onStarMove, onLineClick, className = '',
}, ref) {
  const svgRef = useRef(null);
  const panZoom = useSvgPanZoom({ initial: { x: 0, y: 0, k: 1 }, minK: 0.2, maxK: 4 });
  const { transform, setTransform } = panZoom;
  const dragRef = useRef(null);   // перетягування зірки
  const bgDownRef = useRef(null); // натискання на порожнє місце (для «клік чи панорама»)

  const byId = useMemo(() => new Map(stars.map((s) => [s.id, s])), [stars]);

  const fit = useCallback(() => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const positions = new Map(stars.map((s) => [s.id, { x: s.x, y: s.y }]));
    const next = computeFitTransform(positions, rect.width, rect.height, { padding: 90, minK: 0.2, maxK: 2 });
    // Порожнє сузір'я: початок координат — у центрі.
    setTransform(next ?? { x: rect.width / 2, y: rect.height / 2, k: 1 });
  }, [stars, setTransform]);

  useImperativeHandle(ref, () => ({ fit }), [fit]);

  // Початкове кадрування один раз, після першого виміру полотна.
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || !svgRef.current) return;
    fittedRef.current = true;
    fit();
  }, [fit]);

  const toWorld = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: (e.clientX - rect.left - transform.x) / transform.k, y: (e.clientY - rect.top - transform.y) / transform.k };
  };

  const handleStarPointerDown = (e, star) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    svgRef.current.setPointerCapture?.(e.pointerId);
    dragRef.current = {
      id: star.id, startX: e.clientX, startY: e.clientY, origX: star.x, origY: star.y, moved: false,
    };
  };

  const handleSvgPointerDown = (e) => {
    if (e.button !== 0 || dragRef.current) return;
    bgDownRef.current = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    panZoom.bind.onPointerDown(e);
  };

  const handleSvgPointerMove = (e) => {
    const drag = dragRef.current;
    if (drag) {
      const screenDist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (screenDist > DRAG_CLICK_THRESHOLD_PX) drag.moved = true;
      if (drag.moved && mode === 'select') {
        onStarMove?.(
          drag.id,
          Math.round(drag.origX + (e.clientX - drag.startX) / transform.k),
          Math.round(drag.origY + (e.clientY - drag.startY) / transform.k),
        );
      }
      return;
    }
    panZoom.bind.onPointerMove(e);
  };

  const finishPointer = (e) => {
    const drag = dragRef.current;
    if (drag) {
      dragRef.current = null;
      if (!drag.moved) onStarClick?.(drag.id);
      return;
    }

    // Порожнє місце: клік (майже без руху й без другого пальця) чи кінець панорамування.
    const down = bgDownRef.current;
    bgDownRef.current = null;
    panZoom.bind.onPointerUp(e);
    if (down && down.pointerId === e.pointerId && e.type === 'pointerup'
      && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= DRAG_CLICK_THRESHOLD_PX) {
      onBackgroundClick?.(toWorld(e));
    }
  };

  const cursor = mode === 'star' ? 'crosshair' : mode === 'line' ? 'pointer' : 'grab';

  return (
    <svg
      ref={svgRef}
      className={`block w-full select-none rounded-lg border border-border ${className}`}
      style={{ background: SKY, touchAction: 'none', cursor }}
      onPointerDown={handleSvgPointerDown}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onWheel={panZoom.bind.onWheel}
    >
      <defs>
        <radialGradient id="star-glow">
          <stop offset="0%" stopColor="#fff7d6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff7d6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {lines.map((line, i) => {
          const a = byId.get(line.a);
          const b = byId.get(line.b);
          if (!a || !b) return null;
          const path = straightEdgePath(a, b, STAR_LEVELS[a.size].r + LINE_GAP, STAR_LEVELS[b.size].r + LINE_GAP);
          if (!path) return null;
          return (
            <g key={`${line.a}-${line.b}`}>
              <path d={path} stroke="#9fb4ff" strokeOpacity="0.75" strokeWidth="1.5" fill="none" pointerEvents="none" />
              {mode === 'line' && (
                <path
                  d={path} stroke="transparent" strokeWidth="14" fill="none" style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => onLineClick?.(i)}
                >
                  <title>Видалити лінію</title>
                </path>
              )}
            </g>
          );
        })}

        {stars.map((star) => {
          const { r } = STAR_LEVELS[star.size] ?? STAR_LEVELS[1];
          const selected = star.id === selectedId;
          const lineFrom = star.id === lineFromId;
          return (
            <g
              key={star.id}
              data-star-id={star.id}
              transform={`translate(${star.x},${star.y})`}
              style={{ cursor: mode === 'select' ? 'move' : 'pointer' }}
              onPointerDown={(e) => handleStarPointerDown(e, star)}
            >
              <circle r={r * 3} fill="url(#star-glow)" opacity={0.45} pointerEvents="none" />
              {star.size === 3 && (
                <path
                  d={`M${-r * 2},0 L${r * 2},0 M0,${-r * 2} L0,${r * 2}`}
                  stroke="#fff7d6" strokeOpacity="0.7" strokeWidth="1" pointerEvents="none"
                />
              )}
              <circle r={r} fill="#fff7d6" pointerEvents="none" />
              {(selected || lineFrom) && (
                <circle r={r + 6} fill="none" stroke={lineFrom ? '#7fe0a0' : '#ffd36b'} strokeWidth="2" strokeDasharray="4 3" pointerEvents="none" />
              )}
              {star.name && (
                <text y={r + 16} textAnchor="middle" fontSize="12" fill="#dfe6ff" fillOpacity="0.9" pointerEvents="none">
                  {star.name}
                </text>
              )}
              {/* Невидима зона кліку — після видимого, щоб ловити події першою. */}
              <circle r={Math.max(STAR_HIT_R, r + 6)} fill="transparent" />
            </g>
          );
        })}
      </g>
    </svg>
  );
});

export default ConstellationCanvas;
