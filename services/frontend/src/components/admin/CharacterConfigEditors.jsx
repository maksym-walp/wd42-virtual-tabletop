import { useRef, useState } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import adminApi from '../../api/admin';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';
import { invalidateCharacterConfig } from '../../hooks/useCharacterConfig';

// Редактори конфігів листа персонажа (стани, валюти). Їхні записи мають
// більше полів, ніж {key, label} звичайного ConfigCard, тож окремі картки.
// Значення з _rowId (стабільний React-ключ рядка), який не йде на бекенд.

const KEY_PATTERN = /^[a-z0-9_]+$/;
const keyInputClass = `${inputClass} font-mono text-sm`;

let nextRowId = 1_000_000;
const newRowId = () => nextRowId++;
const stripRowIds = (value) => value.map(({ _rowId, ...rest }) => rest);

function useRowDrag(value, onChange) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);
  return {
    overIndex,
    handleProps: (index) => ({
      draggable: true,
      onDragStart: (e) => { dragIndex.current = index; e.dataTransfer.effectAllowed = 'move'; },
      onDragEnd: () => setOverIndex(null),
    }),
    rowProps: (index) => ({
      onDragOver: (e) => { e.preventDefault(); if (overIndex !== index) setOverIndex(index); },
      onDrop: (e) => {
        e.preventDefault();
        setOverIndex(null);
        const from = dragIndex.current;
        dragIndex.current = null;
        if (from === null || from === index) return;
        const next = [...value];
        const [moved] = next.splice(from, 1);
        next.splice(index, 0, moved);
        onChange(next);
      },
    }),
  };
}

function ConfigShell({ title, hint, children, saving, error, onSave, onAdd, addLabel }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {hint && <p className="text-xs text-text-dim">{hint}</p>}
        {children}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onAdd}><Plus size={14} /> {addLabel}</Button>
          <Button type="button" size="sm" disabled={saving} onClick={onSave}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

function useSave(configKey, value, validate, onSaved) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const stripped = stripRowIds(value);
    const problem = validate(stripped);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const saved = await adminApi.updateConfig(configKey, stripped);
      invalidateCharacterConfig();
      onSaved(saved);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, save };
}

function checkKeys(entries, what) {
  const seen = new Set();
  for (const { key, label } of entries) {
    if (!label?.trim()) return `Кожен ${what} має мати назву`;
    if (!key || !KEY_PATTERN.test(key)) return `key "${key ?? ''}": лише латинські малі літери, цифри й "_"`;
    if (seen.has(key)) return `Дублікат key: ${key}`;
    seen.add(key);
  }
  return null;
}

// ── Стани ────────────────────────────────────────────────────────────────────

function validateConditions(value) {
  if (!value.length) return 'Потрібен хоча б один стан';
  const keysError = checkKeys(value, 'стан');
  if (keysError) return keysError;
  for (const c of value) {
    if (c.max_level != null && (!Number.isInteger(c.max_level) || c.max_level < 1 || c.max_level > 20)) {
      return `«${c.label}»: максимальний рівень — ціле від 1 до 20 або порожньо`;
    }
  }
  return null;
}

export function ConditionsConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const drag = useRowDrag(value, onChange);
  const { saving, error, save } = useSave('conditions', value, validateConditions, onSaved);
  const update = (rowId, patch) => onChange(value.map((c) => (c._rowId === rowId ? { ...c, ...patch } : c)));

  return (
    <ConfigShell
      title="Стани персонажа"
      hint="Кожен рівень стану закреслює один кубик здоровʼя. key — значення, що зберігається в листі персонажа: якщо змінити key, рівні цього стану в наявних персонажів перестануть рахуватися в ньому."
      saving={saving}
      error={error}
      onSave={save}
      addLabel="Додати стан"
      onAdd={() => onChange([...value, { key: '', label: '', description: '', max_level: null, _rowId: newRowId() }])}
    >
      {value.map((c, index) => (
        <div
          key={c._rowId}
          {...drag.rowProps(index)}
          className={`flex gap-2 rounded-lg border border-border p-2.5 ${drag.overIndex === index ? 'bg-surface-hover' : ''}`}
        >
          <span {...drag.handleProps(index)} className="mt-2.5 shrink-0 cursor-grab text-text-dim active:cursor-grabbing" aria-label="Перетягнути">
            <GripVertical size={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_7rem]">
              <input className={inputClass} placeholder="Назва" value={c.label}
                onChange={(e) => update(c._rowId, { label: e.target.value })} />
              <input className={keyInputClass} placeholder="key" value={c.key}
                onChange={(e) => update(c._rowId, { key: e.target.value })} />
              <input
                type="number" min="1" max="20" className={inputClass} placeholder="Макс. рів."
                value={c.max_level ?? ''}
                onChange={(e) => update(c._rowId, { max_level: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </div>
            <textarea
              rows={2} className={inputClass} placeholder="Опис стану — його бачитимуть гравці за іконкою ⓘ"
              value={c.description ?? ''}
              onChange={(e) => update(c._rowId, { description: e.target.value })}
            />
          </div>
          <button type="button" onClick={() => onChange(value.filter((x) => x._rowId !== c._rowId))}
            aria-label="Видалити стан" className="shrink-0 self-start rounded-lg p-2 text-text-dim hover:text-danger">
            <X size={16} />
          </button>
        </div>
      ))}
    </ConfigShell>
  );
}

// ── Валюти ───────────────────────────────────────────────────────────────────

function validateCurrencies(value) {
  if (!value.length) return 'Потрібна хоча б одна пара валют';
  const pairError = checkKeys(value, 'регіон');
  if (pairError) return pairError;
  const denoms = value.flatMap((p) => [p.high, p.low].map((d) => ({ ...d, label: d.name })));
  const denomError = checkKeys(denoms, 'номінал');
  if (denomError) return denomError;
  for (const p of value) {
    if (p.convertible && (!Number.isInteger(p.rate) || p.rate < 2)) return `«${p.label}»: курс — ціле число не менше 2`;
  }
  return null;
}

const emptyDenom = () => ({ key: '', name: '', metal: '' });

function DenomFields({ title, denom, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">{title}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-2">
        <input className={inputClass} placeholder="Назва" value={denom.name}
          onChange={(e) => onChange({ ...denom, name: e.target.value })} />
        <input className={keyInputClass} placeholder="key" value={denom.key}
          onChange={(e) => onChange({ ...denom, key: e.target.value })} />
        <input className={inputClass} placeholder="Метал" value={denom.metal ?? ''}
          onChange={(e) => onChange({ ...denom, metal: e.target.value || null })} />
      </div>
    </div>
  );
}

export function CurrenciesConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const drag = useRowDrag(value, onChange);
  const { saving, error, save } = useSave('currencies', value, validateCurrencies, onSaved);
  const update = (rowId, patch) => onChange(value.map((p) => (p._rowId === rowId ? { ...p, ...patch } : p)));

  return (
    <ConfigShell
      title="Валюти"
      hint="Пара — старший і молодший номінал одного регіону. key номіналу — ключ балансу в гаманці персонажа: видалення чи зміна key не стирає баланс, але ховає його з листа, доки key не повернуть."
      saving={saving}
      error={error}
      onSave={save}
      addLabel="Додати пару"
      onAdd={() => onChange([...value, {
        key: '', label: '', description: '', convertible: true, rate: 100,
        high: emptyDenom(), low: emptyDenom(), _rowId: newRowId(),
      }])}
    >
      {value.map((p, index) => (
        <div
          key={p._rowId}
          {...drag.rowProps(index)}
          className={`flex gap-2 rounded-lg border border-border p-2.5 ${drag.overIndex === index ? 'bg-surface-hover' : ''}`}
        >
          <span {...drag.handleProps(index)} className="mt-2.5 shrink-0 cursor-grab text-text-dim active:cursor-grabbing" aria-label="Перетягнути">
            <GripVertical size={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <input className={inputClass} placeholder="Регіон / назва пари" value={p.label}
                onChange={(e) => update(p._rowId, { label: e.target.value })} />
              <input className={keyInputClass} placeholder="key пари" value={p.key}
                onChange={(e) => update(p._rowId, { key: e.target.value })} />
            </div>
            <DenomFields title="Старший номінал" denom={p.high} onChange={(high) => update(p._rowId, { high })} />
            <DenomFields title="Молодший номінал" denom={p.low} onChange={(low) => update(p._rowId, { low })} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-text-dim">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={p.convertible}
                  onChange={(e) => update(p._rowId, { convertible: e.target.checked, rate: e.target.checked ? (p.rate ?? 100) : null })} />
                Обмінюється за курсом
              </label>
              {p.convertible && (
                <label className="inline-flex items-center gap-2 text-text-dim">
                  1 старший =
                  <input type="number" min="2" className={`${inputClass} w-24`} value={p.rate ?? ''}
                    onChange={(e) => update(p._rowId, { rate: e.target.value === '' ? null : Number(e.target.value) })} />
                  молодших
                </label>
              )}
            </div>
            <textarea rows={2} className={inputClass} placeholder="Опис (необовʼязково)" value={p.description ?? ''}
              onChange={(e) => update(p._rowId, { description: e.target.value })} />
          </div>
          <button type="button" onClick={() => onChange(value.filter((x) => x._rowId !== p._rowId))}
            aria-label="Видалити пару" className="shrink-0 self-start rounded-lg p-2 text-text-dim hover:text-danger">
            <X size={16} />
          </button>
        </div>
      ))}
    </ConfigShell>
  );
}
