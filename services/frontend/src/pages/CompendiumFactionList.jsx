import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import compendiumApi from '../api/compendium';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import { pluralizeUk } from '../utils/pluralize';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

export default function CompendiumFactionList() {
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    compendiumApi.listFactions()
      .then(setFactions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = factions.filter((f) => f.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('compendium')} />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <span />
        <p className="col-start-2 hidden justify-self-center text-sm text-text-dim sm:block">
          {filtered.length} {pluralizeUk(filtered.length, ['фракція', 'фракції', 'фракцій'])}
        </p>
        <Button to="/compendium/factions/new" className="col-start-3 hidden justify-self-end whitespace-nowrap md:inline-flex">+ Нова фракція</Button>
      </div>

      <div className="mb-5 flex gap-2.5">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Пошук за назвою..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Фракцій не знайдено" action={<Button to="/compendium/factions/new">Створити першу</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((f) => (
            <Link
              key={f.id}
              to={`/compendium/factions/${f.id}`}
              className="flex items-start gap-3 overflow-hidden rounded-lg border border-border bg-surface p-3.5"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              {f.symbol_url ? (
                <img src={f.symbol_url} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-border object-cover" />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-border" />
              )}
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg text-accent">{f.name}</h3>
                {f.description && <p className="line-clamp-2 text-sm italic leading-snug text-text-dim">{f.description}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/compendium/factions/new"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Нова фракція"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
