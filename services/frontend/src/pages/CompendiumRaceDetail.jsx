import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ChangeOwnerControl from '../components/ChangeOwnerControl';
import SmartTextReader from '../components/SmartTextReader';
import LineageCard from '../components/compendium/LineageCard';
import ShareButton from '../components/ShareButton';

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
      .catch(() => { if (!cancelled) navigate('/compendium', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDeleteRace = async () => {
    if (!confirm('Видалити цю расу? Народи буде видалено разом з нею.')) return;
    setDeleting(true);
    try {
      await compendiumApi.removeRace(id);
      navigate('/compendium');
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
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/compendium" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Народи та види
      </Link>

      {/* Ліворуч — усе про расу загалом (назва, опис, власник, дії), праворуч —
          народів картками. На мобільному — одна колонка. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div
          className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-4 lg:self-start"
          style={{ borderTop: '3px solid var(--color-accent)' }}
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
              {peoples.length} народів
            </span>
            {race.is_public && <span className="text-xs italic text-text-dim">публічний</span>}
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
            <h1 className="font-display text-3xl text-accent">{race.name}</h1>
            <ShareButton className="mt-1" />
          </div>
          {race.description && (
            <SmartTextReader text={race.description} className="px-5 pb-4 text-sm leading-relaxed text-text-muted" />
          )}

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

        <div className="self-start">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Народи</span>
            {canManage && (
              <Button variant="ghost" size="sm" to={`/compendium/peoples/new?race_id=${id}`}>+ Додати</Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {peoples.length === 0 && <p className="text-sm text-text-dim">Народів ще немає</p>}
            {peoples.map((p) => (
              <LineageCard
                key={p.id}
                item={p}
                extra={p.origin ? <p className="text-xs italic text-text-dim">Походження: {p.origin}</p> : undefined}
                editTo={`/compendium/peoples/${p.id}/edit`}
                canManage={p.is_owner || isAdmin}
                isAdmin={isAdmin}
                onDelete={() => handleDeletePeople(p.id)}
                onSetOwner={(username) => handleSetPeopleOwner(p.id, username)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
