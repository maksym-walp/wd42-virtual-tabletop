import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ChangeOwnerControl from '../components/ChangeOwnerControl';
import SmartTextReader from '../components/SmartTextReader';
import { htmlToPreviewText } from '../utils/richText';

// Mirrors CompendiumSpeciesDetail.jsx, minus health_die, plus each people's
// origin field.
export default function CompendiumRaceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [race, setRace] = useState(null);
  const [peoples, setPeoples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([compendiumApi.getRace(id), compendiumApi.listPeoples(id)])
      .then(([r, p]) => { if (!cancelled) { setRace(r); setPeoples(p); } })
      .catch(() => { if (!cancelled) navigate('/compendium/taxonomy', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDeleteRace = async () => {
    if (!confirm('Видалити цю расу? Народи буде видалено разом з нею.')) return;
    setDeleting(true);
    try {
      await compendiumApi.removeRace(id);
      navigate('/compendium/taxonomy');
    } catch {
      setDeleting(false);
    }
  };

  const handleDeletePeople = async (peopleId) => {
    if (!confirm('Видалити цей народ?')) return;
    await compendiumApi.removePeople(peopleId);
    setPeoples((list) => list.filter((p) => p.id !== peopleId));
  };

  const handleSetRaceOwner = async (ownerUsername) => {
    setRace(await compendiumApi.setRaceOwner(id, ownerUsername));
  };

  const handleSetPeopleOwner = async (peopleId, ownerUsername) => {
    const updated = await compendiumApi.setPeopleOwner(peopleId, ownerUsername);
    setPeoples((list) => list.map((p) => (p.id === peopleId ? updated : p)));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!race) return null;

  const isAdmin = user?.role === 'admin';
  const canManage = race.is_owner || isAdmin;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/compendium/taxonomy" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Народи та види
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid var(--color-accent)' }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            {peoples.length} народів
          </span>
          {race.is_public && <span className="text-xs italic text-text-dim">публічний</span>}
        </div>

        <h1 className="px-5 pb-1 pt-4 font-display text-3xl text-accent">{race.name}</h1>
        {race.description && (
          <SmartTextReader text={race.description} className="px-5 pb-3 text-sm text-text-muted" />
        )}

        <div className="border-t border-border">
          <div className="flex items-center justify-between bg-bg px-5 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Народи</span>
            {canManage && (
              <Button variant="ghost" size="sm" to={`/compendium/peoples/new?race_id=${id}`}>+ Додати</Button>
            )}
          </div>
          <div className="px-5 py-3">
            {peoples.length === 0 && <p className="text-sm text-text-dim">Народів ще немає</p>}
            {peoples.map((p) => (
              <div key={p.id} className="flex items-center justify-between border-b border-bg py-2 last:border-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-text">{p.name}</span>
                  {p.description && <span className="text-xs text-text-dim">{htmlToPreviewText(p.description)}</span>}
                  {p.origin && <span className="text-xs italic text-text-dim">Походження: {p.origin}</span>}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {(p.is_owner || isAdmin) && (
                    <div className="flex items-center gap-2">
                      <Link to={`/compendium/peoples/${p.id}/edit`} className="text-xs text-accent">Редагувати</Link>
                      <button type="button" className="px-2 text-sm text-danger" onClick={() => handleDeletePeople(p.id)}>✕</button>
                    </div>
                  )}
                  {isAdmin && (
                    <ChangeOwnerControl onSubmit={(username) => handleSetPeopleOwner(p.id, username)} />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isAdmin && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <ChangeOwnerControl onSubmit={handleSetRaceOwner} />
          </div>
        )}

        {canManage && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/compendium/races/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDeleteRace} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
