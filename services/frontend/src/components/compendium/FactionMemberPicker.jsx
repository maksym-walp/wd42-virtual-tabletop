import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import compendiumApi from '../../api/compendium';
import characterApi from '../../api/characterSheet';
import { inputClass } from '../ui/Field';

const TYPE_LABELS = { npc: 'НІП', character: 'Персонаж' };

// Faction members can be either an NPC (compendium) or a player character
// (character-sheet) — two different catalog sources merged into one list.
// Variant of CatalogAttachPicker.jsx (same search + list + add/remove
// shape), which only supports a single catalogApi and so can't drive this.
export default function FactionMemberPicker({ label = 'Учасники', addLabel = 'Додати учасника', attached, onAdd, onRemove }) {
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!showPicker || catalog.length) return;
    Promise.all([
      compendiumApi.listEntries('npc'),
      characterApi.list().catch(() => []),
      characterApi.listCommunity().catch(() => []),
    ]).then(([npcs, own, community]) => {
      const npcItems = npcs.map((n) => ({ id: n.id, name: n.name, type: 'npc' }));
      const seenCharacters = new Map();
      [...own, ...community].forEach((c) => seenCharacters.set(c.id, c));
      const characterItems = [...seenCharacters.values()].map((c) => ({ id: c.id, name: c.name, type: 'character' }));
      setCatalog([...npcItems, ...characterItems]);
    }).catch(() => {});
  }, [showPicker]);

  const knownKeys = useMemo(
    () => new Set(attached.map((a) => `${a.member_type}:${a.member_id}`)),
    [attached]
  );
  const filtered = catalog.filter((item) =>
    !knownKeys.has(`${item.type}:${item.id}`) &&
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{label}</span>
        <button
          type="button"
          className="min-h-7 rounded border border-border px-2.5 py-1 text-xs text-accent"
          onClick={() => setShowPicker((v) => !v)}
        >
          {showPicker ? '✕ Закрити' : `+ ${addLabel}`}
        </button>
      </div>

      {showPicker && (
        <div className="mb-3 rounded-md border border-border bg-bg p-3">
          <input
            className={`${inputClass} mb-2 text-sm`} placeholder="Пошук..." value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних елементів</p>}
            {filtered.map((item) => (
              <div key={`${item.type}:${item.id}`} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                <span>
                  {item.name}
                  <span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{TYPE_LABELS[item.type]}</span>
                </span>
                <button
                  type="button"
                  className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent"
                  onClick={() => onAdd(item.type, item.id)}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {attached.length === 0 ? (
        <p className="text-sm text-text-dim">Немає</p>
      ) : (
        attached.map((entry) => (
          <div key={`${entry.member_type}:${entry.member_id}`} className="mb-1.5 flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
            {entry.member && entry.member_type === 'npc' ? (
              <Link to={`/compendium/entries/${entry.member.id}`} className="flex-1 text-sm text-text">{entry.member.name}</Link>
            ) : (
              <span className="flex-1 text-sm text-text-dim">{entry.member?.name ?? '(невідомо)'}</span>
            )}
            <span className="rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{TYPE_LABELS[entry.member_type]}</span>
            <button
              type="button" className="flex h-9 w-9 items-center justify-center text-sm text-danger"
              onClick={() => onRemove(entry.member_type, entry.member_id)}
            >
              ✕
            </button>
          </div>
        ))
      )}
    </div>
  );
}
