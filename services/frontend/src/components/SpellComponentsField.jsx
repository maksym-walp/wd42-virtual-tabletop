import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { inputClass } from './ui/Field';
import IntInput from './ui/IntInput';
import { COMPONENT_UNITS, CUSTOM_UNIT } from '../constants/spellbook';

let rowIdCounter = 0;
const nextRowKey = () => `row-${Date.now()}-${rowIdCounter++}`;

export function emptyComponentRow() {
  return { key: nextRowKey(), item_id: null, name: '', quantity: 1, unit: COMPONENT_UNITS[0], createAsNew: false };
}

// components: [{ key, item_id, name, quantity, unit, createAsNew }]
// equipmentItems: full visible equipment catalog, prefetched once by the caller.
export default function SpellComponentsField({ components, onChange, equipmentItems }) {
  const [customUnitRows, setCustomUnitRows] = useState({});

  const addRow = () => onChange([...components, emptyComponentRow()]);
  const removeRow = (key) => onChange(components.filter((c) => c.key !== key));
  const patchRow = (key, patch) => onChange(components.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const setName = (row, value) => {
    const exactMatch = equipmentItems.find((it) => it.name.toLowerCase() === value.trim().toLowerCase());
    patchRow(row.key, {
      name: value,
      item_id: exactMatch ? exactMatch.id : null,
      createAsNew: exactMatch ? false : row.createAsNew,
    });
  };

  const selectSuggestion = (row, item) => {
    patchRow(row.key, { name: item.name, item_id: item.id, createAsNew: false });
  };

  const setUnit = (row, value) => {
    if (value === CUSTOM_UNIT) {
      setCustomUnitRows((s) => ({ ...s, [row.key]: true }));
      patchRow(row.key, { unit: '' });
    } else {
      patchRow(row.key, { unit: value });
    }
  };

  const revertToUnitList = (row) => {
    setCustomUnitRows((s) => ({ ...s, [row.key]: false }));
    patchRow(row.key, { unit: COMPONENT_UNITS[0] });
  };

  return (
    <div className="flex flex-col gap-3">
      {components.map((row) => {
        const trimmed = row.name.trim();
        const suggestions = trimmed && !row.item_id
          ? equipmentItems.filter((it) => it.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 6)
          : [];
        const hasExactMatch = equipmentItems.some((it) => it.name.toLowerCase() === trimmed.toLowerCase());
        const showCreateOption = trimmed && !row.item_id && !hasExactMatch;
        const isCustomUnit = customUnitRows[row.key] ?? !COMPONENT_UNITS.includes(row.unit);

        return (
          <div key={row.key} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <input
                  type="text"
                  className={inputClass}
                  value={row.name}
                  onChange={(e) => setName(row, e.target.value)}
                  placeholder="Назва компонента..."
                  maxLength={200}
                />
                {suggestions.length > 0 && (
                  <div className="mt-1 max-h-[140px] overflow-y-auto rounded-md border border-border bg-bg">
                    {suggestions.map((it) => (
                      <button
                        type="button"
                        key={it.id}
                        onClick={() => selectSuggestion(row, it)}
                        className="flex w-full items-center justify-between border-b border-border/50 px-3 py-1.5 text-left text-sm text-text-muted last:border-0 hover:text-accent"
                      >
                        {it.name}
                      </button>
                    ))}
                  </div>
                )}
                {row.item_id && (
                  <p className="mt-1 text-xs text-sage">Пов&rsquo;язано з предметом спорядження</p>
                )}
                {showCreateOption && (
                  <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs text-text-dim">
                    <input
                      type="checkbox"
                      checked={row.createAsNew}
                      onChange={(e) => patchRow(row.key, { createAsNew: e.target.checked })}
                      className="h-4 w-4 accent-accent"
                    />
                    Створити як новий предмет
                  </label>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                title="Видалити"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-danger/40 text-danger"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex gap-2">
              <IntInput
                value={row.quantity}
                onChange={(n) => patchRow(row.key, { quantity: n })}
                min={1}
                className={`${inputClass} w-20`}
              />
              {isCustomUnit ? (
                <div className="flex flex-1 items-center gap-2">
                  <input
                    type="text"
                    className={`${inputClass} flex-1`}
                    value={row.unit}
                    onChange={(e) => patchRow(row.key, { unit: e.target.value })}
                    placeholder="Своя одиниця виміру..."
                    maxLength={30}
                  />
                  <button
                    type="button"
                    onClick={() => revertToUnitList(row)}
                    className="shrink-0 text-xs text-text-dim underline"
                  >
                    зі списку
                  </button>
                </div>
              ) : (
                <select className={`${inputClass} flex-1`} value={row.unit} onChange={(e) => setUnit(row, e.target.value)}>
                  {COMPONENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  <option value={CUSTOM_UNIT}>Інша...</option>
                </select>
              )}
            </div>
          </div>
        );
      })}
      <button
        type="button" onClick={addRow}
        className="inline-flex w-fit items-center gap-1.5 rounded border border-dashed border-border px-3 py-1.5 text-sm text-text-dim"
      >
        <Plus size={14} /> Додати компонент
      </button>
    </div>
  );
}
