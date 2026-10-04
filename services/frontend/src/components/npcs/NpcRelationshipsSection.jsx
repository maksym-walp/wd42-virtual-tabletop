import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import npcsApi from '../../api/npcs';
import { useAuth } from '../../context/AuthContext';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';
import usePersonCatalog from './usePersonCatalog';
import { personHref, PERSON_TYPE_LABELS } from './personLinks';

// "Звʼязки" on an NPC's page. Outgoing links are directed — "X is <label> to
// this NPC" (Bob — брат), X being another NPC or a player character — and
// editable by whoever may edit this NPC. Incoming links (other NPCs pointing
// here) are shown read-only under "Згадується у звʼязках" as "для Alice —
// брат"; they belong to the other NPC.
export default function NpcRelationshipsSection({ npcId, canEdit, Section }) {
  const { user } = useAuth();
  const [data, setData] = useState({ outgoing: [], incoming: [] });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const reload = () => npcsApi.listRelationships(npcId).then(setData).catch(() => setData({ outgoing: [], incoming: [] }));

  useEffect(() => { reload(); }, [npcId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action) => {
    setError('');
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти');
      return false;
    }
  };

  const { outgoing, incoming } = data;
  if (!outgoing.length && !incoming.length && !canEdit) return null;

  return (
    <Section title="Звʼязки">
      {outgoing.length === 0 && !adding && <p className="text-sm text-text-dim">Звʼязків не вказано</p>}
      <ul className="flex flex-col gap-2">
        {outgoing.map((r) => (
          <RelationshipRow
            key={r.id} relationship={r} userId={user?.id} canEdit={canEdit}
            onSave={(patch) => run(() => npcsApi.updateRelationship(npcId, r.id, patch))}
            onRemove={() => run(() => npcsApi.removeRelationship(npcId, r.id))}
          />
        ))}
      </ul>

      {canEdit && (
        adding ? (
          <AddRelationshipForm
            npcId={npcId}
            taken={new Set(outgoing.map((r) => `${r.target_type}:${r.target_id}`))}
            onCancel={() => setAdding(false)}
            onSubmit={async (payload) => {
              if (await run(() => npcsApi.addRelationship(npcId, payload))) setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="mt-3 text-sm text-accent" onClick={() => setAdding(true)}>+ Додати звʼязок</button>
        )
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}

      {incoming.length > 0 && (
        <div className="mt-4">
          <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">Згадується у звʼязках</span>
          <ul className="flex flex-col gap-1">
            {incoming.map((r) => (
              <li key={r.id} className="text-sm text-text">
                <span className="text-text-dim">для </span>
                <Link to={`/npcs/${r.npc.id}`} className="text-accent hover:underline">{r.npc.name}</Link>
                <span className="text-text-dim"> — </span>{r.label}
                {r.note && <span className="text-text-dim"> ({r.note})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function RelationshipRow({ relationship: r, userId, canEdit, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(r.label);
  const [note, setNote] = useState(r.note || '');
  const href = personHref(r.target_type, r.target, userId);

  const save = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    if (await onSave({ label: label.trim(), note: note.trim() || null })) setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-md border border-border bg-bg p-3">
        <form onSubmit={save} className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-text">{r.target?.name}</span>
          <input className={inputClass} value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} placeholder="Хто для нього (брат, ворог...)" required />
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Нотатка (необовʼязково)" />
          <div className="flex gap-2">
            <Button type="submit" size="sm">Зберегти</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Скасувати</Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-bg px-3 py-2">
      <div className="min-w-0 flex-1 text-sm">
        {href ? <Link to={href} className="text-accent hover:underline">{r.target.name}</Link> : <span className="text-text">{r.target?.name}</span>}
        <span className="ml-1.5 rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{PERSON_TYPE_LABELS[r.target_type]}</span>
        <span className="text-text-dim"> — </span>
        <span className="font-semibold text-text">{r.label}</span>
        {r.note && <p className="mt-0.5 text-xs text-text-dim">{r.note}</p>}
      </div>
      {canEdit && (
        <div className="flex gap-1">
          <button type="button" className="min-h-8 px-2 text-xs text-accent" onClick={() => setEditing(true)}>Змінити</button>
          <button
            type="button" className="flex h-8 w-8 items-center justify-center text-sm text-danger" title="Видалити звʼязок"
            onClick={() => { if (confirm('Видалити цей звʼязок?')) onRemove(); }}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

function AddRelationshipForm({ npcId, taken, onSubmit, onCancel }) {
  const people = usePersonCatalog(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');

  const options = people.filter((p) =>
    !(p.type === 'npc' && p.id === npcId) &&
    !taken.has(`${p.type}:${p.id}`) &&
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const submit = (e) => {
    e.preventDefault();
    if (!target || !label.trim()) return;
    onSubmit({ targetType: target.type, targetId: target.id, label: label.trim(), note: note.trim() || null });
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
      {target ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-text">{target.name}</span>
          <span className="rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{PERSON_TYPE_LABELS[target.type]}</span>
          <button type="button" className="ml-auto text-xs text-accent" onClick={() => setTarget(null)}>Змінити</button>
        </div>
      ) : (
        <>
          <input className={`${inputClass} text-sm`} placeholder="Пошук НІПа чи персонажа..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="max-h-[200px] overflow-y-auto">
            {options.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних персонажів</p>}
            {options.map((p) => (
              <button
                key={`${p.type}:${p.id}`} type="button"
                className="flex w-full items-center justify-between border-b border-border/40 py-1.5 text-left text-sm text-text-muted hover:text-accent"
                onClick={() => setTarget(p)}
              >
                {p.name}
                <span className="rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{PERSON_TYPE_LABELS[p.type]}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <input
        className={inputClass} placeholder="Хто він для цього НІПа (брат, ворог, наставник...)" maxLength={100}
        value={label} onChange={(e) => setLabel(e.target.value)} required
      />
      <input className={inputClass} placeholder="Нотатка (необовʼязково)" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!target || !label.trim()}>Додати</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Скасувати</Button>
      </div>
    </form>
  );
}
