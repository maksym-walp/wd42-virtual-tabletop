import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, LayoutGrid, Table2 } from 'lucide-react';
import api from '../api/client';
import ArtifactCard from '../components/ArtifactCard';
import CollectionsRow from '../components/CollectionsRow';
import ScopeFilter from '../components/ScopeFilter';
import { RARITIES } from '../constants/artifacts';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

export default function ArtifactsCatalog() {
  const [rarity, setRarity]   = useState('');
  const [scope, setScope]     = useState('');
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [sort, setSort]       = useState('name');
  const [dir, setDir]         = useState('asc');
  const [view, setView]       = useState('table'); // table | cards

  useEffect(() => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);
    if (rarity) params.set('rarity', rarity);

    setLoading(true);
    api.get(`/api/artifacts/?${params}`)
      .then(({ data }) => setArtifacts(data.artifacts))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [rarity, search, sort, dir, scope]);

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  const showCards = view === 'cards';
  // Collections stay visible under the scope filter (which splits them) but are
  // hidden once search or a rarity filter narrows the list — same rule as the
  // equipment catalog.
  const filtersActive = search.trim() !== '' || rarity !== '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Артефакти</h1>
          <p className="mt-0.5 text-sm text-text-dim">{artifacts.length} артефактів</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/artifacts/collections">Колекції</Button>
          <Button to="/artifacts/new" className="hidden md:inline-flex">+ Новий артефакт</Button>
        </div>
      </div>

      <ScopeFilter scope={scope} onChange={setScope} className="mb-4" />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setRarity('')}
            className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
            style={rarity === ''
              ? { borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }
              : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
          >
            Усі
          </button>
          {Object.entries(RARITIES).map(([key, { label, color }]) => (
            <button
              key={key}
              onClick={() => setRarity(key)}
              className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
              style={rarity === key
                ? { borderColor: color, color, background: color + '18' }
                : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex overflow-hidden rounded-lg border border-border">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${view === 'table' ? 'bg-accent/10 text-accent' : 'text-text-dim'}`}
            onClick={() => setView('table')}
          >
            <Table2 size={15} /> Таблиця
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold ${view === 'cards' ? 'bg-accent/10 text-accent' : 'text-text-dim'}`}
            onClick={() => setView('cards')}
          >
            <LayoutGrid size={15} /> Картки
          </button>
        </div>
      </div>

      <div className="relative mb-5">
        <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Пошук за назвою..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {!filtersActive && <CollectionsRow domainKey="artifacts" scope={scope} />}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : artifacts.length === 0 ? (
        <EmptyState title="Артефактів не знайдено" action={<Button to="/artifacts/new">Створити перший</Button>} />
      ) : showCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => <ArtifactCard key={a.id} artifact={a} />)}
        </div>
      ) : (
        <ArtifactsTable artifacts={artifacts} sort={sort} dir={dir} onSort={toggleSort} />
      )}

      <Link
        to="/artifacts/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий артефакт"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}

function Th({ label, sortKey, sort, dir, onSort, className = '' }) {
  const active = sort === sortKey;
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim hover:text-text ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-accent">{dir === 'desc' ? '↓' : '↑'}</span>}
      </span>
    </th>
  );
}

function ArtifactsTable({ artifacts, sort, dir, onSort }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <Th label="Назва" sortKey="name" sort={sort} dir={dir} onSort={onSort} />
            <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Творець</th>
            <Th label="Рідкість" sortKey="rarity" sort={sort} dir={dir} onSort={onSort} />
            <Th label="Ціна" sortKey="price" sort={sort} dir={dir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {artifacts.map((a) => (
            <tr key={a.id} className="hover:bg-surface-hover">
              <td className="border-b border-bg px-3 py-2">
                <Link to={`/artifacts/${a.id}`} className="text-accent hover:underline">{a.name}</Link>
                {a.is_public && <span className="ml-1.5 text-[0.65rem] italic text-text-dim">публічне</span>}
              </td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{a.creator ?? '—'}</td>
              <td className="border-b border-bg px-3 py-2">
                {a.rarity
                  ? <span style={{ color: RARITIES[a.rarity]?.color }}>{RARITIES[a.rarity]?.label}</span>
                  : <span className="text-text-muted">—</span>}
              </td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{a.price ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
