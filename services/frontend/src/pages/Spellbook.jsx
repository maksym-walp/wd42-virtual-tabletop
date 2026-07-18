import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Plus } from 'lucide-react';
import api from '../api/client';
import SpellCard from '../components/SpellCard';
import CollectionsRow from '../components/CollectionsRow';
import ScopeFilter from '../components/ScopeFilter';
import { MAGIC_TYPES, SPELL_KINDS } from '../constants/spellbook';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import Sheet from '../components/ui/Sheet';
import EmptyState from '../components/ui/EmptyState';

const SORT_OPTIONS = [
  { value: 'name',        label: 'За алфавітом' },
  { value: 'action_time', label: 'За діями'      },
  { value: 'energy_cost', label: 'За енергією'   },
];

export default function Spellbook() {
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filter, setFilter] = useState({
    magic_type: '', spell_kind: '', ritual: '', search: '', sort: 'name', scope: '',
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filter.magic_type) params.set('magic_type', filter.magic_type);
    if (filter.spell_kind) params.set('spell_kind', filter.spell_kind);
    if (filter.ritual)     params.set('ritual', filter.ritual);
    if (filter.search)     params.set('search', filter.search);
    if (filter.sort)       params.set('sort', filter.sort);
    if (filter.scope)      params.set('scope', filter.scope);

    setLoading(true);
    api.get(`/api/spellbook/?${params}`)
      .then(({ data }) => setSpells(data.spells))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const toggle = (field, key) =>
    setFilter((f) => ({ ...f, [field]: f[field] === key ? '' : key }));

  const activeFilterCount = ['magic_type', 'spell_kind', 'ritual', 'scope'].filter((k) => filter[k]).length;
  // Hide collections once a narrowing filter is active (search or a category
  // filter). Scope is excluded — it keeps collections split, not hidden.
  const filtersActive = !!(filter.search || filter.magic_type || filter.spell_kind || filter.ritual);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Книга Заклинань</h1>
          <p className="mt-0.5 text-sm text-text-dim">{spells.length} заклинань</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/spellbook/collections">Колекції</Button>
          <Button to="/spellbook/new" className="hidden md:inline-flex">+ Нове заклинання</Button>
        </div>
      </div>

      {/* Search — always visible, prominent */}
      <div className="mb-5 flex gap-2.5">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Пошук за назвою..."
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <button
          onClick={() => setFiltersOpen(true)}
          className="relative inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-text"
        >
          <SlidersHorizontal size={16} /> Фільтри
          {activeFilterCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.65rem] font-bold text-bg">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {!filtersActive && <CollectionsRow domainKey="spellbook" scope={filter.scope} />}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : spells.length === 0 ? (
        <EmptyState title="Заклинань не знайдено" action={<Button to="/spellbook/new">Створити перше</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spells.map((spell) => <SpellCard key={spell.id} spell={spell} />)}
        </div>
      )}

      {/* Floating action button — mobile only */}
      <Link
        to="/spellbook/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Нове заклинання"
      >
        <Plus size={26} />
      </Link>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Фільтри">
        <div className="flex flex-col gap-5">
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Джерело</span>
            <ScopeFilter scope={filter.scope} onChange={(v) => setFilter((f) => ({ ...f, scope: v }))} />
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Тип магії</span>
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={filter.magic_type === ''} onClick={() => setFilter((f) => ({ ...f, magic_type: '' }))}>
                Усі
              </FilterPill>
              {Object.entries(MAGIC_TYPES).map(([key, { label, color }]) => (
                <FilterPill key={key} active={filter.magic_type === key} color={color} onClick={() => toggle('magic_type', key)}>
                  {label}
                </FilterPill>
              ))}
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Вид</span>
            <div className="flex flex-wrap gap-1.5">
              <FilterPill active={filter.spell_kind === ''} onClick={() => setFilter((f) => ({ ...f, spell_kind: '' }))}>
                Усі
              </FilterPill>
              {Object.entries(SPELL_KINDS).map(([key, { label }]) => (
                <FilterPill key={key} active={filter.spell_kind === key} onClick={() => toggle('spell_kind', key)}>
                  {label}
                </FilterPill>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Ритуал</span>
            <select
              className={inputClass}
              value={filter.ritual}
              onChange={(e) => setFilter((f) => ({ ...f, ritual: e.target.value }))}
            >
              <option value="">Будь-який ритуал</option>
              <option value="impossible">Неможливий</option>
              <option value="possible">Можливий</option>
              <option value="required">Необхідний</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Сортування</span>
            <select
              className={inputClass}
              value={filter.sort}
              onChange={(e) => setFilter((f) => ({ ...f, sort: e.target.value }))}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <Button onClick={() => setFiltersOpen(false)} className="w-full">Показати {spells.length} заклинань</Button>
        </div>
      </Sheet>
    </div>
  );
}

function FilterPill({ active, color, onClick, children }) {
  // matches the CSS --color-accent token — kept as a literal hex (not the CSS
  // var) since it needs '+alpha' string concatenation for the active bg tint.
  const activeColor = color || '#5b440a';
  return (
    <button
      onClick={onClick}
      className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
      style={active
        ? { borderColor: activeColor, color: activeColor, background: activeColor + '18' }
        : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
    >
      {children}
    </button>
  );
}
