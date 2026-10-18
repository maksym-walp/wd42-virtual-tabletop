import { STAR_LEVELS, boundsOf } from '../../utils/constellation';

// Статичне міні-зображення сузір'я для карток списку: масштабується під свою
// рамку, без взаємодії й підписів. Приймає і повні зірки, і стислий preview зі списку.
export default function ConstellationPreview({ stars = [], lines = [], className = '' }) {
  const bounds = boundsOf(stars);
  const pad = 30;
  const box = bounds
    ? { x: bounds.minX - pad, y: bounds.minY - pad, w: Math.max(80, bounds.maxX - bounds.minX + pad * 2), h: Math.max(60, bounds.maxY - bounds.minY + pad * 2) }
    : { x: -60, y: -40, w: 120, h: 80 };
  const byId = new Map(stars.map((s) => [s.id, s]));

  return (
    <svg
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1b2548 0%, #0b1026 70%, #05070f 100%)' }}
    >
      {lines.map((l) => {
        const a = byId.get(l.a);
        const b = byId.get(l.b);
        if (!a || !b) return null;
        return <line key={`${l.a}-${l.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#9fb4ff" strokeOpacity="0.7" strokeWidth={Math.max(box.w, box.h) / 120} />;
      })}
      {stars.map((s) => (
        <circle key={s.id} cx={s.x} cy={s.y} r={(STAR_LEVELS[s.size]?.r ?? 5) * Math.max(box.w, box.h) / 220} fill="#fff7d6" />
      ))}
    </svg>
  );
}
