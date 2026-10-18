import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowUp, ArrowDown, Plus, Trash2, Wand2 } from 'lucide-react';
import { decksApi } from '../api/tools';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import ImageSlot from '../components/tools/ImageSlot';
import {
  MAX_SUITS, MAX_RANKS, MAX_CARDS, emptyDeck, fromServer, toPayload, parseNames,
  newSuit, newRank, newCard, generateMissingCards,
} from '../utils/deck';

function Section({ title, hint, action, children }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-accent">{title}</h2>
          {hint && <p className="text-xs text-text-dim">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Рядок «Додати списком»: кілька назв через кому або з нового рядка.
function QuickAdd({ placeholder, onAdd, disabled }) {
  const [text, setText] = useState('');
  const submit = () => {
    const names = parseNames(text);
    if (names.length === 0) return;
    onAdd(names);
    setText('');
  };
  return (
    <div className="mt-3 flex gap-2">
      <input
        className={inputClass}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        disabled={disabled}
      />
      <Button type="button" variant="ghost" onClick={submit} disabled={disabled || !text.trim()}>
        <Plus size={15} /> Додати
      </Button>
    </div>
  );
}

export default function DeckEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(id ? null : emptyDeck());
  const [suitFilter, setSuitFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!id) return;
    decksApi.getOne(id)
      .then((item) => setDoc(fromServer(item)))
      .catch(() => navigate('/tools/decks', { replace: true }));
  }, [id, navigate]);

  const suitsById = useMemo(() => new Map((doc?.suits ?? []).map((s) => [s.id, s])), [doc]);

  if (!doc) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const patch = (p) => setDoc((d) => ({ ...d, ...p }));
  const patchItem = (key, itemId, p) => setDoc((d) => ({
    ...d, [key]: d[key].map((it) => (it.id === itemId ? { ...it, ...p } : it)),
  }));

  const removeSuit = (suitId) => {
    const used = doc.cards.filter((c) => c.suit_id === suitId).length;
    if (used > 0 && !confirm(`Разом із мастю буде видалено ${used} карт цієї масті. Продовжити?`)) return;
    setDoc((d) => ({ ...d, suits: d.suits.filter((s) => s.id !== suitId), cards: d.cards.filter((c) => c.suit_id !== suitId) }));
  };

  const removeRank = (rankId) => {
    const used = doc.cards.filter((c) => c.rank_id === rankId).length;
    if (used > 0 && !confirm(`Разом із номіналом буде видалено ${used} карт цього номіналу. Продовжити?`)) return;
    setDoc((d) => ({ ...d, ranks: d.ranks.filter((r) => r.id !== rankId), cards: d.cards.filter((c) => c.rank_id !== rankId) }));
  };

  const moveRank = (index, delta) => setDoc((d) => {
    const ranks = [...d.ranks];
    const target = index + delta;
    if (target < 0 || target >= ranks.length) return d;
    [ranks[index], ranks[target]] = [ranks[target], ranks[index]];
    return { ...d, ranks };
  });

  const addSuits = (names) => setDoc((d) => ({ ...d, suits: [...d.suits, ...names.map(newSuit)].slice(0, MAX_SUITS) }));
  const addRanks = (names) => setDoc((d) => ({ ...d, ranks: [...d.ranks, ...names.map(newRank)].slice(0, MAX_RANKS) }));

  const handleGenerate = () => {
    const { cards, added, truncated } = generateMissingCards(doc);
    patch({ cards });
    setNotice(added === 0 ? 'Усі комбінації вже є' : `Додано карт: ${added}${truncated ? ` (ліміт ${MAX_CARDS})` : ''}`);
  };

  const handleSave = async () => {
    if (!doc.name.trim()) { setError('Вкажіть назву колоди'); return; }
    if (doc.cards.length === 0) { setError('Додайте хоча б одну карту'); return; }
    if (doc.cards.some((c) => !c.name.trim())) { setError('У кожної карти має бути назва'); return; }
    setSaving(true);
    setError('');
    try {
      const saved = id ? await decksApi.update(id, toPayload(doc)) : await decksApi.create(toPayload(doc));
      navigate(`/tools/decks/${saved.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти');
      setSaving(false);
    }
  };

  const visibleCards = suitFilter === '__none'
    ? doc.cards.filter((c) => !c.suit_id)
    : suitFilter ? doc.cards.filter((c) => c.suit_id === suitFilter) : doc.cards;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={id ? `/tools/decks/${id}` : '/tools/decks'} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {id ? 'Скасувати' : 'Колоди'}
      </Link>
      <h1 className="mb-4 font-display text-2xl text-accent sm:text-3xl">{id ? 'Редагування колоди' : 'Нова колода'}</h1>

      <div className="flex flex-col gap-4">
        <Section title="Колода">
          <div className="flex flex-wrap gap-4">
            <div className="flex min-w-[16rem] flex-1 flex-col gap-3">
              <Field label="Назва">
                <input className={inputClass} value={doc.name} maxLength={200} onChange={(e) => patch({ name: e.target.value })} />
              </Field>
              <Field label="Опис">
                <textarea className={inputClass} rows={3} maxLength={5000} value={doc.description} onChange={(e) => patch({ description: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" checked={doc.is_public} onChange={(e) => patch({ is_public: e.target.checked })} />
                Публічна (бачать усі)
              </label>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-dim">Сорочка</span>
              <ImageSlot label="Сорочка" value={doc.back_image_url} onChange={(url) => patch({ back_image_url: url })} className="w-24 aspect-[2/3]" />
            </div>
          </div>
        </Section>

        <Section title="Масті" hint={`До ${MAX_SUITS}. Необов'язкові: карти без масті (як старші аркани) теж можливі. Зображення масті показується на картах без власного.`}>
          <ul className="flex flex-col gap-2">
            {doc.suits.map((suit) => (
              <li key={suit.id} className="flex items-center gap-3">
                <ImageSlot label={`Масть ${suit.name}`} value={suit.image_url} onChange={(url) => patchItem('suits', suit.id, { image_url: url })} className="w-12 aspect-[2/3]" />
                <input className={inputClass} value={suit.name} maxLength={100} onChange={(e) => patchItem('suits', suit.id, { name: e.target.value })} aria-label="Назва масті" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSuit(suit.id)} aria-label="Видалити масть"><Trash2 size={15} /></Button>
              </li>
            ))}
          </ul>
          <QuickAdd placeholder="Кубки, Мечі, Жезли, Пентаклі" onAdd={addSuits} disabled={doc.suits.length >= MAX_SUITS} />
        </Section>

        <Section title="Номінали" hint={`До ${MAX_RANKS}. Порядок тут визначає порядок згенерованих карт.`}>
          <ul className="flex flex-col gap-2">
            {doc.ranks.map((rank, i) => (
              <li key={rank.id} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-text-dim">{i + 1}</span>
                <input className={inputClass} value={rank.name} maxLength={100} onChange={(e) => patchItem('ranks', rank.id, { name: e.target.value })} aria-label="Назва номіналу" />
                <Button type="button" variant="ghost" size="icon" onClick={() => moveRank(i, -1)} disabled={i === 0} aria-label="Вище"><ArrowUp size={15} /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => moveRank(i, 1)} disabled={i === doc.ranks.length - 1} aria-label="Нижче"><ArrowDown size={15} /></Button>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeRank(rank.id)} aria-label="Видалити номінал"><Trash2 size={15} /></Button>
              </li>
            ))}
          </ul>
          <QuickAdd placeholder="Туз, 2, 3, 4, 5, 6, 7, 8, 9, 10, Паж, Лицар, Королева, Король" onAdd={addRanks} disabled={doc.ranks.length >= MAX_RANKS} />
        </Section>

        <Section
          title={`Карти (${doc.cards.length})`}
          hint={`До ${MAX_CARDS}. Кожній карті можна дати власні назву й зображення.`}
          action={(
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={handleGenerate} disabled={doc.suits.length === 0 || doc.ranks.length === 0}>
                <Wand2 size={14} /> Згенерувати масть × номінал
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => patch({ cards: [...doc.cards, newCard()] })} disabled={doc.cards.length >= MAX_CARDS}>
                <Plus size={14} /> Окрема карта
              </Button>
            </div>
          )}
        >
          {notice && <p className="mb-3 text-sm text-sage">{notice}</p>}
          {doc.cards.length > 0 && (
            <select className={`${inputClass} mb-3 max-w-xs`} value={suitFilter} onChange={(e) => setSuitFilter(e.target.value)} aria-label="Фільтр за мастю">
              <option value="">Усі карти</option>
              {doc.suits.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              <option value="__none">Без масті</option>
            </select>
          )}
          {doc.cards.length === 0 ? (
            <p className="text-sm text-text-dim">Додайте масті й номінали та натисніть «Згенерувати», або додайте карти по одній.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visibleCards.map((card) => (
                <li key={card.id} className="flex gap-3 rounded-lg border border-border bg-bg p-2.5">
                  <ImageSlot
                    label={`Карта ${card.name}`}
                    value={card.image_url}
                    onChange={(url) => patchItem('cards', card.id, { image_url: url })}
                    className={`w-16 aspect-[2/3] ${!card.image_url && suitsById.get(card.suit_id)?.image_url ? 'opacity-70' : ''}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <input className={inputClass} value={card.name} maxLength={150} onChange={(e) => patchItem('cards', card.id, { name: e.target.value })} aria-label="Назва карти" />
                    <div className="flex gap-1.5">
                      <select className={inputClass} value={card.suit_id ?? ''} onChange={(e) => patchItem('cards', card.id, { suit_id: e.target.value || null })} aria-label="Масть">
                        <option value="">Без масті</option>
                        {doc.suits.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select className={inputClass} value={card.rank_id ?? ''} onChange={(e) => patchItem('cards', card.id, { rank_id: e.target.value || null })} aria-label="Номінал">
                        <option value="">Без номіналу</option>
                        {doc.ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setDoc((d) => ({ ...d, cards: d.cards.filter((c) => c.id !== card.id) }))} aria-label="Видалити карту"><Trash2 size={15} /></Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Збереження...' : 'Зберегти колоду'}</Button>
      </div>
    </div>
  );
}
