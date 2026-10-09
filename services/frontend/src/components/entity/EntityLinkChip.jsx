import { useEffect, useRef, useState } from 'react';
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
  kind, id, form, label, live, editable = false, selected = false, onResolvedName,
}) {
  const def = ENTITY_KINDS[kind];
  const ref = useRef(null);
  const timer = useRef(null);
  const [active, setActive] = useState(false);
  const [anchor, setAnchor] = useState(null);

  const { status, data } = useEntity(kind, id, live || active);
  const entry = data && form && def?.withForm ? def.withForm(data, form) : data;

  useEffect(() => () => clearTimeout(timer.current), []);

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
  const body = (
    <>
      <Icon size={12} className="entity-link__icon" aria-hidden="true" />
      <span>{chipText({ def, entry, live, label })}</span>
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
