import { mod } from '../utils/calendarMath';

// Draws the illuminated region as a single path made of two arcs sharing
// the same top/bottom points on the disc: the outer arc is always the
// half-circle boundary (radius r), the inner arc is the terminator, an
// ellipse whose horizontal radius shrinks to 0 at the quarters and whose
// bulge direction flips sign with cos(phase*2π) — that sign flip is what
// turns a crescent (bulge same side as the outer arc) into a gibbous (bulge
// the opposite side) without any special-casing per phase quadrant.
// Verified by hand against all 8 traditional phase names (new, waxing
// crescent/quarter/gibbous, full, waning gibbous/quarter/crescent) — the
// frontend has no test runner configured yet to pin this down as a test.
function buildLitPath(r, phase) {
  const theta = phase * 2 * Math.PI;
  const cosTheta = Math.cos(theta);
  const rx = r * Math.abs(cosTheta);
  const waxing = phase < 0.5;
  // Waxing = illuminated side anchored right (outer arc bulges right);
  // waning = anchored left. Within each half, the terminator bulges the
  // *same* side as the outer arc for a crescent (< half lit) and the
  // *opposite* side for a gibbous (> half lit) — cos's sign already encodes
  // which of those two we're in, so it drives the inner sweep flag directly.
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = waxing
    ? (cosTheta >= 0 ? 1 : 0)
    : (cosTheta >= 0 ? 0 : 1);

  return [
    `M 0 ${-r}`,
    `A ${r} ${r} 0 0 ${outerSweep} 0 ${r}`,
    `A ${rx} ${r} 0 0 ${innerSweep} 0 ${-r}`,
    'Z',
  ].join(' ');
}

/**
 * Inline SVG moon-phase icon. phase = ((totalDaysPassed + shift) mod
 * cycleLength) / cycleLength, so 0 = new, 0.5 = full, smoothly interpolated
 * in between (not one of 4 static icons).
 */
export default function MoonPhase({ cycleLength, shift = 0, totalDaysPassed, color = '#c0c0c0', size = 18, name }) {
  const phase = cycleLength > 0 ? mod(totalDaysPassed + Number(shift), cycleLength) / cycleLength : 0;
  const r = size / 2 - 1;
  const litPath = buildLitPath(r, phase);
  const label = name ? `${name}: фаза ${Math.round(phase * 100)}%` : undefined;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
      role="img"
      aria-label={label}
    >
      {label && <title>{label}</title>}
      <circle cx="0" cy="0" r={r} fill="#161625" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
      <path d={litPath} fill={color} />
    </svg>
  );
}
