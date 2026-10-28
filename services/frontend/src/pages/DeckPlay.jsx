import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Shuffle, RotateCw, ArrowDownToLine, Settings2, Plus, Search, RotateCcw, Layers, LayoutGrid } from 'lucide-react';
import { decksApi } from '../api/tools';
import Button from '../components/ui/Button';
import Sheet from '../components/ui/Sheet';
import Lightbox from '../components/ui/Lightbox';
import { inputClass } from '../components/ui/Field';
import DeckCard from '../components/tools/DeckCard';
import CardTexts from '../components/tools/CardTexts';
import { faceImage, cardTitle } from '../utils/deck';
import * as engine from '../utils/deckEngine';

const MAX_LOG = 30;
const storageKey = (id) => `deck-play:${id}`;

// Стіл зберігається в localStorage цього браузера (колоди особисті, без
// синхронізації). Збережений стан підходить, лише якщо він описує рівно ті
// самі карти, що й колода зараз — інакше (колоду відредагували) беремо новий.
function loadGame(id, deck) {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(id)));
    if (parsed && engine.isTableValidFor(parsed.table, deck)) {
      return { table: parsed.table, log: Array.isArray(parsed.log) ? parsed.log.slice(0, MAX_LOG) : [] };
    }
  } catch { /* порожньо або зіпсовано — починаємо заново */ }
  return { table: engine.createTable(deck), log: [] };
}

export default function DeckPlay() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deck, setDeck] = useState(null);
  const [game, setGame] = useState(null);
  const [manageId, setManageId] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => {
    decksApi.getOne(id)
      .then((item) => { setDeck(item); setGame(loadGame(id, item)); })
      .catch(() => navigate('/tools/decks', { replace: true }));
  }, [id, navigate]);

  useEffect(() => {
    if (!game) return;
    try { localStorage.setItem(storageKey(id), JSON.stringify(game)); } catch { /* сховище недоступне — стіл живе до перезавантаження */ }
  }, [id, game]);

  const suitsById = useMemo(() => new Map((deck?.data.suits ?? []).map((s) => [s.id, s])), [deck]);
  const ranksById = useMemo(() => new Map((deck?.data.ranks ?? []).map((r) => [r.id, r])), [deck]);
  const cardsById = useMemo(() => new Map((deck?.data.cards ?? []).map((c) => [c.id, c])), [deck]);

  if (!deck || !game) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const { table, log } = game;
  const titleOf = (cardId) => (cardsById.has(cardId) ? cardTitle(cardsById.get(cardId), suitsById, ranksById) : 'карта');
  const pileOf = (pileId) => table.piles.find((p) => p.id === pileId);
  const nameOf = (cardId) => titleOf(cardId);

  // Новий стан столу + рядок у журналі.
  const apply = (nextTable, message) => setGame((g) => ({
    table: nextTable,
    log: message ? [message, ...g.log].slice(0, MAX_LOG) : g.log,
  }));

  const actions = {
    shuffle: (pileId) => apply(engine.shufflePile(table, pileId), `Перемішано «${pileOf(pileId).name}»`),

    flip: (pileId) => {
      const pile = pileOf(pileId);
      if (pile.cards.length === 0) return;
      const wasUp = pile.cards[0].faceUp;
      apply(
        engine.flipTop(table, pileId),
        wasUp ? `Верхню карту «${pile.name}» сховано` : `Перевернуто верхню карту «${pile.name}»: ${nameOf(pile.cards[0].cardId)}`,
      );
    },

    // Назву карти в журналі показуємо лише якщо вона вже була відкрита —
    // інакше журнал видав би карту, яку гравець ще не бачив.
    move: (fromId, index, toId, position) => {
      const from = pileOf(fromId);
      const card = from.cards[index];
      if (!card) return;
      const what = card.faceUp ? `«${nameOf(card.cardId)}»` : 'приховану карту';
      const where = fromId === toId ? `у «${from.name}»` : `до «${pileOf(toId).name}»`;
      apply(
        engine.moveCard(table, fromId, index, toId, position),
        `Переміщено ${what} ${where}: ${engine.POSITIONS[position].toLowerCase()}`,
      );
    },

    // Викласти верхні `count` карт: вони з'являються на столі лицем догори.
    layOut: (pileId, count) => {
      const pile = pileOf(pileId);
      const n = Math.min(Math.floor(count), pile.cards.length);
      if (!(n >= 1)) return;
      const names = pile.cards.slice(0, n).map((c) => nameOf(c.cardId)).join(', ');
      apply(engine.layOut(table, pileId, n), `Викладено ${n} з «${pile.name}»: ${names}`);
    },

    flipCard: (pileId, index) => {
      const card = pileOf(pileId).cards[index];
      if (!card) return;
      apply(engine.flipCard(table, pileId, index), card.faceUp ? 'Карту розкладу сховано' : `Перевернуто карту розкладу: ${nameOf(card.cardId)}`);
    },

    gather: (fromId, toId, position) => {
      const from = pileOf(fromId);
      apply(
        engine.gatherPile(table, fromId, toId, position),
        `«${from.name}» (${from.cards.length}) зібрано до «${pileOf(toId).name}»: ${engine.POSITIONS[position].toLowerCase()}`,
      );
    },

    sortBySuit: (pileId) => {
      const next = engine.sortPileBySuit(table, pileId, deck.data);
      if (next === table) return;
      apply(next, `«${pileOf(pileId).name}» розсортовано за мастями: стосів ${next.piles.length - table.piles.length + 1}`);
    },

    split: (pileId, parts, method) => apply(
      engine.splitPile(table, pileId, parts, method),
      `«${pileOf(pileId).name}» розділено на ${parts} (${method === 'deal' ? 'по колу' : 'частинами'})`,
    ),

    cut: (pileId, count) => apply(engine.cutPile(table, pileId, count), `Знято ${count} карт зверху «${pileOf(pileId).name}»`),

    merge: (fromId, toId) => apply(
      engine.mergePile(table, fromId, toId),
      `«${pileOf(fromId).name}» складено на «${pileOf(toId).name}»`,
    ),

    rename: (pileId, name) => apply(engine.renamePile(table, pileId, name), null),
    add: () => apply(engine.addPile(table), 'Додано стопку'),
    remove: (pileId) => { apply(engine.removePile(table, pileId), `Стопку «${pileOf(pileId).name}» прибрано`); setManageId(null); },
  };

  const handleReset = () => {
    if (!confirm('Скинути стіл? Усі карти повернуться в одну стопку в початковому порядку.')) return;
    setGame({ table: engine.createTable(deck), log: [] });
  };

  const managed = manageId ? pileOf(manageId) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={`/tools/decks/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {deck.name}
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl text-accent sm:text-3xl">🃏 {deck.name}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={actions.add}><Plus size={14} /> Стопка</Button>
          <Button variant="ghost" size="sm" onClick={handleReset}><RotateCcw size={14} /> Скинути стіл</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {table.piles.map((pile) => {
          const shared = {
            pile,
            piles: table.piles,
            cardsById,
            suitsById,
            ranksById,
            titleOf,
            backUrl: deck.back_image_url,
            actions,
            onManage: () => setManageId(pile.id),
            onZoom: setZoom,
          };
          return pile.spread
            ? <SpreadPile key={pile.id} {...shared} />
            : <Pile key={pile.id} {...shared} hasSuits={deck.data.suits.length > 0} />;
        })}
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Журнал</h2>
        {log.length === 0 ? (
          <p className="text-sm text-text-dim">Тут з'являтимуться ходи.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm text-text-muted">
            {log.map((line, i) => <li key={`${i}-${line}`} className={i === 0 ? 'text-text' : ''}>{line}</li>)}
          </ol>
        )}
      </section>

      <Sheet open={Boolean(managed)} onClose={() => setManageId(null)} title={managed ? `Стопка «${managed.name}»` : ''} size="lg">
        {managed && (
          <ManagePile
            key={managed.id}
            pile={managed}
            piles={table.piles}
            cardsById={cardsById}
            titleOf={titleOf}
            actions={actions}
          />
        )}
      </Sheet>

      {zoom && <Lightbox images={[zoom]} index={0} onClose={() => setZoom(null)} />}
    </div>
  );
}

// ── Стопка ──────────────────────────────────────────────────────────────────

function Pile({ pile, piles, cardsById, suitsById, ranksById, titleOf, hasSuits, backUrl, actions, onManage, onZoom }) {
  const others = piles.filter((p) => p.id !== pile.id);
  const [target, setTarget] = useState(others[0]?.id ?? pile.id);
  const [position, setPosition] = useState('top');
  const [layCount, setLayCount] = useState(3);

  // Якщо обрану стопку прибрали — повертаємось до першої доступної.
  const targetId = piles.some((p) => p.id === target) ? target : (others[0]?.id ?? pile.id);
  const top = pile.cards[0];
  const topCard = top ? cardsById.get(top.cardId) : null;
  const zoomImage = topCard && top.faceUp ? faceImage(topCard) : null;
  const empty = pile.cards.length === 0;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate font-display text-lg text-accent">{pile.name}</h2>
        <span className="shrink-0 text-xs text-text-dim">карт: {pile.cards.length}</span>
      </div>

      <div className="flex justify-center py-1">
        <div style={pile.cards.length > 1 ? { boxShadow: '3px 3px 0 var(--color-border), 6px 6px 0 var(--color-border)', borderRadius: '0.5rem' } : undefined}>
          <DeckCard
            card={topCard}
            suitsById={suitsById}
            ranksById={ranksById}
            faceUp={Boolean(top?.faceUp)}
            backUrl={backUrl}
            className="w-32"
            onClick={empty ? undefined : () => actions.flip(pile.id)}
            title={empty ? undefined : 'Клік — перевернути верхню карту'}
          />
        </div>
      </div>

      {top?.faceUp && topCard && (
        <div className="text-center">
          <p className="text-sm font-semibold text-text">
            {titleOf(top.cardId)}
            {zoomImage && (
              <button type="button" onClick={() => onZoom(zoomImage)} className="ml-2 inline-flex align-middle text-text-dim hover:text-accent" aria-label="Збільшити">
                <Search size={14} />
              </button>
            )}
          </p>
          <CardTexts card={topCard} compact className="mt-1" />
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => actions.shuffle(pile.id)} disabled={pile.cards.length < 2}><Shuffle size={14} /> Перемішати</Button>
        <Button size="sm" variant="ghost" onClick={() => actions.flip(pile.id)} disabled={empty}><RotateCw size={14} /> Перевернути</Button>
        <Button size="sm" variant="ghost" onClick={() => actions.move(pile.id, 0, pile.id, 'middle')} disabled={pile.cards.length < 2}>
          <ArrowDownToLine size={14} /> У середину
        </Button>
        <Button size="sm" variant="ghost" onClick={() => actions.sortBySuit(pile.id)} disabled={!hasSuits || pile.cards.length < 2} title="Розсортувати на стоси за мастями">
          <Layers size={14} /> За мастями
        </Button>
        <Button size="sm" variant="ghost" onClick={onManage}><Settings2 size={14} /> Ще</Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
        <span className="text-xs text-text-dim">Викласти</span>
        <input
          type="number" min={1} max={Math.max(1, pile.cards.length)}
          className={`${inputClass} !min-h-9 !w-16 !py-1 text-sm`}
          value={layCount}
          onChange={(e) => setLayCount(Number(e.target.value))}
          aria-label="Скільки карт викласти"
        />
        <span className="text-xs text-text-dim">верхніх карт</span>
        <Button size="sm" onClick={() => actions.layOut(pile.id, layCount)} disabled={empty || !(layCount >= 1)}>
          <LayoutGrid size={14} /> Викласти
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 pt-2">
        <span className="text-xs text-text-dim">Верхню →</span>
        <select className={`${inputClass} !min-h-9 !w-auto flex-1 !py-1 text-sm`} value={targetId} onChange={(e) => setTarget(e.target.value)} aria-label="Цільова стопка">
          {piles.map((p) => <option key={p.id} value={p.id}>{p.id === pile.id ? `${p.name} (ця)` : p.name}</option>)}
        </select>
        <select className={`${inputClass} !min-h-9 !w-auto !py-1 text-sm`} value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Місце">
          {Object.entries(engine.POSITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <Button size="sm" onClick={() => actions.move(pile.id, 0, targetId, position)} disabled={empty}>OK</Button>
      </div>
    </div>
  );
}

// ── Розклад: викладені карти лежать у ряд, лицем догори ────────────────────

function SpreadPile({ pile, piles, cardsById, suitsById, ranksById, titleOf, backUrl, actions, onManage, onZoom }) {
  // Збирати можна у будь-яку звичайну стопку; за замовчуванням — туди, звідки викладали.
  const targets = piles.filter((p) => p.id !== pile.id && !p.spread);
  const defaultTarget = targets.find((p) => p.id === pile.origin)?.id ?? targets[0]?.id ?? '';
  const [target, setTarget] = useState(defaultTarget);
  const [position, setPosition] = useState('bottom');
  const targetId = targets.some((p) => p.id === target) ? target : defaultTarget;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-accent/40 bg-surface p-3 sm:col-span-2 lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-accent">
          {pile.name} <span className="text-xs font-normal text-text-dim">· карт: {pile.cards.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-dim">Зібрати →</span>
          <select className={`${inputClass} !min-h-9 !w-auto !py-1 text-sm`} value={targetId} onChange={(e) => setTarget(e.target.value)} aria-label="Куди зібрати">
            {targets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className={`${inputClass} !min-h-9 !w-auto !py-1 text-sm`} value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Місце">
            {Object.entries(engine.POSITIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <Button size="sm" onClick={() => actions.gather(pile.id, targetId, position)} disabled={!targetId}>Зібрати</Button>
          <Button size="sm" variant="ghost" onClick={onManage}><Settings2 size={14} /> Ще</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {pile.cards.map((c, i) => {
          const card = cardsById.get(c.cardId);
          const image = c.faceUp ? faceImage(card) : null;
          return (
            <div key={c.cardId} className="flex w-28 flex-col gap-1">
              <DeckCard
                card={card}
                suitsById={suitsById}
                ranksById={ranksById}
                faceUp={c.faceUp}
                backUrl={backUrl}
                className="w-full"
                onClick={() => actions.flipCard(pile.id, i)}
                title="Клік — перевернути"
              />
              <p className="text-xs font-semibold leading-tight text-text">
                {c.faceUp ? titleOf(c.cardId) : 'закрита карта'}
                {image && (
                  <button type="button" onClick={() => onZoom(image)} className="ml-1.5 inline-flex align-middle text-text-dim hover:text-accent" aria-label="Збільшити">
                    <Search size={12} />
                  </button>
                )}
              </p>
              {c.faceUp && card && <CardTexts card={card} compact clamp />}
              {targets.length > 0 && (
                <select
                  className="rounded border border-border bg-bg px-1 py-1 text-[0.7rem] text-text"
                  value=""
                  aria-label="Перемістити карту"
                  onChange={(e) => {
                    const [toId, pos] = e.target.value.split('|');
                    if (toId) actions.move(pile.id, i, toId, pos);
                  }}
                >
                  <option value="">Перемістити…</option>
                  {targets.map((p) => <option key={`${p.id}|top`} value={`${p.id}|top`}>→ {p.name} (зверху)</option>)}
                  {targets.map((p) => <option key={`${p.id}|middle`} value={`${p.id}|middle`}>→ {p.name} (в середину)</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Керування стопкою: розділити, зняти, об'єднати, переглянути ─────────────

function ManagePile({ pile, piles, titleOf, actions }) {
  const others = piles.filter((p) => p.id !== pile.id);
  const [name, setName] = useState(pile.name);
  const [parts, setParts] = useState(2);
  const [method, setMethod] = useState('chunks');
  const [cutCount, setCutCount] = useState(Math.max(1, Math.floor(pile.cards.length / 2)));
  const [mergeInto, setMergeInto] = useState(others[0]?.id ?? '');
  const [reveal, setReveal] = useState(false);

  const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-dim';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className={labelClass}>Назва</span>
        <input
          className={inputClass}
          value={name}
          maxLength={60}
          onChange={(e) => { setName(e.target.value); actions.rename(pile.id, e.target.value); }}
        />
      </div>

      <div>
        <span className={labelClass}>Розділити на стопки</span>
        <div className="flex flex-wrap gap-2">
          <input type="number" min={2} max={12} className={`${inputClass} !w-20`} value={parts} onChange={(e) => setParts(Number(e.target.value))} aria-label="Кількість стопок" />
          <select className={`${inputClass} !w-auto flex-1`} value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Спосіб">
            <option value="chunks">Частинами по порядку (розрізати)</option>
            <option value="deal">По одній карті по колу (роздати)</option>
          </select>
          <Button onClick={() => actions.split(pile.id, parts, method)} disabled={pile.cards.length < 2 || !(parts >= 2 && parts <= 12)}>Розділити</Button>
        </div>
      </div>

      <div>
        <span className={labelClass}>Зняти зверху</span>
        <div className="flex gap-2">
          <input type="number" min={1} max={Math.max(1, pile.cards.length - 1)} className={`${inputClass} !w-24`} value={cutCount} onChange={(e) => setCutCount(Number(e.target.value))} aria-label="Скільки карт" />
          <Button onClick={() => actions.cut(pile.id, cutCount)} disabled={!(cutCount >= 1 && cutCount < pile.cards.length)}>Зняти в нову стопку</Button>
        </div>
      </div>

      {others.length > 0 && (
        <div>
          <span className={labelClass}>Скласти на іншу стопку</span>
          <div className="flex gap-2">
            <select className={inputClass} value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} aria-label="Стопка-ціль">
              {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Button onClick={() => actions.merge(pile.id, mergeInto)}>Скласти</Button>
          </div>
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Карти зверху вниз ({pile.cards.length})</span>
          <label className="flex items-center gap-1.5 text-xs text-text-dim">
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
            показати закриті
          </label>
        </div>
        {pile.cards.length === 0 ? (
          <p className="text-sm text-text-dim">Стопка порожня.</p>
        ) : (
          <ul className="max-h-72 overflow-y-auto rounded-lg border border-border">
            {pile.cards.map((c, i) => (
              <li key={c.cardId} className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 text-sm last:border-b-0">
                <span className="w-7 shrink-0 text-right text-xs text-text-dim">{i + 1}</span>
                <span className={`min-w-0 flex-1 truncate ${c.faceUp || reveal ? 'text-text' : 'italic text-text-dim'}`}>
                  {c.faceUp || reveal ? titleOf(c.cardId) : 'закрита карта'}
                </span>
                <select
                  className="rounded border border-border bg-bg px-1.5 py-1 text-xs text-text"
                  value=""
                  aria-label="Перемістити карту"
                  onChange={(e) => {
                    const [toId, position] = e.target.value.split('|');
                    if (toId) actions.move(pile.id, i, toId, position);
                  }}
                >
                  <option value="">Перемістити…</option>
                  <option value={`${pile.id}|top`}>Нагору цієї стопки</option>
                  <option value={`${pile.id}|middle`}>У середину цієї стопки</option>
                  <option value={`${pile.id}|bottom`}>Вниз цієї стопки</option>
                  {others.map((p) => <option key={p.id} value={`${p.id}|top`}>→ {p.name} (зверху)</option>)}
                </select>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pile.cards.length === 0 && piles.length > 1 && (
        <Button variant="danger" onClick={() => actions.remove(pile.id)}>Прибрати порожню стопку</Button>
      )}
    </div>
  );
}
