import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import compendiumApi from '../api/compendium';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { htmlToPreviewText } from '../utils/richText';
import DataTable from '../components/ui/DataTable';
import useViewMode from '../hooks/useViewMode';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarSection, SidebarActions, SidebarSearch, SidebarViewCount, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import { CatalogPreview, SimplePreview } from '../components/catalog/previews';

const KIND_LABELS = { species: 'Вид', race: 'Раса' };
const KIND_FILTERS = [
  { key: '', label: 'Усі' },
  { key: 'species', label: 'Види' },
  { key: 'race', label: 'Раси' },
];

const TAXONOMY_TABLE_COLUMNS = [
  { key: 'name', label: 'Назва', render: (t) => t.name },
  { key: 'kind', label: 'Тип', render: (t) => KIND_LABELS[t.kind] },
  { key: 'health_die', label: "Кубик здоров'я", render: (t) => (t.kind === 'species' ? (t.health_die || 'd6') : '—') },
  { key: 'description', label: 'Опис', render: (t) => <span className="line-clamp-1">{t.description || '—'}</span> },
];

// Види (compendium.species) and Раси (compendium.races) are two distinct
// catalogs on the backend — species/subspecies carry a health_die,
// races/peoples don't and carry an origin field instead — but browsed
// together here as one merged, filterable "Народи та види" list. Each row
// still links to its own type's detail page (/compendium/species/:id or
// /compendium/races/:id), which is where the actual species-vs-race
// distinction (subspecies vs peoples, health die vs origin) is managed.
export default function CompendiumTaxonomyList() {
  const [species, setSpecies] = useState([]);
  const [races, setRaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [view, setView] = useViewMode('compendium-taxonomy');
  const [hovered, bindPreview, setHovered] = useHoverPreview();

  useEffect(() => {
    setLoading(true);
    Promise.all([compendiumApi.listSpecies(), compendiumApi.listRaces()])
      .then(([sp, rc]) => { setSpecies(sp); setRaces(rc); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const merged = [
    ...species.map((s) => ({ ...s, kind: 'species', href: `/compendium/species/${s.id}` })),
    ...races.map((r) => ({ ...r, kind: 'race', href: `/compendium/races/${r.id}` })),
  ].sort((a, b) => a.name.localeCompare(b.name, 'uk'));

  const filtered = merged.filter((t) =>
    (!kindFilter || t.kind === kindFilter) &&
    t.name?.toLowerCase().includes(search.toLowerCase())
  );
  const showCards = view === 'cards';

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('compendium')} />

      <SidebarActions>
        <Button to="/compendium/species/new" variant="ghost" className="flex-1 whitespace-nowrap">+ Вид</Button>
        <Button to="/compendium/races/new" className="flex-1 whitespace-nowrap">+ Раса</Button>
      </SidebarActions>

      <SidebarSearch value={search} onChange={setSearch} />

      <SidebarViewCount view={view} onViewChange={setView} count={filtered.length} forms={['запис', 'записи', 'записів']} />

      <SidebarSection label="Тип">
        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              onClick={() => setKindFilter(f.key)}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                kindFilter === f.key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim hover:text-text'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </SidebarSection>
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={
        <CatalogPreview item={hovered}>
          {hovered && (
            <SimplePreview
              href={hovered.href}
              image={hovered.image_url}
              badges={[KIND_LABELS[hovered.kind], hovered.kind === 'species' ? `Здоров'я ${hovered.health_die || 'd6'}` : null]}
              title={hovered.name}
              subtitle={hovered.origin}
              description={hovered.description}
            />
          )}
        </CatalogPreview>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Нічого не знайдено" action={<Button to="/compendium/races/new">Створити расу</Button>} />
      ) : showCards ? (
        <div className={CATALOG_GRID}>
          {filtered.map((t) => (
            <Link
              key={`${t.kind}:${t.id}`}
              to={t.href}
              {...bindPreview(t)}
              className="block overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold text-text-dim">{KIND_LABELS[t.kind]}</span>
                {t.kind === 'species' && (
                  <span className="text-[0.7rem] text-text-dim">· {t.health_die || 'd6'}</span>
                )}
              </div>
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{t.name}</h3>
              {t.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{htmlToPreviewText(t.description)}</p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <DataTable
          items={filtered} columns={TAXONOMY_TABLE_COLUMNS} getKey={(t) => `${t.kind}:${t.id}`} getHref={(t) => t.href}
          onRowHover={setHovered}
        />
      )}

      <MobileFab to="/compendium/races/new" label="Новий запис" />
    </CatalogLayout>
  );
}
