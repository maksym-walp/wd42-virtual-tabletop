import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Sheet from './Sheet';
import useMediaQuery from '../../hooks/useMediaQuery';

// Бічна панель деталей (вузол дерева розвитку тощо). На широкому екрані —
// звичайна колонка поруч із полотном: полотно стискається, а не
// перекривається. Тому SidePanel має стояти flex-братом полотна в рядку
// (`flex`). На вузькому екрані — як і раніше нижній аркуш поверх сторінки.
export const SIDE_PANEL_WIDTH = 360;
const WIDE_QUERY = '(min-width: 1024px)';

export function useIsSidePanelWide() {
  return useMediaQuery(WIDE_QUERY);
}

// Коли панель відкривається/закривається, полотно втрачає/повертає
// SIDE_PANEL_WIDTH пікселів ширини. Зсуваємо pan-трансформ на пів ширини,
// щоб дерево лишалося по центру видимої частини, а не обрізалося справа.
export function useSidePanelShift(open, setTransform) {
  const wide = useIsSidePanelWide();
  const active = open && wide;
  const prev = useRef(false);
  useEffect(() => {
    if (active === prev.current) return;
    prev.current = active;
    const dx = (active ? -1 : 1) * SIDE_PANEL_WIDTH / 2;
    setTransform((t) => ({ ...t, x: t.x + dx }));
  }, [active, setTransform]);
}

export default function SidePanel({ open, onClose, title, children }) {
  const wide = useIsSidePanelWide();
  if (!open) return null;
  if (!wide) return <Sheet open onClose={onClose} title={title}>{children}</Sheet>;

  return (
    <aside
      role="complementary"
      aria-label={typeof title === 'string' ? title : undefined}
      className="flex shrink-0 flex-col border-l border-border bg-surface"
      style={{ width: SIDE_PANEL_WIDTH }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3">
        {title && <h2 className="font-display text-lg text-text">{title}</h2>}
        <button
          onClick={onClose}
          aria-label="Закрити"
          className="ml-auto rounded-full p-2 text-text-dim hover:bg-surface-hover"
        >
          <X size={20} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
    </aside>
  );
}
