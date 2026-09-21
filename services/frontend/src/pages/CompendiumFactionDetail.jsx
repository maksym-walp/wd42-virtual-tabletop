import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import SmartTextReader from '../components/SmartTextReader';

const TYPE_LABELS = { npc: 'НІП', character: 'Персонаж' };

export default function CompendiumFactionDetail() {
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
      compendiumApi.getFaction(id),
      compendiumApi.listFactionLeaders(id),
      compendiumApi.listFactionMembers(id),
    ])
      .then(([f, l, m]) => { if (!cancelled) { setFaction(f); setLeaders(l); setMembers(m); } })
      .catch(() => { if (!cancelled) navigate('/compendium/factions', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цю фракцію?')) return;
    setDeleting(true);
    try {
      await compendiumApi.removeFaction(id);
      navigate('/compendium/factions');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!faction) return null;

  const isAdmin = user?.role === 'admin';
  const canManage = faction.is_owner || isAdmin;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/compendium/factions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
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
            <h1 className="font-display text-3xl text-accent">{faction.name}</h1>
            {faction.is_public && <span className="text-xs italic text-text-dim">публічна</span>}
          </div>
        </div>
        {faction.description && (
          <p className="px-5 pb-3 pt-3 text-sm text-text-muted"><SmartTextReader text={faction.description} /></p>
        )}

        <div className="border-t border-border">
          <div className="bg-bg px-5 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Керівники</span>
          </div>
          <div className="px-5 py-3">
            {leaders.length === 0 && <p className="text-sm text-text-dim">Немає</p>}
            {leaders.map((l) => (
              <Link key={l.npc_entry_id} to={`/compendium/entries/${l.npc_entry_id}`} className="block py-1 text-sm text-text hover:text-accent">
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
            {members.length === 0 && <p className="text-sm text-text-dim">Немає</p>}
            {members.map((m) => (
              <div key={`${m.member_type}:${m.member_id}`} className="flex items-center gap-2 py-1 text-sm">
                {m.member_type === 'npc' ? (
                  <Link to={`/compendium/entries/${m.member_id}`} className="text-text hover:text-accent">{m.member?.name ?? '(невідомо)'}</Link>
                ) : (
                  <span className="text-text-dim">{m.member?.name ?? '(невідомо)'}</span>
                )}
                <span className="rounded border border-border px-1 py-0.5 text-[0.65rem] text-text-dim">{TYPE_LABELS[m.member_type]}</span>
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/compendium/factions/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
