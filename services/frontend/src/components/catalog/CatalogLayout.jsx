import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import Button from '../ui/Button';
import { inputClass } from '../ui/Field';
import FilterAccordion from '../ui/FilterAccordion';
import FilterToggleButton from '../ui/FilterToggleButton';
import ViewToggle from '../ui/ViewToggle';
import { pluralizeUk } from '../../utils/pluralize';

// Спільний макет сторінок-каталогів. Від lg: записи ліворуч, праворуч —
// липка бічна панель (підвкладки, дії, пошук, джерело, сортування,
// фільтри), під нею прев'ю запису, на який наведено курсор. Нижче lg панель
// стоїть над записами (як було до цього макета), прев'ю приховане.
//
// sticky рахується відносно #app-scroll (Navbar поза ним), тож top-4 без
// поправки на висоту Navbar.
export default function CatalogLayout({ sidebar, preview, children }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6">
        <aside className="mb-5 no-scrollbar lg:sticky lg:top-4 lg:order-2 lg:mb-0 lg:max-h-[calc(100dvh-6rem)] lg:self-start lg:overflow-y-auto">
          <div className="flex flex-col gap-3 lg:gap-4">{sidebar}</div>
          {preview && <div className="mt-4 hidden lg:block">{preview}</div>}
        </aside>
        <div className="min-w-0 lg:order-1">{children}</div>
      </div>
    </div>
  );
}

// Підписаний блок панелі (Джерело, Сортування...).
export function SidebarSection({ label, children }) {
  return (
    <div>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">{label}</span>
      {children}
    </div>
  );
}

// ── Типові блоки бічної панелі ─────────────────────────────────────────────
// Однаковий порядок на всіх каталогах: вкладки → дії → пошук → вигляд і
// кількість → джерело → сортування → фільтри.

// «+ Новий ...» та інші дії (експорт/імпорт) — лише від md; на мобільному
// створення йде через MobileFab.
export function SidebarActions({ newHref, newLabel, children }) {
  if (!newHref && !children) return null;
  return (
    <div className="hidden items-center gap-2 md:flex">
      {newHref && <Button to={newHref} className="flex-1 whitespace-nowrap">+ {newLabel}</Button>}
      {children}
    </div>
  );
}

export function SidebarSearch({ value, onChange, placeholder = 'Пошук за назвою...' }) {
  return (
    <div className="relative">
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
      <input
        className={`${inputClass} pl-10`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// view/onViewChange — необов'язкові (не в кожного каталогу є таблиця).
// forms — три форми іменника для pluralizeUk.
export function SidebarViewCount({ view, onViewChange, count, forms }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      {onViewChange ? <ViewToggle mode={view} onChange={onViewChange} /> : <span />}
      <p className="text-sm text-text-dim">{count} {pluralizeUk(count, forms)}</p>
    </div>
  );
}

export function SidebarFilters({ open, onToggle, activeCount, children }) {
  return (
    <div>
      <FilterToggleButton open={open} onClick={onToggle} activeCount={activeCount} />
      <FilterAccordion open={open} className="mt-3">{children}</FilterAccordion>
    </div>
  );
}

// Плаваюча кнопка створення — лише на мобільному.
export function MobileFab({ to, label }) {
  return (
    <Link
      to={to}
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
      aria-label={label}
    >
      <Plus size={26} />
    </Link>
  );
}

// Сітка карток у лівій колонці: у 20rem-панелі поруч на lg вміщаються дві.
export const CATALOG_GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3';
