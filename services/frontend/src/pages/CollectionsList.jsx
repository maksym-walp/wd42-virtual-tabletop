import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { COLLECTION_DOMAINS, getDomainTabs } from '../collectionsDomains';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ScopeFilter from '../components/ScopeFilter';
import CatalogTabs from '../components/CatalogTabs';
import EquipmentCollectionsByType from '../components/EquipmentCollectionsByType';
import { htmlToPreviewText } from '../utils/richText';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarSection, SidebarActions, SidebarSearch, SidebarViewCount, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import { CatalogPreview, SimplePreview } from '../components/catalog/previews';
import CroppedImage from '../components/ui/CroppedImage';

export default function CollectionsList({ domainKey }) {
  const domain = COLLECTION_DOMAINS[domainKey];
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('');
  const [hovered, bindPreview] = useHoverPreview();

  useEffect(() => {
    setLoading(true);
    domain.collectionsApi.getAll({ search, scope })
      .then(setCollections)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, scope, domainKey]);

  const newHref = `${domain.basePath}/collections/new`;

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs(domainKey)} />
      <SidebarActions newHref={newHref} newLabel="Нова колекція" />
      <SidebarSearch value={search} onChange={setSearch} />
      <SidebarViewCount count={collections.length} forms={['колекція', 'колекції', 'колекцій']} />
      {domain.supportsCanonical !== false && (
        <SidebarSection label="Джерело">
          <ScopeFilter scope={scope} onChange={setScope} />
        </SidebarSection>
      )}
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={
        <CatalogPreview item={hovered}>
          {hovered && (
            <SimplePreview
              href={`${domain.basePath}/collections/${hovered.id}`}
              image={hovered.image_url}
              imageCrop={hovered.image_crop}
              badges={[`${(hovered.items || []).length} ${domain.itemLabel}`]}
              title={hovered.name}
              subtitle={(hovered.items || []).slice(0, 8).map((it) => it.name).filter(Boolean).join(', ')}
              description={hovered.description}
            />
          )}
        </CatalogPreview>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : collections.length === 0 ? (
        <EmptyState title="Колекцій не знайдено" action={<Button to={newHref}>Створити першу</Button>} />
      ) : domainKey === 'equipment' ? (
        <EquipmentCollectionsByType collections={collections} basePath={domain.basePath} bindPreview={bindPreview} />
      ) : (
        <div className={CATALOG_GRID}>
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`${domain.basePath}/collections/${c.id}`}
              {...bindPreview(c)}
              className="block overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              {c.image_url && (
                <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
                  <CroppedImage src={c.image_url} crop={c.image_crop} alt={c.name} loading="lazy" />
                </div>
              )}
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                  {(c.items || []).length} {domain.itemLabel}
                </span>
              </div>
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{c.name}</h3>
              {!c.image_url && c.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">
                  {htmlToPreviewText(c.description)}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      <MobileFab to={newHref} label="Нова колекція" />
    </CatalogLayout>
  );
}
