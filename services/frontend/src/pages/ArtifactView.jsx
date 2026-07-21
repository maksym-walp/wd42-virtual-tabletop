import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { ARTIFACT_TYPE, RARITIES } from '../constants/artifacts';
import { recordView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export default function ArtifactView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [artifact, setArtifact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);

  useEffect(() => {
    api.get(`/api/artifacts/${id}`)
      .then(({ data }) => {
        setArtifact(data.artifact);
        recordView({ type: 'artifact', id, name: data.artifact.name, href: `/artifacts/${id}`, image_url: data.artifact.image_url });
      })
      .catch(() => navigate('/artifacts', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цей артефакт?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/artifacts/${id}`);
      navigate('/artifacts');
    } catch {
      setDeleting(false);
    }
  };

  const handleMarkCanonical = async () => {
    setSettingCanonical(true);
    try {
      const { data } = await api.patch(`/api/artifacts/${id}/canonical`, { is_canonical: true });
      setArtifact(data.artifact);
    } finally {
      setSettingCanonical(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!artifact) return null;

  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';
  const rarity = RARITIES[artifact.rarity];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/artifacts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Артефакти
      </Link>

      <div
        className="overflow-hidden rounded-lg border border-border bg-surface"
        style={{ borderTop: `3px solid ${ARTIFACT_TYPE.color}` }}
      >
        {artifact.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={artifact.image_url} alt={artifact.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5" style={{ background: ARTIFACT_TYPE.bg }}>
          <span
            className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: ARTIFACT_TYPE.color, borderColor: ARTIFACT_TYPE.color }}
          >
            {ARTIFACT_TYPE.label}
          </span>
          {rarity && (
            <span className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: rarity.color, borderColor: rarity.color }}>
              {rarity.label}
            </span>
          )}
          {artifact.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-1 pt-4 font-display text-3xl text-accent">{artifact.name}</h1>
        {artifact.creator && <p className="px-5 pb-2 text-sm italic text-text-dim">Творець: {artifact.creator}</p>}

        {artifact.price != null && (
          <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3">
            <SheetStat label="Середня ціна" value={artifact.price} accent={ARTIFACT_TYPE.color} />
          </div>
        )}

        {artifact.description && (
          <Section title="Опис">
            <p className="text-[0.95rem] leading-relaxed text-text">{artifact.description}</p>
          </Section>
        )}

        {canManageCanonical && !artifact.is_canonical && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={handleMarkCanonical} disabled={settingCanonical}>
              {settingCanonical ? 'Позначення...' : 'Зробити канонічним'}
            </Button>
          </div>
        )}

        {(artifact.is_owner || isAdmin) && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/artifacts/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SheetStat({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: accent + 'aa' }}>
        {label}
      </span>
      <span className="text-sm font-semibold text-text">{value ?? '—'}</span>
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
