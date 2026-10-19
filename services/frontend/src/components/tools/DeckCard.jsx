import { faceImage, backImage, cardTitle } from '../../utils/deck';

// Карта 2:3 — лицем чи сорочкою догори. Ширину задає батько (className: w-24...).
// Лице — власне зображення карти; без нього малюється текстом (назва або
// номінал, і масть). Сорочка — зображення масті цієї карти, а без нього сорочка
// колоди (backUrl) чи візерунок.
export default function DeckCard({
  card, suitsById, ranksById = new Map(), faceUp = true, backUrl, className = '', onClick, title,
}) {
  const Tag = onClick ? 'button' : 'div';
  const label = card ? cardTitle(card, suitsById, ranksById) : '';
  const image = card && faceUp ? faceImage(card) : null;
  const back = card && !faceUp ? backImage(card, suitsById, backUrl) : null;
  const suit = card ? suitsById.get(card.suit_id) : null;
  // Головний текст лиця: власна назва, інакше номінал (масть іде підписом).
  const mainText = card?.name?.trim() || ranksById.get(card?.rank_id)?.name || label;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title ?? (card && faceUp ? label : undefined)}
      className={`relative block aspect-[2/3] overflow-hidden rounded-lg border-2 border-border text-left ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {!card ? (
        <span className="flex h-full w-full items-center justify-center bg-bg/60 text-xs text-text-dim">Порожньо</span>
      ) : !faceUp ? (
        back ? (
          <img src={back} alt="Сорочка" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span
            className="block h-full w-full"
            style={{
              background: 'repeating-linear-gradient(45deg, #3b2d08 0 6px, #5b440a 6px 12px)',
              boxShadow: 'inset 0 0 0 4px #f4efe4, inset 0 0 0 5px #5b440a',
            }}
          />
        )
      ) : image ? (
        <>
          <img src={image} alt={label} draggable={false} className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-center text-[0.7rem] font-semibold leading-tight text-white">
            {label}
          </span>
        </>
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface px-2 text-center">
          <span className="font-display text-sm leading-tight text-accent">{mainText}</span>
          {suit && <span className="text-[0.65rem] italic text-text-muted">{suit.name}</span>}
        </span>
      )}
    </Tag>
  );
}
