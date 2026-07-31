import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import traditionsApi from '../api/traditions';
import { getDomainTabs } from '../collectionsDomains';
import { pluralizeUk } from '../utils/pluralize';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import CatalogTabs from '../components/CatalogTabs';

export default function TraditionsList() {
  const { user } = useAuth();
  const canManageTraditions = user?.role === 'admin' || user?.role === 'game_master';

  const [traditions, setTraditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState(null);

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('spellbook')} />

      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm text-text-dim">
          {traditions.length} {pluralizeUk(traditions.length, ['традиція', 'традиції', 'традицій'])}
        </p>
        {canManageTraditions && (
          <Button to="/spellbook/traditions/new" className="hidden whitespace-nowrap md:inline-flex">+ Нова традиція</Button>
        )}
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

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : traditions.length === 0 ? (
        <EmptyState
          title="Традицій не знайдено"
          action={canManageTraditions ? <Button to="/spellbook/traditions/new">Створити першу</Button> : null}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {traditions.map((t) => (
            <div
              key={t.id}
              className="block overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                  {(t.spells || []).length} заклинань
                </span>
                {canManageTraditions && (
                  <div className="ml-auto flex items-center gap-3">
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
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{t.name}</h3>
              {t.founders && (
                <p className="px-3.5 pb-1 text-xs italic text-text-dim">Засновники: {t.founders}</p>
              )}
              {t.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{t.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {canManageTraditions && (
        <Link
          to="/spellbook/traditions/new"
          className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
          aria-label="Нова традиція"
        >
          <Plus size={26} />
        </Link>
      )}
    </div>
  );
}
