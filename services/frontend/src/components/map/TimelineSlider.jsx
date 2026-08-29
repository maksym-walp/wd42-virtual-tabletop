import { useState } from 'react';
import { Clock, Ruler, Equal } from 'lucide-react';

// Floating year scrubber for the map view. Spans [min, max] (the min/max year
// across the active lens's versions); `ticks` are the years that actually have
// a version.
//
// Two track modes, toggled in-place:
//   span (default) — value is continuous, tick spacing reflects the real year
//                    gap. Clusters of versions in a wide range look cramped.
//   even           — the slider is an index into the version list, so every
//                    version gets equal spacing regardless of the year gap.
//
// orientation: 'horizontal' (bottom-centre, phones) or 'vertical' (left rail,
// wide screens — rendered as a static block, the parent positions it).
export default function TimelineSlider({ min, max, value, ticks = [], onChange, orientation = 'horizontal' }) {
  const [even, setEven] = useState(false);
  if (min == null || max == null || min >= max) return null;

  const years = [...new Set(ticks)].filter((y) => y != null).sort((a, b) => a - b);
  const useEven = even && years.length >= 2;

  const yearValue = value == null ? max : Math.min(max, Math.max(min, value));
  const nearestIdx = years.reduce(
    (best, y, i) => (Math.abs(y - yearValue) < Math.abs(years[best] - yearValue) ? i : best),
    0,
  );

  const sliderMin = useEven ? 0 : min;
  const sliderMax = useEven ? years.length - 1 : max;
  const sliderValue = useEven ? nearestIdx : yearValue;
  const displayYear = useEven ? years[nearestIdx] : yearValue;
  const emit = (raw) => onChange(useEven ? years[raw] : raw);

  const vertical = orientation === 'vertical';

  const range = (
    <input
      type="range"
      min={sliderMin}
      max={sliderMax}
      step={1}
      value={sliderValue}
      onChange={(e) => emit(Number(e.target.value))}
      list={useEven ? undefined : 'timeline-ticks'}
      aria-label="Рік на мапі"
      className="accent-gold"
      style={vertical
        ? {
          writingMode: 'vertical-lr',
          direction: 'rtl',
          WebkitAppearance: 'slider-vertical',
          appearance: 'slider-vertical',
          MozOrient: 'vertical',
          width: '1.25rem',
          height: '11rem',
        }
        : { width: '100%' }}
    />
  );
  const datalist = !useEven && (
    <datalist id="timeline-ticks">
      {years.map((y) => <option key={y} value={y} />)}
    </datalist>
  );
  const modeToggle = years.length >= 2 && (
    <button
      type="button"
      onClick={() => setEven((v) => {
        const next = !v;
        // Entering "even" mode: snap the value onto a real version year.
        if (next) onChange(years[nearestIdx]);
        return next;
      })}
      aria-label="Режим шкали"
      title={useEven ? 'Позначки рівномірно за версіями' : 'Позначки за роками'}
      className="text-text-dim hover:text-accent"
    >
      {useEven ? <Equal size={13} /> : <Ruler size={13} />}
    </button>
  );

  if (vertical) {
    return (
      <div className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-lg border border-border bg-surface/95 px-2 py-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-text-dim" />
          {modeToggle}
        </div>
        <span className="tabular-nums text-sm font-bold text-gold">{displayYear}</span>
        <span className="text-[10px] tabular-nums text-text-dim">{max}</span>
        {range}
        {datalist}
        <span className="text-[10px] tabular-nums text-text-dim">{min}</span>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-[1000] w-[min(90vw,32rem)] -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
        <span className="flex items-center gap-1.5"><Clock size={13} /> Рік</span>
        <span className="flex items-center gap-2">
          {modeToggle}
          <span className="tabular-nums text-sm font-bold text-gold">{displayYear}</span>
        </span>
      </div>
      {range}
      {datalist}
      <div className="mt-0.5 flex justify-between text-[10px] tabular-nums text-text-dim">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
