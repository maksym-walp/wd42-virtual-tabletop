import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import traditionsApi from '../api/traditions';
import { getDomainTabs } from '../collectionsDomains';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import CatalogTabs from '../components/CatalogTabs';
import { htmlToPreviewText } from '../utils/richText';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarActions, SidebarSearch, SidebarViewCount, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import { CatalogPreview, SimplePreview } from '../components/catalog/previews';

export default function TraditionsList() {
  const { user } = useAuth();
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';

  const [traditions, setTraditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [hovered, bindPreview] = useHoverPreview();

  useEffect(() => {
    setLoading(true);
    traditionsApi.getAll({ search })
      .then(setTraditions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  const handleDelete = async (t) => {
    if (!confirm(`Видалити традицію «${t.name}»?`)) return;
    setDeletingId(t.id);
    try {
      await traditionsApi.remove(t.id);
      setTraditions((prev) => prev.filter((x) => x.id !== t.id));
    } catch {
      setDeletingId(null);
    }
  };

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('spellbook')} />
      {canManageTraditions && <SidebarActions newHref="/spellbook/traditions/new" newLabel="Нова традиція" />}
      <SidebarSearch value={search} onChange={setSearch} />
      <SidebarViewCount count={traditions.length} forms={['традиція', 'традиції', 'традицій']} />
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={
        <CatalogPreview item={hovered}>
          {hovered && (
            <SimplePreview
              href={`/spellbook/traditions/${hovered.id}`}
              badges={['Традиція', `${(hovered.spells || []).length} заклинань`]}
              title={hovered.name}
              subtitle={hovered.founders ? `Засновники: ${hovered.founders}` : null}
              description={hovered.description}
            />
          )}
        </CatalogPreview>
      }
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : traditions.length === 0 ? (
        <EmptyState
          title="Традицій не знайдено"
          action={canManageTraditions ? <Button to="/spellbook/traditions/new">Створити першу</Button> : null}
        />
      ) : (
        <div className={CATALOG_GRID}>
          {traditions.map((t) => (
            <div
              key={t.id}
              {...bindPreview(t)}
              className="relative block overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:bg-surface-hover"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                  {(t.spells || []).length} заклинань
                </span>
                {canManageTraditions && (
                  <div className="relative z-10 ml-auto flex items-center gap-3">
                    <Link to={`/spellbook/traditions/${t.id}/edit`} className="text-[0.7rem] font-semibold text-accent">
                      Редагувати
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(t)}
                      disabled={deletingId === t.id}
                      className="text-[0.7rem] font-semibold text-danger disabled:opacity-50"
                    >
                      {deletingId === t.id ? 'Видалення...' : 'Видалити'}
                    </button>
                  </div>
                )}
              </div>
              {/* Stretched link: after: overlay covers the whole card; edit/delete sit above it (z-10). */}
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">
                <Link to={`/spellbook/traditions/${t.id}`} className="after:absolute after:inset-0">{t.name}</Link>
              </h3>
              {t.founders && (
                <p className="px-3.5 pb-1 text-xs italic text-text-dim">Засновники: {t.founders}</p>
              )}
              {t.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{htmlToPreviewText(t.description)}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canManageTraditions && <MobileFab to="/spellbook/traditions/new" label="Нова традиція" />}
    </CatalogLayout>
  );
}
