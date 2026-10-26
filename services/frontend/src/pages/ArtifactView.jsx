import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon } from 'lucide-react';
import api from '../api/client';
import { ARTIFACT_TYPE, RARITIES } from '../constants/artifacts';
import { recordView, removeView } from '../utils/recentlyViewed';
import { downloadArtifactCardJpeg } from '../utils/artifactCardImage';
import Button from '../components/ui/Button';
import AuthorBadge from '../components/AuthorBadge';
import CanonicalSwitch from '../components/CanonicalSwitch';
import SmartTextReader from '../components/SmartTextReader';
import { useAuth } from '../context/AuthContext';
import ShareButton from '../components/ShareButton';
import ExportRecordButton from '../components/ExportRecordButton';
import CroppedImage from '../components/ui/CroppedImage';

export default function ArtifactView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [artifact, setArtifact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);
  const [exportingJpeg, setExportingJpeg] = useState(false);

  useEffect(() => {
    api.get(`/api/equipment/artifacts/${id}`)
      .then(({ data }) => {
        setArtifact(data.item);
        recordView({ type: 'artifact', id, name: data.item.name, href: `/equipment/artifacts/${id}`, image_url: data.item.image_url, image_crop: data.item.image_crop });
      })
      .catch(() => navigate('/equipment/artifacts', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цей артефакт?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/equipment/artifacts/${id}`);
      removeView('artifact', id);
      navigate('/equipment/artifacts');
    } catch {
      setDeleting(false);
    }
  };

  // Картка 80×120 мм як зображення (300 dpi). Для друку кількох карток на
  // аркуші PDF — «Вибрати для друку» у каталозі.
  const handleExportJpeg = async () => {
    setExportingJpeg(true);
    try {
      const { imageSkipped } = await downloadArtifactCardJpeg(artifact);
      if (imageSkipped) alert('Зображення артефакта не вдалося вбудувати (воно з іншого сервера), тож картку збережено без нього.');
    } catch {
      alert('Не вдалося створити зображення картки');
    } finally {
      setExportingJpeg(false);
    }
  };

  const handleSetCanonical = async (isCanonical) => {
    setSettingCanonical(true);
    try {
      const { data } = await api.patch(`/api/equipment/artifacts/${id}/canonical`, { is_canonical: isCanonical });
      setArtifact((prev) => ({ ...prev, is_canonical: data.item.is_canonical }));
    } finally {
      setSettingCanonical(false);
    }
  };

  const handleSetOwner = async (ownerUsername) => {
    const { data } = await api.patch(`/api/equipment/artifacts/${id}/owner`, { owner_username: ownerUsername });
    // PATCH /owner повертає голий рядок (без owner_username/is_owner/joins) —
    // оновлюємо лише власника.
    setArtifact((prev) => ({ ...prev, user_id: data.item.user_id, owner_username: ownerUsername, is_owner: data.item.user_id === user?.id }));
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!artifact) return null;

  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';
  const rarity = RARITIES[artifact.rarity];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/equipment/artifacts" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Артефакти
      </Link>

      {/* Макет як у заклинань: ліворуч — зображення, назва, творець, автор;
          праворуч — вартість, опис, дії. На мобільному — одна колонка. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-4 lg:self-start">
          {artifact.image_url && (
            <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
              <CroppedImage src={artifact.image_url} crop={artifact.image_crop} alt={artifact.name} />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-hover px-4 py-2.5">
            <span className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-text-dim">
              {ARTIFACT_TYPE.label}
            </span>
            {rarity && (
              <span className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-text-dim">
                {rarity.label}
              </span>
            )}
            <span className={`text-xs italic ${artifact.is_canonical ? 'text-gold' : 'text-text-dim'}`}>
              {artifact.is_canonical ? 'канонічне' : 'спільнота'}
            </span>
            {artifact.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
            <h1 className="font-display text-3xl text-accent">{artifact.name}</h1>
            <div className="mt-1 flex shrink-0 items-center">
              <button
                type="button" onClick={handleExportJpeg} disabled={exportingJpeg}
                className="inline-flex shrink-0 items-center rounded-md p-1.5 text-text-dim transition-colors hover:bg-surface-hover hover:text-accent disabled:opacity-60"
                title={exportingJpeg ? 'Створення...' : 'Картка 80×120 мм у форматі JPEG'}
                aria-label="Картка JPEG"
              >
                <ImageIcon size={16} />
              </button>
              <ExportRecordButton url={`/api/equipment/export?id=${id}`} filename={`artifact_${id}.json`} />
              <ShareButton />
            </div>
          </div>
          {artifact.creator && <p className="px-5 pb-2 text-sm italic text-text-dim">Творець: {artifact.creator}</p>}
          <AuthorBadge
            username={artifact.owner_username}
            size="sm"
            className="px-5 pb-4"
            onChangeOwner={isAdmin ? handleSetOwner : undefined}
          />
        </div>

        <div className="self-start overflow-hidden rounded-lg border border-border bg-surface">
          <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3">
            {rarity && <SheetStat label="Рідкісність" value={rarity.label} />}
            <SheetStat label="Орієнтовна вартість" value={artifact.price} />
          </div>

          {artifact.description && (
            <Section title="Опис">
              <SmartTextReader text={artifact.description} className="text-[0.95rem] leading-relaxed text-text" />
            </Section>
          )}

          {(artifact.is_owner || isAdmin || canManageCanonical) && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
              {(artifact.is_owner || isAdmin) && (
                <>
                  <Button variant="ghost" to={`/equipment/artifacts/${id}/edit`}>Редагувати</Button>
                  <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Видалення...' : 'Видалити'}
                  </Button>
                </>
              )}
              {canManageCanonical && (
                <CanonicalSwitch
                  className="ml-auto"
                  checked={!!artifact.is_canonical}
                  disabled={settingCanonical}
                  onChange={handleSetCanonical}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SheetStat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">
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
