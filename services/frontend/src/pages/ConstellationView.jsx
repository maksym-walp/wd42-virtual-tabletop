import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { constellationsApi } from '../api/tools';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import ShareButton from '../components/ShareButton';
import ConstellationCanvas from '../components/tools/ConstellationCanvas';
import { STAR_LEVELS } from '../utils/constellation';
import { exportOne } from '../utils/toolsImportTemplates';

export default function ConstellationView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    constellationsApi.getOne(id)
      .then(setItem)
      .catch(() => navigate('/tools/constellations', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const stars = item?.data?.stars ?? [];
  const lines = item?.data?.lines ?? [];
  const selected = useMemo(() => stars.find((s) => s.id === selectedId) ?? null, [stars, selectedId]);
  // Найяскравіші зірки першими — для переліку збоку.
  const byBrightness = useMemo(() => [...stars].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name, 'uk')), [stars]);

  const handleDelete = async () => {
    if (!confirm('Видалити це сузір\'я?')) return;
    setDeleting(true);
    try {
      await constellationsApi.remove(id);
      navigate('/tools/constellations');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!item) return null;

  const canEdit = item.is_owner || user?.role === 'admin';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/tools/constellations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Сузір'я
      </Link>

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-accent">{item.name}</h1>
          {item.description && <p className="mt-1 whitespace-pre-line text-text-muted">{item.description}</p>}
          <p className="mt-1 text-xs text-text-dim">
            {item.is_public ? 'публічне' : 'приватне'}
            {item.owner_username && ` · @${item.owner_username}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => exportOne(constellationsApi, id, `constellation_${id}.json`)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-dim hover:text-accent"
          >
            <Download size={14} /> Експорт
          </button>
          <ShareButton />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <ConstellationCanvas
          stars={stars}
          lines={lines}
          mode="view"
          selectedId={selectedId}
          onStarClick={(starId) => setSelectedId((cur) => (cur === starId ? null : starId))}
          onBackgroundClick={() => setSelectedId(null)}
          className="h-[60dvh] min-h-[22rem]"
        />

        <aside className="flex flex-col gap-3">
          <div className="rounded-lg border border-border bg-surface p-4">
            {selected ? (
              <>
                <h2 className="font-display text-lg text-accent">{selected.name || 'Без назви'}</h2>
                <p className="text-xs text-text-dim">Рівень {selected.size} · {STAR_LEVELS[selected.size].label}</p>
                {selected.description && <p className="mt-2 whitespace-pre-line text-sm text-text-muted">{selected.description}</p>}
              </>
            ) : (
              <p className="text-sm text-text-dim">Торкніться зірки, щоб побачити її опис.</p>
            )}
          </div>

          {byBrightness.length > 0 && (
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface">
              {byBrightness.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-border/50 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-surface-hover ${
                      s.id === selectedId ? 'text-accent' : 'text-text-muted'
                    }`}
                  >
                    <span className="truncate">{s.name || 'Без назви'}</span>
                    <span className="shrink-0 text-xs text-text-dim">{'★'.repeat(s.size)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {canEdit && (
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" to={`/tools/constellations/${id}/edit`}>Редагувати</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? '...' : 'Видалити'}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
