import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import RollButton from '../RollButton';
import CanonBadge from '../CanonBadge';
import ScopeFilter, { matchesScope } from '../ScopeFilter';
import { inputClass } from '../ui/Field';

// Attaches existing catalog entries (equipment/spells/maneuvers) from another
// microservice to a compendium entry. Same search + ScopeFilter + list +
// "+"/"x" shape used three times in the entry form (one per catalog), so it's
// one component instead of copy-pasted per catalog — mirrors the inline
// picker pattern in CharacterSheet.jsx's EquipmentTypeSection/ManeuversTab,
// factored since all three are being authored fresh together here.
export default function CatalogAttachPicker({
  label, addLabel, catalogApi, attached, attachedIdField, onAdd, onRemove, itemLink, itemMeta, rollFormula,
}) {
  const [catalog, setCatalog] = useState([]);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    if (!showPicker || catalog.length) return;
    catalogApi.getAll().then(setCatalog).catch(() => {});
  }, [showPicker]);

  const knownIds = useMemo(() => new Set(attached.map((a) => a[attachedIdField])), [attached, attachedIdField]);
  const filtered = catalog.filter((item) =>
    !knownIds.has(item.id) &&
    matchesScope(item, scope) &&
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
          <ScopeFilter scope={scope} onChange={setScope} size="sm" className="mb-2" />
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних елементів</p>}
            {filtered.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                <span>
                  {item.name}
                  {item.is_canonical && <CanonBadge className="ml-1.5" />}
                </span>
                <button
                  type="button"
                  className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent"
                  onClick={() => onAdd(item.id)}
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
        attached.map((entry) => {
          const item = entry.equipment || entry.spell || entry.maneuver;
          const externalId = entry[attachedIdField];
          return (
            <div key={externalId} className="mb-1.5 flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
              {item && itemLink ? (
                <Link to={itemLink(item)} className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm text-text">{item.name}</span>
                  {itemMeta && <span className="text-xs text-text-dim">{itemMeta(item)}</span>}
                </Link>
              ) : (
                <span className="flex-1 text-sm text-text-dim">{item?.name ?? '(невідомо)'}</span>
              )}
              {item && rollFormula && rollFormula(item) && <RollButton formula={rollFormula(item)} />}
              <button type="button" className="flex h-9 w-9 items-center justify-center text-sm text-danger" onClick={() => onRemove(externalId)}>
                ✕
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
