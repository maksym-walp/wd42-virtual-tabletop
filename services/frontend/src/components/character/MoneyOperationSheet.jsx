import { useEffect, useMemo, useState } from 'react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import { applyMoneyOperation, counterpart } from '../../utils/money';

const MODES = [
  { key: 'add', label: 'Додати' },
  { key: 'subtract', label: 'Відняти' },
  { key: 'exchange', label: 'Обміняти' },
];

const denomLabel = (d) => `${d.name}${d.metal ? ` (${d.metal})` : ''}`;

// Швидка зміна гаманця: додати, списати (з автоматичним розміном старших
// монет пари) або обміняти номінали всередині пари. Уся арифметика —
// utils/money.js; тут лише форма й попередній перегляд результату.
export default function MoneyOperationSheet({ open, money, currencies, onApply, onClose }) {
  const [mode, setMode] = useState('subtract');
  const [amount, setAmount] = useState('');
  const [denom, setDenom] = useState('');
  const [error, setError] = useState('');

  const exchangeable = useMemo(() => currencies.filter((c) => c.convertible), [currencies]);

  useEffect(() => {
    if (open) { setAmount(''); setError(''); }
  }, [open]);

  useEffect(() => {
    const pool = mode === 'exchange' ? exchangeable : currencies;
    const allowed = pool.flatMap((c) => [c.high.key, c.low.key]);
    if (!allowed.includes(denom)) setDenom(allowed[0] ?? '');
  }, [mode, currencies, exchangeable, denom]);

  if (!open) return null;

  const pool = mode === 'exchange' ? exchangeable : currencies;
  const target = mode === 'exchange' ? counterpart(currencies, denom) : null;
  const preview = amount ? applyMoneyOperation(money, { type: mode, denom, amount }, currencies) : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const result = applyMoneyOperation(money, { type: mode, denom, amount }, currencies);
    if (!result.ok) { setError(result.error); return; }
    onApply(result.money);
    onClose();
  };

  // Що зміниться — лише номінали, у яких різниться кількість.
  const changes = preview?.ok
    ? currencies.flatMap((c) => [c.high, c.low])
      .filter((d) => (preview.money[d.key] ?? 0) !== (money[d.key] ?? 0))
      .map((d) => ({ d, from: money[d.key] ?? 0, to: preview.money[d.key] ?? 0 }))
    : [];

  return (
    <Sheet open onClose={onClose} title="Гаманець">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {MODES.map((m, i) => (
            <button
              key={m.key}
              type="button"
              onClick={() => { setMode(m.key); setError(''); }}
              disabled={m.key === 'exchange' && exchangeable.length === 0}
              className={`flex-1 py-2.5 text-sm font-semibold transition-colors disabled:opacity-40 ${i > 0 ? 'border-l border-border' : ''} ${
                mode === m.key ? 'bg-accent text-bg' : 'text-text-dim hover:bg-surface-hover'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <Field label="Кількість">
            <input
              type="number" min="1" step="1" inputMode="numeric" autoFocus
              className={inputClass}
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
            />
          </Field>
          <Field label={mode === 'exchange' ? 'Віддати' : 'Валюта'}>
            <select className={inputClass} value={denom} onChange={(e) => { setDenom(e.target.value); setError(''); }}>
              {pool.map((c) => (
                <optgroup key={c.key ?? c.label} label={c.label}>
                  {[c.high, c.low].map((d) => (
                    <option key={d.key} value={d.key}>{denomLabel(d)} — є {money[d.key] ?? 0}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        </div>

        {target && (
          <p className="text-sm text-text-dim">Отримати: <span className="text-text">{denomLabel(target)}</span></p>
        )}

        {changes.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm">
            {changes.map(({ d, from, to }) => (
              <li key={d.key} className="flex justify-between gap-2">
                <span className="text-text-dim">{d.name}</span>
                <span className="text-text">{from} → <b className={to < from ? 'text-danger' : 'text-sage'}>{to}</b></span>
              </li>
            ))}
          </ul>
        )}
        {preview && !preview.ok && <p className="text-sm text-danger">{preview.error}</p>}
        {error && !preview && <p className="text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={!preview?.ok}>
          {MODES.find((m) => m.key === mode).label}
        </Button>
      </form>
    </Sheet>
  );
}
