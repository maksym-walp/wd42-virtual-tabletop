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
import ViewToggle from '../components/ui/ViewToggle';
import useViewMode from '../hooks/useViewMode';

export default function CompendiumSpeciesList() {
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [view, setView] = useViewMode('compendium-species');

  useEffect(() => {
    setLoading(true);
    compendiumApi.listSpecies()
      .then(setSpecies)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = species.filter((s) => s.name?.toLowerCase().includes(search.toLowerCase()));
  const showCards = view === 'cards';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('compendium')} />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="col-start-1">
          <ViewToggle mode={view} onChange={setView} />
        </div>
        <p className="col-start-2 hidden justify-self-center text-sm text-text-dim sm:block">
          {filtered.length} {pluralizeUk(filtered.length, ['вид', 'види', 'видів'])}
        </p>
        <Button to="/compendium/species/new" className="col-start-3 hidden justify-self-end whitespace-nowrap md:inline-flex">+ Новий вид</Button>
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
        <EmptyState title="Видів не знайдено" action={<Button to="/compendium/species/new">Створити перший</Button>} />
      ) : showCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/compendium/species/${s.id}`}
              className="block overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold text-text-dim">{s.health_die || 'd6'}</span>
                {s.is_public && <span className="ml-auto text-[0.65rem] italic text-text-dim">публічний</span>}
                {!s.is_owner && <span className={`text-[0.65rem] italic text-text-dim ${s.is_public ? '' : 'ml-auto'}`}>чужий</span>}
              </div>
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{s.name}</h3>
              {s.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{s.description}</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <SpeciesTable species={filtered} />
      )}

      <Link
        to="/compendium/species/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий вид"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}

function SpeciesTable({ species }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Назва</th>
            <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Кубик здоров'я</th>
            <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Опис</th>
          </tr>
        </thead>
        <tbody>
          {species.map((s) => (
            <tr key={s.id} className="hover:bg-surface-hover">
              <td className="border-b border-bg px-3 py-2">
                <Link to={`/compendium/species/${s.id}`} className="text-accent hover:underline">{s.name}</Link>
                {s.is_public && <span className="ml-1.5 text-[0.65rem] italic text-text-dim">публічний</span>}
              </td>
              <td className="border-b border-bg px-3 py-2 text-text-muted">{s.health_die || 'd6'}</td>
              <td className="border-b border-bg px-3 py-2 text-text-muted line-clamp-1">{s.description || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
