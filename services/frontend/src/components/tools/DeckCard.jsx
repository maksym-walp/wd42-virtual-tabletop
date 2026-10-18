import { faceImage } from '../../utils/deck';

// Карта 2:3 — лицем чи сорочкою догори. Ширину задає батько (className: w-24...).
// Без зображення лице малюється текстом: назва карти й масть на пергаменті.
export default function DeckCard({ card, suitsById, faceUp = true, backUrl, className = '', onClick, title }) {
  const Tag = onClick ? 'button' : 'div';
  const image = card && faceUp ? faceImage(card, suitsById) : null;
  const suit = card ? suitsById.get(card.suit_id) : null;

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      title={title ?? (card && faceUp ? card.name : undefined)}
      className={`relative block aspect-[2/3] overflow-hidden rounded-lg border-2 border-border text-left ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {!card ? (
        <span className="flex h-full w-full items-center justify-center bg-bg/60 text-xs text-text-dim">Порожньо</span>
      ) : !faceUp ? (
        backUrl ? (
          <img src={backUrl} alt="Сорочка" draggable={false} className="h-full w-full object-cover" />
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
          <img src={image} alt={card.name} draggable={false} className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-center text-[0.7rem] font-semibold leading-tight text-white">
            {card.name}
          </span>
        </>
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface px-2 text-center">
          <span className="font-display text-sm leading-tight text-accent">{card.name}</span>
          {suit && <span className="text-[0.65rem] italic text-text-muted">{suit.name}</span>}
        </span>
      )}
    </Tag>
  );
}
