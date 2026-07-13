import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { ARCHETYPES, ARCHETYPE_COLORS } from '../constants/characterSheet';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';

export default function AbilityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ability, setAbility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/api/abilities/${id}`)
      .then(({ data }) => setAbility(data.ability))
      .catch(() => navigate('/abilities', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити це вміння?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/abilities/${id}`);
      navigate('/abilities');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!ability) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/abilities" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Вміння
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid #8a5a2b' }}>
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          {(ability.archetypes ?? []).map((a) => (
            <span
              key={a}
              className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
              style={{ borderColor: ARCHETYPE_COLORS[a]?.color, color: ARCHETYPE_COLORS[a]?.color }}
            >
              {ARCHETYPES[a]?.label ?? a}
            </span>
          ))}
          {ability.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{ability.name}</h1>

        {ability.description && (
          <Section title="Опис">
            <p className="text-[0.95rem] leading-relaxed text-text">{ability.description}</p>
          </Section>
        )}

        {ability.prerequisite_nodes?.length > 0 && (
          <Section title="Вимоги дерева розвитку">
            <div className="flex flex-col gap-1.5">
              {ability.prerequisite_nodes.map((n) => (
                <span key={n.id} className="flex items-center gap-1.5 text-sm text-text">
                  <ReqBadge type={ability.prerequisite_logic === 'and' ? 'required' : 'optional'} />
                  {n.title}
                </span>
              ))}
            </div>
          </Section>
        )}

        {ability.is_owner && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/abilities/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border-t border-border">
      <div className="bg-bg px-5 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="px-5 py-3.5">{children}</div>
    </div>
  );
}
