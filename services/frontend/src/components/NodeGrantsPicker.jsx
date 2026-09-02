import { useMemo, useState } from 'react';
import { inputClass } from './ui/Field';

// Picks catalog entries / collections to attach to a skill-tree node, each
// with a mode: 'grant' (opening the node adds it to the character) or
// 'unlock' (opening the node just makes it available to add).
// value: [{ item_kind, item_id, mode }]
const KIND_ORDER = ['ability', 'maneuver', 'spell', 'ability_collection', 'spell_collection'];
const KIND_LABEL = {
  ability: 'Вміння',
  maneuver: 'Маневр',
  spell: 'Заклинання',
  ability_collection: 'Колекція вмінь',
  spell_collection: 'Колекція заклинань',
};

export default function NodeGrantsPicker({ catalogs = {}, value = [], onChange }) {
  const [search, setSearch] = useState('');

  const pool = useMemo(() => {
    const rows = [
      ...(catalogs.abilities || []).map((x) => ({ item_kind: 'ability', id: x.id, name: x.name })),
      ...(catalogs.maneuvers || []).map((x) => ({ item_kind: 'maneuver', id: x.id, name: x.name })),
      ...(catalogs.spells || []).map((x) => ({ item_kind: 'spell', id: x.id, name: x.name })),
      ...(catalogs.abilityCollections || []).map((x) => ({ item_kind: 'ability_collection', id: x.id, name: x.name })),
      ...(catalogs.spellCollections || []).map((x) => ({ item_kind: 'spell_collection', id: x.id, name: x.name })),
    ];
    rows.sort((a, b) => KIND_ORDER.indexOf(a.item_kind) - KIND_ORDER.indexOf(b.item_kind) || (a.name || '').localeCompare(b.name || ''));
    return rows;
  }, [catalogs]);

  const selectedKey = (g) => `${g.item_kind}:${g.item_id}`;
  const selectedMap = new Map(value.map((g) => [selectedKey(g), g]));

  const nameOf = (kind, id) => pool.find((p) => p.item_kind === kind && p.id === id)?.name || '—';

  const toggle = (row) => {
    const key = `${row.item_kind}:${row.id}`;
    if (selectedMap.has(key)) {
      onChange(value.filter((g) => selectedKey(g) !== key));
    } else {
      onChange([...value, { item_kind: row.item_kind, item_id: row.id, mode: 'unlock' }]);
    }
  };

  const setMode = (g, mode) => {
    onChange(value.map((x) => (selectedKey(x) === selectedKey(g) ? { ...x, mode } : x)));
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
        placeholder="Пошук вміння, заклинання, маневру, колекції..."
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
