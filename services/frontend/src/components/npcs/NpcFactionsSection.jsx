import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import npcsApi from '../../api/npcs';
import { useAuth } from '../../context/AuthContext';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';

// "Фракції" on an NPC's page: every faction it belongs to (with its role) or
// leads. Writes go to the same faction_members rows the faction's own member
// table shows, so a role edited here is the role seen there and vice versa.
// Membership is the faction's data — only factions the viewer may edit
// (own, or any for an admin) can be joined/changed from here.
export default function NpcFactionsSection({ npcId, Section }) {
  const { user } = useAuth();
  const [memberships, setMemberships] = useState([]);
  const [factions, setFactions] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newFactionId, setNewFactionId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [error, setError] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'game_master';
  const reload = () => npcsApi.listNpcFactions(npcId).then(setMemberships).catch(() => setMemberships([]));

  useEffect(() => { reload(); }, [npcId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!adding || factions.length) return;
    npcsApi.listFactions().then(setFactions).catch(() => {});
  }, [adding]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberOf = new Set(memberships.filter((m) => m.is_member).map((m) => m.id));
  const joinable = factions.filter((f) => (f.is_owner || user?.role === 'admin') && !memberOf.has(f.id));

  const run = async (action) => {
    setError('');
    try {
      await action();
      await reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти');
    }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!newFactionId) return;
    run(async () => {
      await npcsApi.joinFaction(npcId, newFactionId, newRole.trim() || null);
      setNewFactionId(''); setNewRole(''); setAdding(false);
    });
  };

  if (!memberships.length && !canManage) return null;

  return (
    <Section title="Фракції">
      {memberships.length === 0 && <p className="text-sm text-text-dim">Не належить до жодної фракції</p>}
      <ul className="flex flex-col gap-2">
        {memberships.map((m) => (
          <MembershipRow
            key={m.id} membership={m}
            onSaveRole={(role) => run(() => npcsApi.updateFactionRole(npcId, m.id, role))}
            onLeave={() => run(() => npcsApi.leaveFaction(npcId, m.id))}
          />
        ))}
      </ul>

      {canManage && (
        adding ? (
          <form onSubmit={handleJoin} className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-center">
            <select className={`${inputClass} sm:flex-1`} value={newFactionId} onChange={(e) => setNewFactionId(e.target.value)} required>
              <option value="">Оберіть фракцію</option>
              {joinable.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input
              className={`${inputClass} sm:flex-1`} placeholder="Роль (необовʼязково)" maxLength={200}
              value={newRole} onChange={(e) => setNewRole(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!newFactionId}>Додати</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Скасувати</Button>
            </div>
          </form>
        ) : (
          <button type="button" className="mt-3 text-sm text-accent" onClick={() => setAdding(true)}>+ Додати до фракції</button>
        )
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Section>
  );
}

function MembershipRow({ membership: m, onSaveRole, onLeave }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(m.role || '');

  useEffect(() => { setRole(m.role || ''); }, [m.role]);

  const save = (e) => {
    e.preventDefault();
    onSaveRole(role.trim() || null);
    setEditing(false);
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-bg px-3 py-2">
      {m.symbol_url
        ? <img src={m.symbol_url} alt="" className="h-8 w-8 shrink-0 rounded border border-border object-cover" />
        : <div className="h-8 w-8 shrink-0 rounded border-2 border-dashed border-border" />}
      <div className="min-w-0 flex-1">
        <Link to={`/npcs/factions/${m.id}`} className="text-sm font-semibold text-text hover:text-accent">{m.name}</Link>
        {editing ? (
          <form onSubmit={save} className="mt-1 flex gap-2">
            <input
              className={`${inputClass} text-sm`} value={role} maxLength={200} autoFocus
              onChange={(e) => setRole(e.target.value)} placeholder="Роль"
            />
            <Button type="submit" size="sm">OK</Button>
          </form>
        ) : (
          m.is_member && <p className="text-xs text-text-dim">{m.role || 'Роль не вказана'}</p>
        )}
      </div>
      {m.is_leader && (
        <span className="rounded border border-accent/50 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-accent">Лідер</span>
      )}
      {m.can_edit && m.is_member && !editing && (
        <div className="flex gap-1">
          <button type="button" className="min-h-8 px-2 text-xs text-accent" onClick={() => setEditing(true)}>Роль</button>
          <button
            type="button" className="flex h-8 w-8 items-center justify-center text-sm text-danger" title="Вийти з фракції"
            onClick={() => { if (confirm(`Прибрати НІПа з фракції «${m.name}»?`)) onLeave(); }}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}
