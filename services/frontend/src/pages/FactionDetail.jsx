import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import npcsApi from '../api/npcs';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ChangeOwnerControl from '../components/ChangeOwnerControl';
import SmartTextReader from '../components/SmartTextReader';
import ShareButton from '../components/ShareButton';
import DataTable from '../components/ui/DataTable';
import RoleInput from '../components/npcs/RoleInput';
import { personHref, PERSON_TYPE_LABELS } from '../components/npcs/personLinks';

export default function FactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [faction, setFaction] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      npcsApi.getFaction(id),
      npcsApi.listFactionLeaders(id),
      npcsApi.listFactionMembers(id),
    ])
      .then(([f, l, m]) => { if (!cancelled) { setFaction(f); setLeaders(l); setMembers(m); } })
      .catch(() => { if (!cancelled) navigate('/npcs/factions', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цю фракцію?')) return;
    setDeleting(true);
    try {
      await npcsApi.removeFaction(id);
      navigate('/npcs/factions');
    } catch {
      setDeleting(false);
    }
  };

  // Same faction_members row an NPC's own page edits — see NpcFactionsSection.
  const handleRoleChange = async (member, role) => {
    const updated = await npcsApi.updateFactionMember(id, member.member_type, member.member_id, role);
    setMembers((list) => list.map((m) => (m.id === member.id ? { ...m, role: updated.role } : m)));
  };

  const handleSetOwner = async (ownerUsername) => {
    setFaction(await npcsApi.setFactionOwner(id, ownerUsername));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!faction) return null;

  const isAdmin = user?.role === 'admin';
  const canManage = faction.is_owner || isAdmin;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/npcs/factions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Фракції
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid var(--color-accent)' }}>
        <div className="flex items-center gap-4 px-5 pt-5">
          {faction.symbol_url ? (
            <img src={faction.symbol_url} alt="" className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover" />
          ) : (
            <div className="h-20 w-20 shrink-0 rounded-lg border-2 border-dashed border-border" />
          )}
          <div>
            <div className="flex items-start gap-2">
              <h1 className="font-display text-3xl text-accent">{faction.name}</h1>
              <ShareButton className="mt-1" />
            </div>
            {faction.is_public && <span className="text-xs italic text-text-dim">публічна</span>}
          </div>
        </div>
        {faction.description && (
          <SmartTextReader text={faction.description} className="px-5 pb-3 pt-3 text-sm text-text-muted" />
        )}

        <div className="border-t border-border">
          <div className="bg-bg px-5 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Керівники</span>
          </div>
          <div className="px-5 py-3">
            {leaders.length === 0 && <p className="text-sm text-text-dim">Немає</p>}
            {leaders.map((l) => (
              <Link key={l.npc_entry_id} to={`/npcs/${l.npc_entry_id}`} className="block py-1 text-sm text-text hover:text-accent">
                {l.npc?.name ?? '(невідомо)'}
              </Link>
            ))}
          </div>
        </div>

        <div className="border-t border-border">
          <div className="bg-bg px-5 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Учасники</span>
          </div>
          <div className="px-5 py-3">
            {members.length === 0 ? (
              <p className="text-sm text-text-dim">Немає</p>
            ) : (
              <DataTable
                items={members}
                getKey={(m) => `${m.member_type}:${m.member_id}`}
                columns={[
                  {
                    key: 'name', label: "Ім'я",
                    render: (m) => {
                      const href = personHref(m.member_type, m.member, user?.id);
                      const name = m.member?.name ?? '(невідомо)';
                      return href ? <Link to={href} className="text-accent hover:underline">{name}</Link> : name;
                    },
                  },
                  { key: 'type', label: 'Тип', render: (m) => PERSON_TYPE_LABELS[m.member_type] },
                  {
                    key: 'role', label: 'Роль',
                    render: (m) => (canManage
                      ? <RoleInput value={m.role} onSave={(role) => handleRoleChange(m, role)} />
                      : (m.role || '—')),
                  },
                ]}
              />
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <ChangeOwnerControl onSubmit={handleSetOwner} />
          </div>
        )}

        {canManage && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/npcs/factions/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
