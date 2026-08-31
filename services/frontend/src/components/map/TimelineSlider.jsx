import { useState } from 'react';
import { Clock } from 'lucide-react';

// Floating year scrubber for the map view. Spans [min, max] (the min/max year
// across the active lens's versions); `ticks` are the years that actually have
// a version — drawn as notches on the track in both modes.
//
// Two track modes, switched with the toggle:
//   "за роками"    — value is continuous, notch spacing reflects the real year
//                    gap. Clusters of versions in a wide range look cramped.
//   "рівномірно"   — the slider is an index into the version list, so every
//                    version gets equal spacing regardless of the year gap.
//
// orientation: 'horizontal' (bottom-centre, phones) or 'vertical' (left rail,
// wide screens — a static block, the parent positions it).
export default function TimelineSlider({ min, max, value, ticks = [], onChange, orientation = 'horizontal' }) {
  const [even, setEven] = useState(false);
  const [draft, setDraft] = useState(null); // in-progress text in the year input
  if (min == null || max == null || min >= max) return null;

  const years = [...new Set(ticks)].filter((y) => y != null).sort((a, b) => a - b);
  const canEven = years.length >= 2;
  const useEven = even && canEven;

  const yearValue = value == null ? max : Math.min(max, Math.max(min, value));
  const nearestIdx = years.reduce(
    (best, y, i) => (Math.abs(y - yearValue) < Math.abs(years[best] - yearValue) ? i : best),
    0,
  );

  const sliderMin = useEven ? 0 : min;
  const sliderMax = useEven ? years.length - 1 : max;
  const sliderValue = useEven ? nearestIdx : yearValue;
  const emit = (raw) => onChange(useEven ? years[raw] : raw);
  const commitDraft = () => {
    if (draft != null && draft.trim() !== '') {
      const n = Number(draft);
      if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, Math.round(n))));
    }
    setDraft(null);
  };

  const vertical = orientation === 'vertical';

  // Notch positions as a 0..100 percentage along the track.
  const tickPct = useEven
    ? years.map((_, i) => (i / (years.length - 1)) * 100)
    : years.map((y) => ((y - min) / (max - min)) * 100);

  const yearInput = (
    <input
      type="number"
      value={draft ?? String(yearValue)}
      min={min}
      max={max}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commitDraft}
      onKeyDown={(e) => { if (e.key === 'Enter') { commitDraft(); e.currentTarget.blur(); } }}
      aria-label="Рік на мапі"
      className="w-[4.5rem] rounded border border-border bg-bg px-1 py-0.5 text-center text-sm font-bold tabular-nums text-gold focus:border-accent focus:outline-none"
    />
  );

  const modeToggle = canEven && (
    <div className={`flex overflow-hidden rounded border border-border text-[10px] font-semibold ${vertical ? 'flex-col' : ''}`}>
      <button type="button" onClick={() => setEven(false)}
        className={`px-1.5 py-0.5 ${!useEven ? 'bg-gold/20 text-gold' : 'text-text-dim hover:bg-surface-hover'}`}>
        за роками
      </button>
      <button type="button"
        onClick={() => { setEven(true); onChange(years[nearestIdx]); }}
        className={`px-1.5 py-0.5 ${vertical ? 'border-t' : 'border-l'} border-border ${useEven ? 'bg-gold/20 text-gold' : 'text-text-dim hover:bg-surface-hover'}`}>
        рівномірно
      </button>
    </div>
  );

  const range = (
    <input
      type="range"
      min={sliderMin}
      max={sliderMax}
      step={1}
      value={sliderValue}
      onChange={(e) => emit(Number(e.target.value))}
      aria-label="Позиція на шкалі часу"
      className="accent-gold"
      style={vertical
        ? {
          writingMode: 'vertical-lr', direction: 'rtl',
          WebkitAppearance: 'slider-vertical', appearance: 'slider-vertical', MozOrient: 'vertical',
          width: '1.25rem', height: '11rem',
        }
        : { width: '100%' }}
    />
  );

  if (vertical) {
    return (
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2 py-3 shadow-lg backdrop-blur">
        <Clock size={13} className="text-text-dim" />
        {modeToggle}
        {yearInput}
        <span className="text-[10px] tabular-nums text-text-dim">{max}</span>
        <div className="relative flex justify-center py-1">
          {range}
          {/* notches down the right side of the track */}
          <div className="pointer-events-none absolute inset-y-1 right-0 w-1">
            {tickPct.map((p, i) => (
              <span key={i} className="absolute right-0 h-px w-1.5 bg-text-dim/60" style={{ top: `${100 - p}%` }} />
            ))}
          </div>
        </div>
        <span className="text-[10px] tabular-nums text-text-dim">{min}</span>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-[1000] w-[min(90vw,32rem)] -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-text-dim"><Clock size={14} /></span>
        <div className="flex items-center gap-2">
          {modeToggle}
          {yearInput}
        </div>
      </div>
      <div className="relative">
        {range}
        {/* notch strip just under the track */}
        <div className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-2">
          {tickPct.map((p, i) => (
            <span key={i} className="absolute top-0 h-2 w-px -translate-x-1/2 bg-text-dim/60" style={{ left: `${p}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-text-dim">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
