// Текстові поля карти: опис, ефект і трактування. Порожні не показуються.
// compact — дрібний шрифт для стола; clamp — обрізати кожне поле до кількох рядків.
const FIELDS = [
  { key: 'description', label: null },
  { key: 'effect', label: 'Ефект' },
  { key: 'interpretation', label: 'Трактування' },
];

export default function CardTexts({ card, compact = false, clamp = false, className = '' }) {
  const items = FIELDS.filter(({ key }) => card?.[key]?.trim());
  if (items.length === 0) return null;
  const size = compact ? 'text-xs leading-snug' : 'text-sm';
  return (
    <div className={`flex w-full flex-col gap-1.5 ${className}`}>
      {items.map(({ key, label }) => (
        <p key={key} className={`whitespace-pre-line text-text-muted ${size} ${clamp ? 'line-clamp-3' : ''}`}>
          {label && <span className="font-semibold text-text">{label}: </span>}
          {card[key]}
        </p>
      ))}
    </div>
  );
}
