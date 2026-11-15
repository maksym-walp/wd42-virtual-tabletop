import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { ENTITY_KINDS, entityHref } from './entityRegistry';
import useEntity from './useEntity';
import EntityHoverCard from './EntityHoverCard';

const HOVER_DELAY = 250;

// Підпис чіпа: для «живого» посилання — актуальна назва запису (з формою),
// інакше — текст, який автор сам задав (старі `[текст](url)`-посилання).
function chipText({ def, entry, live, label }) {
  if (live && entry?.name) return entry.form_label ? `${entry.name} — ${entry.form_label}` : entry.name;
  return label || entry?.name || def.label;
}

// Внутрішнє посилання на запис сайту: «рамочка» акцентного кольору з іконкою
// сервісу ліворуч, при наведенні — картка прев'ю. Завжди відкривається в новій
// вкладці. В редакторі (editable) це не <a>, щоб клік лише виділяв вузол;
// відкрити можна Ctrl/⌘+клік. onResolvedName — повідомити вузол про актуальну назву.
export default function EntityLinkChip({
  kind, id, form, label, live, editable = false, selected = false, onResolvedName, onEditLabel,
}) {
  const def = ENTITY_KINDS[kind];
  const ref = useRef(null);
  const timer = useRef(null);
  const inputRef = useRef(null);
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { status, data } = useEntity(kind, id, live || active);
  const entry = data && form && def?.withForm ? def.withForm(data, form) : data;

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  useEffect(() => {
    if (live && status === 'ok' && entry?.name) onResolvedName?.(entry.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, status, entry?.name]);

  if (!def) return <span>{label}</span>;

  const open = () => {
    setActive(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (ref.current) setAnchor(ref.current.getBoundingClientRect());
    }, HOVER_DELAY);
  };
  const close = () => {
    clearTimeout(timer.current);
    setActive(false);
    setAnchor(null);
  };

  const Icon = def.icon;
  const href = entityHref(kind, id, form);
  const className = [
    'entity-link',
    status === 'missing' && 'entity-link--missing',
    selected && 'entity-link--selected',
  ].filter(Boolean).join(' ');
  const currentText = chipText({ def, entry, live, label });

  const startEditing = () => {
    setDraft(currentText);
    setEditing(true);
  };
  const commitEdit = () => {
    const next = draft.trim();
    setEditing(false);
    // Порожній рядок — повернутися до живої назви замість зберігати "нічого".
    if (!next || next === entry?.name) onEditLabel?.('', true);
    else onEditLabel?.(next, false);
  };
  const cancelEdit = () => setEditing(false);

  if (editable && editing) {
    return (
      <span ref={ref} className={className}>
        <Icon size={12} className="entity-link__icon" aria-hidden="true" />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
          }}
          onBlur={commitEdit}
          className="min-w-0 bg-transparent outline-none"
          style={{ width: `${Math.max(2, draft.length)}ch` }}
        />
      </span>
    );
  }

  const body = (
    <>
      <Icon size={12} className="entity-link__icon" aria-hidden="true" />
      <span>{currentText}</span>
      {editable && selected && (
        <button
          type="button"
          title="Змінити текст згадки (наприклад, відмінити ім'я)"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEditing(); }}
          className="entity-link__edit"
        >
          <Pencil size={10} />
        </button>
      )}
    </>
  );
  const shared = {
    ref,
    className,
    onPointerEnter: (e) => { if (e.pointerType === 'mouse') open(); },
    onPointerLeave: close,
    onFocus: open,
    onBlur: close,
  };

  return (
    <>
      {editable ? (
        <span
          {...shared}
          title={`${def.label} · Ctrl+клік — відкрити`}
          onClick={(e) => { if (e.ctrlKey || e.metaKey) window.open(href, '_blank', 'noopener,noreferrer'); }}
        >
          {body}
        </span>
      ) : (
        <a {...shared} href={href} target="_blank" rel="noopener noreferrer" onClick={close}>
          {body}
        </a>
      )}
      {anchor && <EntityHoverCard kind={kind} entry={entry} status={status} anchor={anchor} />}
    </>
  );
}
