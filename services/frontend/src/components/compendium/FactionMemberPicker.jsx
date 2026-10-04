import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { inputClass } from '../ui/Field';
import usePersonCatalog from '../npcs/usePersonCatalog';
import { personHref, PERSON_TYPE_LABELS } from '../npcs/personLinks';
import RoleInput from '../npcs/RoleInput';

// Faction members can be either an NPC or a player character — two catalog
// sources merged into one list (usePersonCatalog). Variant of
// CatalogAttachPicker.jsx (same search + list + add/remove shape) plus a
// per-member role — the same role an NPC's own page shows and edits.
export default function FactionMemberPicker({
  label = 'Учасники', addLabel = 'Додати учасника', attached, onAdd, onRemove, onRoleChange,
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const catalog = usePersonCatalog(showPicker);

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
          <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              className={`${inputClass} text-sm`} placeholder="Пошук..." value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <input
              className={`${inputClass} text-sm`} placeholder="Роль нового учасника (необовʼязково)" maxLength={200}
              value={role} onChange={(e) => setRole(e.target.value)}
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {filtered.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних елементів</p>}
            {filtered.map((item) => (
              <div key={`${item.type}:${item.id}`} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                <span>
                  {item.name}
                  <span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{PERSON_TYPE_LABELS[item.type]}</span>
                </span>
                <button
                  type="button"
                  className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent"
                  onClick={() => onAdd(item.type, item.id, role.trim() || null)}
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
          const href = personHref(entry.member_type, entry.member, user?.id);
          return (
            <div key={`${entry.member_type}:${entry.member_id}`} className="mb-1.5 flex flex-wrap items-center gap-3 rounded-md border border-border bg-bg px-3 py-2.5">
              {href ? (
                <Link to={href} className="min-w-0 flex-1 text-sm text-text">{entry.member?.name}</Link>
              ) : (
                <span className="min-w-0 flex-1 text-sm text-text-dim">{entry.member?.name ?? '(невідомо)'}</span>
              )}
              <span className="rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{PERSON_TYPE_LABELS[entry.member_type]}</span>
              {onRoleChange && (
                <RoleInput
                  value={entry.role} className="w-full sm:w-48"
                  onSave={(next) => onRoleChange(entry.member_type, entry.member_id, next)}
                />
              )}
              <button
                type="button" className="flex h-9 w-9 items-center justify-center text-sm text-danger"
                onClick={() => onRemove(entry.member_type, entry.member_id)}
              >
                ✕
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
