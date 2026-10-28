// Шкала смерті — повзунок −3…+3 (крок 1). null — персонаж не на шкалі;
// при падінні маркер ставиться на 0, −3 — помер, +3 — отримав свідомість.
// Інших правил шкали (пробудження, героїзм) тут нема.
const STATUS = (v) => {
  if (v <= -3) return 'Помер';
  if (v >= 3) return 'Отримав свідомість';
  if (v === 0) return 'Непритомний';
  return v < 0 ? `Непритомний · провалів: ${Math.abs(v)}` : `Непритомний · успіхів: ${v}`;
};

export default function DeathScaleSlider({ value, editable, onChange }) {
  if (value == null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-dim">Не на шкалі смерті</p>
        {editable && (
          <button type="button" onClick={() => onChange(0)}
            className="rounded border border-border px-2.5 py-1 text-xs text-accent hover:bg-surface-hover">
            Впав (0)
          </button>
        )}
      </div>
    );
  }

  const tone = value < 0 ? 'text-danger' : value > 0 ? 'text-sage' : 'text-gold';
  return (
    <div>
      <input
        type="range" min={-3} max={3} step={1} value={value}
        disabled={!editable}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Шкала смерті"
        aria-valuetext={STATUS(value)}
        className="w-full accent-accent disabled:opacity-70"
      />
      <div className="mt-0.5 grid grid-cols-7 text-center text-[0.65rem] text-text-dim">
        {[-3, -2, -1, 0, 1, 2, 3].map((v) => (
          <span key={v} className={v === value ? `font-bold ${tone}` : ''}>
            {v === -3 ? '☠' : v === 3 ? '✓' : v > 0 ? `+${v}` : v}
          </span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <p className={`text-sm font-semibold ${tone}`}>{STATUS(value)}</p>
        {editable && (
          <button type="button" onClick={() => onChange(null)}
            className="rounded px-2 py-1 text-xs text-text-dim hover:bg-surface-hover hover:text-text">
            Зняти зі шкали
          </button>
        )}
      </div>
    </div>
  );
}
