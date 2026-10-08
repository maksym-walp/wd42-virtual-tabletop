import { useState } from 'react';
import { ChevronUp, ChevronDown, ArrowLeftRight } from 'lucide-react';
import IntInput from '../ui/IntInput';
import MoneyOperationSheet from './MoneyOperationSheet';

// Гаманець персонажа: компактні картки пар валют (з конфігу адміна) з
// ручним редагуванням і кнопками обміну ↑/↓ за курсом пари, плюс
// «Додати / відняти» для швидких операцій.
export default function MoneySection({ c, is_owner, patchCharacter, currencies }) {
  const [operationOpen, setOperationOpen] = useState(false);
  const money = c.money || {};
  const setMoney = (next) => patchCharacter({ money: next });
  const setDenom = (key, value) => setMoney({ ...money, [key]: Math.max(0, value) });

  const convertUp = (cur) => {
    const lowVal = money[cur.low.key] ?? 0;
    const count = Math.floor(lowVal / cur.rate);
    if (count <= 0) return;
    setMoney({ ...money, [cur.high.key]: (money[cur.high.key] ?? 0) + count, [cur.low.key]: lowVal - count * cur.rate });
  };
  const convertDown = (cur) => {
    const highVal = money[cur.high.key] ?? 0;
    if (highVal <= 0) return;
    setMoney({ ...money, [cur.high.key]: highVal - 1, [cur.low.key]: (money[cur.low.key] ?? 0) + cur.rate });
  };

  const shown = is_owner
    ? currencies
    : currencies.filter((cur) => (money[cur.high.key] ?? 0) > 0 || (money[cur.low.key] ?? 0) > 0);
  if (!is_owner && shown.length === 0) return null;

  const denomField = (denom) => (
    <label key={denom.key} className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-[0.65rem] text-text-dim" title={denom.metal ? `${denom.name} (${denom.metal})` : denom.name}>
        {denom.name}
      </span>
      {is_owner ? (
        <IntInput
          className="w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
          value={money[denom.key] ?? 0}
          onChange={(v) => setDenom(denom.key, v)}
        />
      ) : (
        <span className="text-sm font-semibold text-text">{money[denom.key] ?? 0}</span>
      )}
    </label>
  );

  return (
    <section className="mb-6">
      <div className="mb-2 border-b border-border pb-1.5">
        <span className="text-xs font-bold uppercase tracking-wide text-gold">Гроші</span>
      </div>

      {/* 5 пар + кнопка операцій — два рядки по три клітинки. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((cur) => (
          <div key={cur.key ?? cur.label} className="rounded-lg border border-border bg-bg px-2.5 py-2" title={cur.description || undefined}>
            <p className="mb-1 truncate text-xs font-semibold text-text-muted">{cur.label}</p>
            <div className="flex items-end gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
                {denomField(cur.high)}
                {denomField(cur.low)}
              </div>
              {is_owner && cur.convertible && (
                <div className="flex shrink-0 flex-col gap-0.5">
                  <button
                    type="button"
                    title={`Обміняти ${cur.rate} ${cur.low.name} → 1 ${cur.high.name}`}
                    aria-label={`Обміняти ${cur.low.name} на ${cur.high.name}`}
                    className="flex h-[15px] w-6 items-center justify-center rounded border border-border text-text-dim hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => convertUp(cur)}
                    disabled={(money[cur.low.key] ?? 0) < cur.rate}
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    title={`Обміняти 1 ${cur.high.name} → ${cur.rate} ${cur.low.name}`}
                    aria-label={`Обміняти ${cur.high.name} на ${cur.low.name}`}
                    className="flex h-[15px] w-6 items-center justify-center rounded border border-border text-text-dim hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => convertDown(cur)}
                    disabled={(money[cur.high.key] ?? 0) < 1}
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {is_owner && (
          <button
            type="button"
            onClick={() => setOperationOpen(true)}
            className="flex min-h-16 items-center justify-center gap-2 rounded-lg border border-dashed border-gold/50 px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-surface-hover"
          >
            <ArrowLeftRight size={16} /> Додати / відняти
          </button>
        )}
      </div>

      {is_owner && (
        <MoneyOperationSheet
          open={operationOpen}
          money={money}
          currencies={currencies}
          onApply={setMoney}
          onClose={() => setOperationOpen(false)}
        />
      )}
    </section>
  );
}
