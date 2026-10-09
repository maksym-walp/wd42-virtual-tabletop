import { useMemo, useState } from 'react';
import { inputClass } from './ui/Field';
import { abilityForms } from '../constants/abilities';

// Picks abilities / ability collections to attach to a skill-tree node, each
// with a mode: 'grant' (opening the node adds it to the character) or
// 'unlock' (opening the node just makes it available to add).
// value: [{ item_kind, item_id, mode, form_key }]
// form_key (abilities with 2+ forms): null — every form, else the key
// of the one form the node grants / opens (see constants/forms.js).
//
// Default mode follows the list size: a single entry is 'grant', two or more
// are all 'unlock'. It's recomputed on every add/remove, but only for entries
// added in this editing session whose mode the GM hasn't picked by hand —
// saved entries and manual choices are never overridden.
// Spells are not linked to nodes — a node opens spell traditions and
// complexity instead (NodeSpellAccessPicker).
const KIND_ORDER = ['ability', 'ability_collection'];
const KIND_LABEL = {
  ability: 'Вміння',
  ability_collection: 'Колекція вмінь',
};

export default function NodeGrantsPicker({ catalogs = {}, value = [], onChange }) {
  const [search, setSearch] = useState('');
  const [autoKeys, setAutoKeys] = useState(() => new Set()); // entries still on the default mode

  const pool = useMemo(() => {
    const rows = [
      ...(catalogs.abilities || []).map((x) => ({ item_kind: 'ability', id: x.id, name: x.name, forms: abilityForms(x) })),
      ...(catalogs.abilityCollections || []).map((x) => ({ item_kind: 'ability_collection', id: x.id, name: x.name })),
    ];
    rows.sort((a, b) => KIND_ORDER.indexOf(a.item_kind) - KIND_ORDER.indexOf(b.item_kind) || (a.name || '').localeCompare(b.name || ''));
    return rows;
  }, [catalogs]);

  const selectedKey = (g) => `${g.item_kind}:${g.item_id}`;
  const selectedMap = new Map(value.map((g) => [selectedKey(g), g]));

  const rowOf = (kind, id) => pool.find((p) => p.item_kind === kind && p.id === id);
  const nameOf = (kind, id) => rowOf(kind, id)?.name || '—';

  const withDefaults = (list, auto) => {
    const mode = list.length === 1 ? 'grant' : 'unlock';
    return list.map((g) => (auto.has(selectedKey(g)) ? { ...g, mode } : g));
  };

  const toggle = (row) => {
    const key = `${row.item_kind}:${row.id}`;
    const auto = new Set(autoKeys);
    let next;
    if (selectedMap.has(key)) {
      auto.delete(key);
      next = value.filter((g) => selectedKey(g) !== key);
    } else {
      auto.add(key);
      next = [...value, { item_kind: row.item_kind, item_id: row.id, mode: 'unlock', form_key: null }];
    }
    setAutoKeys(auto);
    onChange(withDefaults(next, auto));
  };

  const setMode = (g, mode) => {
    const auto = new Set(autoKeys);
    auto.delete(selectedKey(g));
    setAutoKeys(auto);
    onChange(value.map((x) => (selectedKey(x) === selectedKey(g) ? { ...x, mode } : x)));
  };

  const setFormKey = (g, formKey) => {
    onChange(value.map((x) => (selectedKey(x) === selectedKey(g) ? { ...x, form_key: formKey || null } : x)));
  };

  const available = search
    ? pool.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()))
    : pool;

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((g) => (
            <div key={selectedKey(g)} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg px-2.5 py-2 text-sm">
              <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[0.65rem] uppercase tracking-wide text-text-dim">
                {KIND_LABEL[g.item_kind]}
              </span>
              <span className="flex-1 text-text">{nameOf(g.item_kind, g.item_id)}</span>
              {(rowOf(g.item_kind, g.item_id)?.forms?.length ?? 0) > 1 && (
                <select
                  className="min-h-7 rounded border border-border bg-surface px-1.5 text-xs text-text"
                  value={g.form_key ?? ''}
                  onChange={(e) => setFormKey(g, e.target.value)}
                  title="Яку форму вузол видає / робить доступною"
                >
                  <option value="">Усі форми</option>
                  {rowOf(g.item_kind, g.item_id).forms.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              )}
              <div className="flex overflow-hidden rounded border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setMode(g, 'grant')}
                  className={`px-2 py-1 ${g.mode === 'grant' ? 'bg-sage/15 text-sage' : 'text-text-dim'}`}
                >
                  🎁 Видавати
                </button>
                <button
                  type="button"
                  onClick={() => setMode(g, 'unlock')}
                  className={`px-2 py-1 ${g.mode === 'unlock' ? 'bg-accent/15 text-accent' : 'text-text-dim'}`}
                >
                  🔓 Доступним
                </button>
              </div>
              <button type="button" onClick={() => toggle({ item_kind: g.item_kind, id: g.item_id })} className="text-text-dim hover:text-danger">
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        type="text"
        className={`${inputClass} text-sm`}
        placeholder="Пошук вміння чи колекції..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-[220px] overflow-y-auto rounded-md border border-border bg-bg">
        {available.length === 0 && (
          <p className="px-3 py-2 text-sm text-text-dim">Нічого не знайдено</p>
        )}
        {available.map((row) => {
          const isSelected = selectedMap.has(`${row.item_kind}:${row.id}`);
          return (
            <button
              type="button"
              key={`${row.item_kind}:${row.id}`}
              onClick={() => toggle(row)}
              className={`flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-sm last:border-0 hover:bg-surface-hover ${isSelected ? 'text-text-dim' : 'text-text-muted'}`}
            >
              <span className="flex items-center gap-2">
                <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide text-text-dim">
                  {KIND_LABEL[row.item_kind]}
                </span>
                {row.name}
              </span>
              <span className={isSelected ? 'text-danger' : 'text-accent'}>{isSelected ? '✓' : '+'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
