import { useState } from 'react';
import { FlaskRound, Minus, Plus } from 'lucide-react';
import characterApi from '../../api/characterSheet';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { inputClass } from '../ui/Field';
import usePotionOptions, { potionSummary, portionsWord } from '../../hooks/usePotionOptions';

// Одна кнопка зілля на блоці здоровʼя: вікно з зіллями персонажа, вибір
// кількості порцій і модалка результату. Зцілення, звикання (кидки d4 → d6 →
// … → d100) і перевірку Імунітету рахує character-sheet (rules/potions.js).

export const availablePortions = (entry) => (entry.containers ?? 0) * (entry.item?.portions ?? 0) + (entry.open_portions ?? 0);

export function potionStockLabel(entry, sizesMap = {}) {
  const size = sizesMap[entry.item?.potion_size]?.label ?? 'ємність';
  const parts = [];
  if (entry.containers) parts.push(`${size.toLowerCase()} × ${entry.containers}`);
  if (entry.open_portions) parts.push(`відкрито: ${entry.open_portions} ${portionsWord(entry.open_portions)}`);
  return parts.join(' · ') || 'порожньо';
}

function HabituationStatus({ potions }) {
  if (!potions) return null;
  return (
    <p className={`mb-3 rounded-md border px-3 py-2 text-xs ${potions.habituated ? 'border-danger/40 bg-danger/5 text-danger' : 'border-border text-text-dim'}`}>
      {potions.habituated
        ? `Звикання: ефект кожної наступної порції удвічі менший; порцій після звикання — ${potions.excess_portions} (складність перевірки Імунітету).`
        : `Звикання ще нема. Наступна порція — кидок звикання ${potions.next_die} (4+ — звикання).`}
    </p>
  );
}

function DrinkResult({ result, labels, onClose }) {
  const { heal, hp, habituation, immunity } = result;
  const illness = labels.illness ?? 'Хвороба';
  return (
    <Sheet open onClose={onClose} title={`Випито: ${result.potion?.name ?? 'зілля'}`}>
      <div className="flex flex-col gap-3 text-sm">
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
          <dt className="text-text-dim">Порцій</dt><dd className="font-semibold text-text">{result.portions} × {result.heal_die}</dd>
          <dt className="text-text-dim">Зцілення</dt>
          <dd className="font-semibold text-text">
            +{heal.total}
            {heal.halved_raw > 0 && <span className="font-normal text-text-dim"> (повні {heal.full} + ½ від {heal.halved_raw} = {heal.halved})</span>}
          </dd>
          <dt className="text-text-dim">Здоровʼя</dt><dd className="font-semibold text-text">{hp.before} → {hp.after} (макс {hp.max})</dd>
        </dl>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gold">Кидки зцілення</p>
          <p className="font-mono text-xs text-text">
            {result.heal_rolls.map((r) => `${r.values[0]}${r.halved ? '½' : ''}`).join(' + ')}
          </p>
        </div>
        {habituation.rolls.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gold">Звикання</p>
            <ul className="flex flex-col gap-0.5">
              {habituation.rolls.map((r) => (
                <li key={r.portion}>Порція {r.portion}: {r.die} = {r.roll} — {r.habituated ? <b className="text-danger">звикання</b> : 'без звикання'}</li>
              ))}
            </ul>
          </div>
        )}
        {immunity && (
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gold">Перевірка Імунітету</p>
            <p>
              {immunity.die ? `${immunity.die} = ${immunity.roll}` : 'без кубика = 0'} проти {immunity.difficulty} — {immunity.success ? 'успіх' : 'провал'}
              {immunity.illness_added > 0
                ? <b className="text-danger">; {illness} {immunity.illness_before} → {immunity.illness_after}</b>
                : '; хвороби нема'}
            </p>
          </div>
        )}
        {result.notes?.length > 0 && (
          <ul className="flex flex-col gap-0.5 text-xs text-text-dim">
            {result.notes.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        )}
      </div>
      <Button className="mt-4 w-full" onClick={onClose}>Зрозуміло</Button>
    </Sheet>
  );
}

// potions — рядки equipment листа з item.type === 'potion'; potionState —
// блок potions листа (звикання); onDrank(data) — відповідь сервера.
export default function PotionControls({ characterId, potions, potionState, labels = {}, onDrank }) {
  const { tiersMap, sizesMap } = usePotionOptions();
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const total = potions.reduce((s, e) => s + availablePortions(e), 0);

  // Чернетка поля «скільки порцій» — рядок, щоб його можна було стерти й
  // набрати заново; випити можна лише ціле від 1 до доступного.
  const parseCount = (entry) => {
    const raw = counts[entry.equipment_id];
    return raw === undefined ? 1 : Number(raw);
  };
  const isValidCount = (entry, n) => Number.isInteger(n) && n >= 1 && n <= availablePortions(entry);

  const drink = async (entry) => {
    const portions = parseCount(entry);
    if (!isValidCount(entry, portions)) return;
    setBusy(true);
    setError('');
    try {
      const data = await characterApi.drinkPotion(characterId, entry.equipment_id, portions);
      setOpen(false);
      setCounts({});
      setResult(data.result);
      await onDrank?.(data, entry.equipment_id);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося випити зілля');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Зілля" aria-label="Зілля"
        className="relative flex h-8 w-8 items-center justify-center rounded border border-border text-text-dim hover:bg-surface-hover hover:text-danger">
        <FlaskRound size={15} />
        {total > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-danger px-1 text-[0.6rem] font-bold leading-4 text-bg">{total}</span>
        )}
      </button>

      {open && (
        <Sheet open onClose={() => setOpen(false)} title="Зілля">
          <HabituationStatus potions={potionState} />
          {potions.length === 0 ? (
            <p className="text-sm text-text-dim">У персонажа нема зіль. Додайте їх на вкладці «Спорядження».</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {potions.map((entry) => {
                const available = availablePortions(entry);
                const count = parseCount(entry);
                const valid = isValidCount(entry, count);
                const setCount = (v) => setCounts((c) => ({ ...c, [entry.equipment_id]: String(Math.max(1, Math.min(available, v))) }));
                const inputId = `potion-portions-${entry.equipment_id}`;
                return (
                  <li key={entry.equipment_id} className="rounded-lg border border-border p-3">
                    <p className="m-0 font-semibold text-text">{entry.item?.name}</p>
                    <p className="m-0 text-xs text-text-dim">{potionSummary(entry.item, { tiersMap, sizesMap })}</p>
                    <p className="m-0 mb-2 text-xs text-text-dim">
                      Є {available} {portionsWord(available)}: {potionStockLabel(entry, sizesMap)}
                    </p>
                    <label htmlFor={inputId} className="mb-1 block text-xs font-semibold text-text-dim">
                      Скільки порцій випити (з {available})
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button type="button" aria-label="Менше порцій" disabled={!valid || count <= 1 || busy} onClick={() => setCount(count - 1)}
                          className="flex h-9 w-9 items-center justify-center rounded border border-border text-text disabled:opacity-40"><Minus size={14} /></button>
                        <input
                          id={inputId}
                          type="number" inputMode="numeric" min={1} max={available} step={1}
                          value={counts[entry.equipment_id] ?? '1'}
                          onChange={(e) => setCounts((c) => ({ ...c, [entry.equipment_id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter' && valid) drink(entry); }}
                          aria-invalid={!valid}
                          className={`${inputClass} !min-h-9 !w-20 !py-1 text-center ${valid ? '' : '!border-danger'}`}
                        />
                        <button type="button" aria-label="Більше порцій" disabled={(valid && count >= available) || busy} onClick={() => setCount(valid ? count + 1 : 1)}
                          className="flex h-9 w-9 items-center justify-center rounded border border-border text-text disabled:opacity-40"><Plus size={14} /></button>
                      </div>
                      <span className="text-xs text-text-dim">
                        {valid ? `≈ ${count}d${entry.item?.heal_die}` : `від 1 до ${available}`}
                      </span>
                      <Button size="sm" className="ml-auto" disabled={busy || !valid} onClick={() => drink(entry)}>
                        Випити {valid ? `${count} ${portionsWord(count)}` : ''}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}

      {result && <DrinkResult result={result} labels={labels} onClose={() => setResult(null)} />}
    </>
  );
}
