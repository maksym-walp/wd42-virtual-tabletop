import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useEntitySearch } from './entitySearch';
import EntityResultRow from './EntityResultRow';

const POPUP_W = 300;
const MARGIN = 8;

// Підказка «@»: список записів під курсором. Керується з клавіатури через
// keyRef — розширення EntitySuggest передає сюди стрілки/Enter/Tab, поки
// підказка відкрита й є що вибрати (інакше Enter — звичайний перенос рядка).
export default function EntitySuggestPopup({ state, editor, keyRef }) {
  const { from, to, query, rect } = state;
  const { results: found, loading } = useEntitySearch({ query, limit: 3, minLen: 1 });
  const results = useMemo(() => found.slice(0, 8), [found]);
  const [index, setIndex] = useState(0);
  const elRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => { setIndex(0); }, [results]);

  const pick = (result) => {
    editor.chain().focus().insertContentAt({ from, to }, [
      { type: 'entityLink', attrs: { kind: result.kind, id: result.id, form: null, label: result.name, live: true } },
      { type: 'text', text: ' ' },
    ]).run();
  };

  useEffect(() => {
    keyRef.current = (event) => {
      if (results.length === 0) return false;
      if (event.key === 'ArrowDown') { setIndex((i) => (i + 1) % results.length); return true; }
      if (event.key === 'ArrowUp') { setIndex((i) => (i - 1 + results.length) % results.length); return true; }
      if (event.key === 'Enter' || event.key === 'Tab') { pick(results[index]); return true; }
      return false;
    };
    return () => { keyRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, index, from, to]);

  useLayoutEffect(() => {
    const h = elRef.current?.offsetHeight ?? 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(rect.left, vw - POPUP_W - MARGIN));
    const below = rect.bottom + 6;
    const top = below + h + MARGIN <= vh ? below : Math.max(MARGIN, rect.top - h - 6);
    setPos({ left, top });
  }, [rect, results, loading]);

  return createPortal(
    <div
      ref={elRef}
      role="listbox"
      className="fixed z-[70] overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
      style={{ width: POPUP_W, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      {results.map((r, i) => (
        <EntityResultRow
          key={`${r.kind}:${r.id}`}
          result={r}
          active={i === index}
          onPick={pick}
          onHover={() => setIndex(i)}
        />
      ))}
      {results.length === 0 && (
        <p className="px-3 py-2 text-xs text-text-dim">
          {loading ? 'Шукаю…' : query.trim() ? 'Нічого не знайдено' : 'Назва запису сайту…'}
        </p>
      )}
    </div>,
    document.body,
  );
}
