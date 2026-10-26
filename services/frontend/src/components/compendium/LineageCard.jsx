import { useState } from 'react';
import { Link } from 'react-router-dom';
import ChangeOwnerControl from '../ChangeOwnerControl';
import SmartTextReader from '../SmartTextReader';
import { htmlToPreviewText } from '../../utils/richText';

// Картка підвиду / народу в правій колонці сторінки виду/раси. Опис за
// замовчуванням скорочений; «Докладніше» розгортає його повністю (з
// форматуванням). Дії (редагувати/видалити/змінити власника) — лише тим,
// кому дозволено.
export default function LineageCard({ item, badge, extra, editTo, canManage, isAdmin, onDelete, onSetOwner }) {
  const [expanded, setExpanded] = useState(false);
  const preview = htmlToPreviewText(item.description || '');
  // Короткий опис не потребує розгортання.
  const expandable = preview.length > 220;

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-tight text-text">{item.name}</h3>
        {badge && (
          <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-semibold text-text-dim">
            {badge}
          </span>
        )}
      </div>

      {item.description && (
        expanded
          ? <SmartTextReader text={item.description} className="text-sm leading-relaxed text-text-muted" />
          : <p className="line-clamp-5 text-sm leading-relaxed text-text-dim">{preview}</p>
      )}
      {extra}

      {expandable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs font-semibold text-accent hover:underline"
        >
          {expanded ? 'Згорнути' : 'Докладніше'}
        </button>
      )}

      {(canManage || isAdmin) && (
        <div className="mt-1 flex flex-wrap items-center gap-3 border-t border-border pt-2.5">
          {canManage && (
            <>
              <Link to={editTo} className="text-xs font-semibold text-accent hover:underline">Редагувати</Link>
              <button type="button" className="text-xs font-semibold text-danger hover:underline" onClick={onDelete}>
                Видалити
              </button>
            </>
          )}
          {isAdmin && <div className="ml-auto"><ChangeOwnerControl onSubmit={onSetOwner} /></div>}
        </div>
      )}
    </article>
  );
}
