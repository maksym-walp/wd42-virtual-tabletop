import { Clock } from 'lucide-react';

// Floating year scrubber for the map view. Spans [min, max] (the min/max year
// across the active lens's versions); `ticks` are the years that actually have
// a version, drawn as notches on the track. The value stays continuous — the
// image/pin resolution already snaps to "newest version at or before year".
export default function TimelineSlider({ min, max, value, ticks = [], onChange }) {
  if (min == null || max == null || min >= max) return null;
  const current = value == null ? max : Math.min(max, Math.max(min, value));

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-[1000] w-[min(90vw,32rem)] -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
        <span className="flex items-center gap-1.5"><Clock size={13} /> Рік</span>
        <span className="tabular-nums text-sm font-bold text-gold">{current}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        list="timeline-ticks"
        className="w-full accent-gold"
        aria-label="Рік на мапі"
      />
      <datalist id="timeline-ticks">
        {ticks.map((y) => <option key={y} value={y} />)}
      </datalist>
      <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-text-dim">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
