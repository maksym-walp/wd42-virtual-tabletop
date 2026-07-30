import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

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
      .catch(() => { if (!cancelled) navigate('/compendium/species', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleDeleteSpecies = async () => {
    if (!confirm('Видалити цей вид? Підвиди буде видалено разом з ним.')) return;
    setDeleting(true);
    try {
      await compendiumApi.removeSpecies(id);
      navigate('/compendium/species');
    } catch {
      setDeleting(false);
    }
  };

  const handleDeleteSubspecies = async (subId) => {
    if (!confirm('Видалити цей підвид?')) return;
    await compendiumApi.removeSubspecies(subId);
    setSubspecies((list) => list.filter((s) => s.id !== subId));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!species) return null;

  const isAdmin = user?.role === 'admin';
  const canManage = species.is_owner || isAdmin;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/compendium/species" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Види
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid var(--color-accent)' }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            {subspecies.length} підвидів
          </span>
          <span className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-semibold text-text-dim">
            Кубик здоров'я: {species.health_die || 'd6'}
          </span>
          {species.is_public && <span className="text-xs italic text-text-dim">публічний</span>}
        </div>

        <h1 className="px-5 pb-1 pt-4 font-display text-3xl text-accent">{species.name}</h1>
        {species.description && <p className="px-5 pb-3 text-sm text-text-muted">{species.description}</p>}

        <div className="border-t border-border">
          <div className="flex items-center justify-between bg-bg px-5 py-2">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Підвиди</span>
            {canManage && (
              <Button variant="ghost" size="sm" to={`/compendium/subspecies/new?species_id=${id}`}>+ Додати</Button>
            )}
          </div>
          <div className="px-5 py-3">
            {subspecies.length === 0 && <p className="text-sm text-text-dim">Підвидів ще немає</p>}
            {subspecies.map((sub) => (
              <div key={sub.id} className="flex items-center justify-between border-b border-bg py-2 last:border-0">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm text-text">
                    {sub.name} <span className="text-xs text-text-dim">({sub.health_die || 'd6'})</span>
                  </span>
                  {sub.description && <span className="text-xs text-text-dim">{sub.description}</span>}
                </div>
                {(sub.is_owner || isAdmin) && (
                  <div className="flex items-center gap-2">
                    <Link to={`/compendium/subspecies/${sub.id}/edit`} className="text-xs text-accent">Редагувати</Link>
                    <button type="button" className="px-2 text-sm text-danger" onClick={() => handleDeleteSubspecies(sub.id)}>✕</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {canManage && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/compendium/species/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDeleteSpecies} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
