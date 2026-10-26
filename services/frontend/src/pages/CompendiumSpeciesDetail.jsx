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

export default function CompendiumSpeciesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [species, setSpecies] = useState(null);
  const [subspecies, setSubspecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([compendiumApi.getSpecies(id), compendiumApi.listSubspecies(id)])
      .then(([s, sub]) => { if (!cancelled) { setSpecies(s); setSubspecies(sub); } })
      .catch(() => { if (!cancelled) navigate('/compendium', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDeleteSpecies = async () => {
    if (!confirm('Видалити цей вид? Підвиди буде видалено разом з ним.')) return;
    setDeleting(true);
    try {
      await compendiumApi.removeSpecies(id);
      navigate('/compendium');
    } catch {
      setDeleting(false);
    }
  };

  const handleDeleteSubspecies = async (subId) => {
    if (!confirm('Видалити цей підвид?')) return;
    await compendiumApi.removeSubspecies(subId);
    setSubspecies((list) => list.filter((s) => s.id !== subId));
  };

  const handleSetSpeciesOwner = async (ownerUsername) => {
    setSpecies(await compendiumApi.setSpeciesOwner(id, ownerUsername));
  };

  const handleSetSubspeciesOwner = async (subId, ownerUsername) => {
    const updated = await compendiumApi.setSubspeciesOwner(subId, ownerUsername);
    setSubspecies((list) => list.map((s) => (s.id === subId ? updated : s)));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!species) return null;

  const isAdmin = user?.role === 'admin';
  const canManage = species.is_owner || isAdmin;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/compendium" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Народи та види
      </Link>

      {/* Ліворуч — усе про вид загалом (назва, опис, власник, дії), праворуч —
          підвидів картками. На мобільному — одна колонка. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div
          className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-4 lg:self-start"
          style={{ borderTop: '3px solid var(--color-accent)' }}
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
              {subspecies.length} підвидів
            </span>
            <span className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-semibold text-text-dim">
              Кубик здоров'я: {species.health_die || 'd6'}
            </span>
            {species.is_public && <span className="text-xs italic text-text-dim">публічний</span>}
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-1 pt-4">
            <h1 className="font-display text-3xl text-accent">{species.name}</h1>
            <ShareButton className="mt-1" />
          </div>
          {species.description && (
            <SmartTextReader text={species.description} className="px-5 pb-4 text-sm leading-relaxed text-text-muted" />
          )}

          {isAdmin && (
            <div className="flex gap-3 border-t border-border px-5 py-4">
              <ChangeOwnerControl onSubmit={handleSetSpeciesOwner} />
            </div>
          )}

          {canManage && (
            <div className="flex gap-3 border-t border-border px-5 py-4">
              <Button variant="ghost" to={`/compendium/species/${id}/edit`}>Редагувати</Button>
              <Button variant="danger" onClick={handleDeleteSpecies} disabled={deleting}>
                {deleting ? 'Видалення...' : 'Видалити'}
              </Button>
            </div>
          )}
        </div>

        <div className="self-start">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Підвиди</span>
            {canManage && (
              <Button variant="ghost" size="sm" to={`/compendium/subspecies/new?species_id=${id}`}>+ Додати</Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {subspecies.length === 0 && <p className="text-sm text-text-dim">Підвидів ще немає</p>}
            {subspecies.map((sub) => (
              <LineageCard
                key={sub.id}
                item={sub}
                badge={sub.health_die || 'd6'}
                editTo={`/compendium/subspecies/${sub.id}/edit`}
                canManage={sub.is_owner || isAdmin}
                isAdmin={isAdmin}
                onDelete={() => handleDeleteSubspecies(sub.id)}
                onSetOwner={(username) => handleSetSubspeciesOwner(sub.id, username)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
