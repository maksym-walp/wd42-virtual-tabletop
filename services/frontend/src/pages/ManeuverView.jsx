import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import Button from '../components/ui/Button';

export default function ManeuverView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [maneuver, setManeuver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/api/maneuvers/${id}`)
      .then(({ data }) => setManeuver(data.maneuver))
      .catch(() => navigate('/maneuvers', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цей маневр?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/maneuvers/${id}`);
      navigate('/maneuvers');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!maneuver) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/maneuvers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Маневри
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid #8a5a2b' }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5">
          <span className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-text-dim">
            {maneuver.duration_actions} {maneuver.duration_actions === 1 ? 'дія' : 'дії'}
          </span>
          {maneuver.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{maneuver.name}</h1>

        {maneuver.description && (
          <Section title="Опис">
            <p className="text-[0.95rem] leading-relaxed text-text">{maneuver.description}</p>
          </Section>
        )}

        {maneuver.is_owner && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/maneuvers/${id}/edit`}>Редагувати</Button>
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
