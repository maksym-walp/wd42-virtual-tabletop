import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import traditionsApi from '../api/traditions';
import SpellCard from '../components/SpellCard';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { NATURE_TYPES, SPELL_KINDS, RITUAL_TYPES, formatDuration, natureLabels } from '../constants/spellbook';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import CanonBadge from '../components/CanonBadge';
import useViewMode from '../hooks/useViewMode';

const SPELL_TABLE_COLUMNS = [
  { key: 'name', label: 'Назва', render: (s) => (
    <span className="inline-flex items-center gap-1.5">
      {s.name}
      {s.is_canonical && <CanonBadge />}
    </span>
  ) },
  { key: 'nature', label: 'Природа', render: (s) => natureLabels(s.nature) },
  { key: 'spell_kind', label: 'Вид', render: (s) => SPELL_KINDS[s.spell_kind]?.label ?? s.spell_kind },
  { key: 'energy_cost', label: 'Енергія', render: (s) => s.energy_cost },
  { key: 'action_time', label: 'Дії', render: (s) => `${s.action_time}/3` },
  { key: 'ritual', label: 'Ритуал', render: (s) => RITUAL_TYPES[s.ritual]?.label ?? s.ritual },
  { key: 'duration', label: 'Тривалість', render: (s) => formatDuration(s.duration_value, s.duration_unit) },
  { key: 'owner', label: 'Автор', render: (s) => s.owner_username ? `@${s.owner_username}` : '—' },
];

const SORT_OPTIONS = [
  { value: 'name',        label: 'За алфавітом' },
  { value: 'action_time', label: 'За діями'      },
  { value: 'energy_cost', label: 'За енергією'   },
];

export default function Spellbook() {
  const [spells, setSpells] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useViewMode('spellbook');
  const [traditions, setTraditions] = useState([]);
  const [filter, setFilter] = useState({
    nature: [], spell_kind: '', ritual: '', tradition: [], search: '', sort: 'name', scope: '',
  });

  useEffect(() => {
    traditionsApi.getAll().then(setTraditions).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    filter.nature.forEach((n) => params.append('nature', n));
    if (filter.spell_kind) params.set('spell_kind', filter.spell_kind);
    if (filter.ritual)     params.set('ritual', filter.ritual);
    filter.tradition.forEach((t) => params.append('tradition', t));
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

  const toggleMulti = (field, key) =>
    setFilter((f) => ({
      ...f,
      [field]: f[field].includes(key) ? f[field].filter((v) => v !== key) : [...f[field], key],
    }));

  const activeFilterCount = ['spell_kind', 'ritual', 'scope'].filter((k) => filter[k]).length
    + (filter.nature.length > 0 ? 1 : 0)
    + (filter.tradition.length > 0 ? 1 : 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('spellbook')} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-text-dim">{spells.length} заклинань</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/spellbook/traditions">Традиції</Button>
          <Button to="/spellbook/new" className="hidden md:inline-flex">+ Нове заклинання</Button>
        </div>
      </div>

      {/* Search — always visible, prominent */}
      <div className="mb-3 flex gap-2.5">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Пошук за назвою..."
            value={filter.search}
            onChange={(e) => setFilter((f) => ({ ...f, search: e.target.value }))}
          />
        </div>
        <FilterToggleButton open={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount} />
        <ViewToggle mode={viewMode} onChange={setViewMode} />
      </div>

      <FilterAccordion open={filtersOpen}>
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Джерело</span>
          <ScopeFilter scope={filter.scope} onChange={(v) => setFilter((f) => ({ ...f, scope: v }))} />
        </div>

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Природа</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filter.nature.length === 0} onClick={() => setFilter((f) => ({ ...f, nature: [] }))}>
              Усі
            </FilterPill>
            {Object.entries(NATURE_TYPES).map(([key, { label }]) => (
              <FilterPill key={key} active={filter.nature.includes(key)} onClick={() => toggleMulti('nature', key)}>
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

        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Традиція</span>
          <div className="flex flex-wrap gap-1.5">
            <FilterPill active={filter.tradition.length === 0} onClick={() => setFilter((f) => ({ ...f, tradition: [] }))}>
              Усі
            </FilterPill>
            {traditions.map((t) => (
              <FilterPill key={t.id} active={filter.tradition.includes(t.id)} onClick={() => toggleMulti('tradition', t.id)}>
                {t.name}
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
      </FilterAccordion>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : spells.length === 0 ? (
        <EmptyState title="Заклинань не знайдено" action={<Button to="/spellbook/new">Створити перше</Button>} />
      ) : viewMode === 'table' ? (
        <DataTable
          items={spells}
          columns={SPELL_TABLE_COLUMNS}
          getKey={(s) => s.id}
          getHref={(s) => `/spellbook/${s.id}`}
        />
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
    </div>
  );
}

function FilterPill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
        active ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
      }`}
    >
      {children}
    </button>
  );
}
