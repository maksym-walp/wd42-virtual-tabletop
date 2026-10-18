import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, Play } from 'lucide-react';
import { decksApi } from '../api/tools';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Lightbox from '../components/ui/Lightbox';
import ShareButton from '../components/ShareButton';
import DeckCard from '../components/tools/DeckCard';
import { faceImage } from '../utils/deck';
import { exportOne } from '../utils/toolsImportTemplates';

export default function DeckView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    decksApi.getOne(id)
      .then(setItem)
      .catch(() => navigate('/tools/decks', { replace: true }))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const { suits, ranks, cards } = item?.data ?? { suits: [], ranks: [], cards: [] };
  const suitsById = useMemo(() => new Map(suits.map((s) => [s.id, s])), [suits]);

  const handleDelete = async () => {
    if (!confirm('Видалити цю колоду?')) return;
    setDeleting(true);
    try {
      await decksApi.remove(id);
      navigate('/tools/decks');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!item) return null;
  const canEdit = item.is_owner || user?.role === 'admin';

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/tools/decks" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Колоди
      </Link>

      <div className="mb-5 flex flex-wrap items-start gap-4">
        <DeckCard card={{ id: 'back' }} suitsById={suitsById} faceUp={false} backUrl={item.back_image_url} className="w-24 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-3xl text-accent">{item.name}</h1>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => exportOne(decksApi, id, `deck_${id}.json`)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-dim hover:text-accent"
              >
                <Download size={14} /> Експорт
              </button>
              <ShareButton />
            </div>
          </div>
          {item.description && <p className="mt-1 whitespace-pre-line text-text-muted">{item.description}</p>}
          <p className="mt-1 text-xs text-text-dim">
            Карт: {cards.length} · мастей: {suits.length} · номіналів: {ranks.length}
            {` · ${item.is_public ? 'публічна' : 'приватна'}`}
            {item.owner_username && ` · @${item.owner_username}`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button to={`/tools/decks/${id}/play`}><Play size={15} /> Грати</Button>
            {canEdit && <Button variant="ghost" to={`/tools/decks/${id}/edit`}>Редагувати</Button>}
            {canEdit && <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? '...' : 'Видалити'}</Button>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-7">
        {cards.map((card) => {
          const image = faceImage(card, suitsById);
          return (
            <DeckCard
              key={card.id}
              card={card}
              suitsById={suitsById}
              onClick={image ? () => setPreview(image) : undefined}
            />
          );
        })}
      </div>

      {preview && <Lightbox images={[preview]} index={0} onClose={() => setPreview(null)} />}
    </div>
  );
}
