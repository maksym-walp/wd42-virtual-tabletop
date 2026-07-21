import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { recordView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';
import { useAuth } from '../context/AuthContext';

export default function ManeuverView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [maneuver, setManeuver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);

  useEffect(() => {
    api.get(`/api/maneuvers/${id}`)
      .then(({ data }) => {
        setManeuver(data.maneuver);
        recordView({ type: 'maneuver', id, name: data.maneuver.name, href: `/maneuvers/${id}`, image_url: data.maneuver.image_url });
      })
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

  const handleMarkCanonical = async () => {
    setSettingCanonical(true);
    try {
      const { data } = await api.patch(`/api/maneuvers/${id}/canonical`, { is_canonical: true });
      setManeuver(data.maneuver);
    } finally {
      setSettingCanonical(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!maneuver) return null;

  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/maneuvers" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Маневри
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid #8a5a2b' }}>
        {maneuver.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={maneuver.image_url} alt={maneuver.name} className="h-full w-full object-cover" />
          </div>
        )}

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

        {maneuver.prerequisite_nodes?.length > 0 && (
          <Section title="Вимоги дерева розвитку">
            <div className="flex flex-col gap-1.5">
              {maneuver.prerequisite_nodes.map((n) => (
                <span key={n.id} className="flex items-center gap-1.5 text-sm text-text">
                  <ReqBadge type={maneuver.prerequisite_logic === 'and' ? 'required' : 'optional'} />
                  {n.title}
                </span>
              ))}
            </div>
          </Section>
        )}

        {canManageCanonical && !maneuver.is_canonical && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={handleMarkCanonical} disabled={settingCanonical}>
              {settingCanonical ? 'Позначення...' : 'Зробити канонічним'}
            </Button>
          </div>
        )}

        {(maneuver.is_owner || isAdmin) && (
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
