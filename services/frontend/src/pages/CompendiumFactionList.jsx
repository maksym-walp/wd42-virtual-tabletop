import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import compendiumApi from '../api/compendium';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { htmlToPreviewText } from '../utils/richText';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarActions, SidebarSearch, SidebarViewCount, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import { CatalogPreview, SimplePreview } from '../components/catalog/previews';

export default function CompendiumFactionList() {
  const [factions, setFactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [hovered, bindPreview] = useHoverPreview();

  useEffect(() => {
    setLoading(true);
    compendiumApi.listFactions()
      .then(setFactions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = factions.filter((f) => f.name?.toLowerCase().includes(search.toLowerCase()));

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('compendium')} />
      <SidebarActions newHref="/compendium/factions/new" newLabel="Нова фракція" />
      <SidebarSearch value={search} onChange={setSearch} />
      <SidebarViewCount count={filtered.length} forms={['фракція', 'фракції', 'фракцій']} />
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={
        <CatalogPreview item={hovered}>
          {hovered && (
            <SimplePreview
              href={`/compendium/factions/${hovered.id}`}
              image={hovered.symbol_url}
              badges={['Фракція']}
              title={hovered.name}
              description={hovered.description}
            />
          )}
        </CatalogPreview>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Фракцій не знайдено" action={<Button to="/compendium/factions/new">Створити першу</Button>} />
      ) : (
        <div className={CATALOG_GRID}>
          {filtered.map((f) => (
            <Link
              key={f.id}
              to={`/compendium/factions/${f.id}`}
              {...bindPreview(f)}
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
                {f.description && <p className="line-clamp-2 text-sm italic leading-snug text-text-dim">{htmlToPreviewText(f.description)}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}

      <MobileFab to="/compendium/factions/new" label="Нова фракція" />
    </CatalogLayout>
  );
}
