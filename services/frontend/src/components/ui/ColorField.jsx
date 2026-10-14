import { inputClass } from './Field';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

// Вибір кольору: ряд пресетів (за наявності), нативний color-picker і
// текстове поле для hex — жодного color-picker компонента/бібліотеки в репо
// немає, а <input type="color"> покриває довільний вибір без нової залежності.
// presets — [{ value: '#rrggbb', label }]; без них показується лише пікер.
// label/className — власна обгортка з підписом замість <Field>: Field є
// <label>, а клік по підпису активував би першу кнопку-пресет усередині.
export default function ColorField({ value, onChange, presets, label, className = '' }) {
  const safeValue = HEX_COLOR_RE.test(value || '') ? value : '#888888';
  const current = (value || '').toLowerCase();

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">{label}</span>}
      {presets?.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Пресети кольору">
          {presets.map((p) => {
            const selected = current === p.value.toLowerCase();
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                title={p.label}
                aria-label={p.label}
                aria-pressed={selected}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  selected ? 'border-text ring-2 ring-accent/60' : 'border-border'
                }`}
                style={{ backgroundColor: p.value }}
              />
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={safeValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-bg p-1"
          aria-label="Колір"
        />
        <input
          type="text"
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#rrggbb"
          maxLength={7}
        />
      </div>
    </div>
  );
}
