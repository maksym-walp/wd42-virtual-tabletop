import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, MousePointer2, Plus, Spline, Maximize, Trash2 } from 'lucide-react';
import { constellationsApi } from '../api/tools';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import ConstellationCanvas from '../components/tools/ConstellationCanvas';
import {
  STAR_LEVELS, MAX_STARS, emptyConstellation, newStar, fromServer, toPayload,
} from '../utils/constellation';

const MODES = [
  { key: 'select', label: 'Курсор', icon: MousePointer2, hint: 'Перетягуйте зірки, клік по зірці — вибрати. Порожнє місце — панорама.' },
  { key: 'star',   label: 'Зірка',  icon: Plus,          hint: 'Клік по порожньому місцю додає зірку.' },
  { key: 'line',   label: 'Лінія',  icon: Spline,        hint: 'Клік по двох зірках з\'єднує їх, і лінія тягнеться далі від другої. Клік по лінії видаляє її, по порожньому місцю — завершує.' },
];

export default function ConstellationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const [doc, setDoc] = useState(id ? null : emptyConstellation());
  const [mode, setMode] = useState('select');
  const [selectedId, setSelectedId] = useState(null);
  const [lineFromId, setLineFromId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    constellationsApi.getOne(id)
      // Право редагувати перевіряє сервер при збереженні (403 для чужого запису).
      .then((item) => setDoc(fromServer(item)))
      .catch(() => navigate('/tools/constellations', { replace: true }));
  }, [id, navigate]);

  const selected = useMemo(() => doc?.stars.find((s) => s.id === selectedId) ?? null, [doc, selectedId]);

  if (!doc) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const patchDoc = (patch) => setDoc((d) => ({ ...d, ...patch }));
  const patchStar = (starId, patch) => setDoc((d) => ({
    ...d, stars: d.stars.map((s) => (s.id === starId ? { ...s, ...patch } : s)),
  }));

  const switchMode = (next) => { setMode(next); setLineFromId(null); };

  const addStar = ({ x, y }) => {
    if (doc.stars.length >= MAX_STARS) { setError(`Максимум ${MAX_STARS} зірок`); return; }
    const star = newStar(x, y, doc.stars.length + 1);
    setDoc((d) => ({ ...d, stars: [...d.stars, star] }));
    setSelectedId(star.id);
    setError('');
  };

  const handleBackgroundClick = (point) => {
    if (mode === 'star') addStar(point);
    else if (mode === 'line') setLineFromId(null);
    else setSelectedId(null);
  };

  const handleStarClick = (starId) => {
    if (mode === 'line') {
      if (!lineFromId) { setLineFromId(starId); return; }
      if (lineFromId === starId) { setLineFromId(null); return; }
      const exists = doc.lines.some((l) => (l.a === lineFromId && l.b === starId) || (l.a === starId && l.b === lineFromId));
      if (!exists) setDoc((d) => ({ ...d, lines: [...d.lines, { a: lineFromId, b: starId }] }));
      setLineFromId(starId); // лінія тягнеться далі від щойно з'єднаної зірки
      return;
    }
    setSelectedId(starId);
  };

  const removeStar = (starId) => {
    setDoc((d) => ({
      ...d,
      stars: d.stars.filter((s) => s.id !== starId),
      lines: d.lines.filter((l) => l.a !== starId && l.b !== starId),
    }));
    setSelectedId(null);
    if (lineFromId === starId) setLineFromId(null);
  };

  const handleSave = async () => {
    if (!doc.name.trim()) { setError('Вкажіть назву сузір\'я'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = id
        ? await constellationsApi.update(id, toPayload(doc))
        : await constellationsApi.create(toPayload(doc));
      navigate(`/tools/constellations/${saved.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти');
      setSaving(false);
    }
  };

  const activeMode = MODES.find((m) => m.key === mode);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={id ? `/tools/constellations/${id}` : '/tools/constellations'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {id ? 'Скасувати' : 'Сузір\'я'}
      </Link>
      <h1 className="mb-4 font-display text-2xl text-accent sm:text-3xl">
        {id ? 'Редагування сузір\'я' : 'Нове сузір\'я'}
      </h1>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => switchMode(key)}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                  mode === key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => canvasRef.current?.fit()}
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-accent"
            >
              <Maximize size={15} /> Вмістити
            </button>
          </div>
          <p className="text-xs text-text-dim">{activeMode.hint}</p>

          <ConstellationCanvas
            ref={canvasRef}
            stars={doc.stars}
            lines={doc.lines}
            mode={mode}
            selectedId={selectedId}
            lineFromId={lineFromId}
            onBackgroundClick={handleBackgroundClick}
            onStarClick={handleStarClick}
            onStarMove={(starId, x, y) => patchStar(starId, { x, y })}
            onLineClick={(index) => setDoc((d) => ({ ...d, lines: d.lines.filter((_, i) => i !== index) }))}
            className="h-[60dvh] min-h-[22rem]"
          />
          <p className="text-xs text-text-dim">Зірок: {doc.stars.length} · ліній: {doc.lines.length}</p>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
            <Field label="Назва сузір'я">
              <input className={inputClass} value={doc.name} maxLength={200} onChange={(e) => patchDoc({ name: e.target.value })} />
            </Field>
            <Field label="Опис">
              <textarea className={inputClass} rows={3} maxLength={5000} value={doc.description} onChange={(e) => patchDoc({ description: e.target.value })} />
            </Field>
            <Field
              label="🔒 Нотатки майстра"
              hint="Приватні: бачить лише автор (та адмін), навіть якщо сузір'я публічне."
            >
              <textarea className={inputClass} rows={4} maxLength={10000} value={doc.gm_notes} onChange={(e) => patchDoc({ gm_notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-text">
              <input type="checkbox" checked={doc.is_public} onChange={(e) => patchDoc({ is_public: e.target.checked })} />
              Публічне (бачать усі)
            </label>
          </div>

          {selected && (
            <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-4">
              <h2 className="font-display text-lg text-accent">Зірка</h2>
              <Field label="Назва">
                <input className={inputClass} value={selected.name} maxLength={100} onChange={(e) => patchStar(selected.id, { name: e.target.value })} />
              </Field>
              <Field label="Опис">
                <textarea className={inputClass} rows={3} maxLength={2000} value={selected.description} onChange={(e) => patchStar(selected.id, { description: e.target.value })} />
              </Field>
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-dim">Рівень</span>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => patchStar(selected.id, { size: level })}
                      className={`flex-1 rounded border px-2 py-1.5 text-sm font-semibold transition-colors ${
                        selected.size === level ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
                      }`}
                    >
                      {level} · {STAR_LEVELS[level].label}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => removeStar(selected.id)}>
                <Trash2 size={14} /> Видалити зірку
              </Button>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Збереження...' : 'Зберегти'}</Button>
        </aside>
      </div>
    </div>
  );
}
