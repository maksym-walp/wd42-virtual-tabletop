import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import traditionsApi from '../api/traditions';
import { useAuth } from '../context/AuthContext';
import { pluralizeUk } from '../utils/pluralize';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import SmartTextReader from '../components/SmartTextReader';
import SpellCard from '../components/SpellCard';

export default function TraditionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';

  const [tradition, setTradition] = useState(null);
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [spellsLoading, setSpellsLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    traditionsApi.getOne(id)
      .then(setTradition)
      .catch(() => navigate('/spellbook/traditions', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  // Повні записи заклинань (з урахуванням видимості) — через той самий
  // фільтр ?tradition=, що й у каталозі, а не tradition.spells (там лише
  // id/назва і без перевірки, чи заклинання публічне).
  useEffect(() => {
    setSpellsLoading(true);
    api.get(`/api/spellbook/?tradition=${encodeURIComponent(id)}`)
      .then(({ data }) => setSpells(data.spells ?? []))
      .catch(console.error)
      .finally(() => setSpellsLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(`Видалити традицію «${tradition.name}»?`)) return;
    setDeleting(true);
    try {
      await traditionsApi.remove(id);
      navigate('/spellbook/traditions');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!tradition) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/spellbook/traditions" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Магічні традиції
      </Link>

      <div
        className="mx-auto mb-8 max-w-2xl overflow-hidden rounded-lg border border-border bg-surface"
        style={{ borderLeft: '4px solid var(--color-accent)' }}
      >
        <div className="border-b border-border bg-surface-hover px-4 py-2.5">
          <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Магічна традиція</span>
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{tradition.name}</h1>
        {tradition.founders && (
          <p className="px-5 pb-3 text-sm italic text-text-dim">Засновники: {tradition.founders}</p>
        )}

        {tradition.description && (
          <div className="border-t border-border px-5 py-3.5">
            <SmartTextReader text={tradition.description} className="text-[0.95rem] leading-relaxed text-text" />
          </div>
        )}

        {canManageTraditions && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/spellbook/traditions/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl text-accent">Заклинання традиції</h2>
        {!spellsLoading && (
          <span className="text-sm text-text-dim">
            {spells.length} {pluralizeUk(spells.length, ['заклинання', 'заклинання', 'заклинань'])}
          </span>
        )}
      </div>

      {spellsLoading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : spells.length === 0 ? (
        <EmptyState title="У цій традиції ще немає заклинань" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spells.map((spell) => <SpellCard key={spell.id} spell={spell} />)}
        </div>
      )}
    </div>
  );
}
