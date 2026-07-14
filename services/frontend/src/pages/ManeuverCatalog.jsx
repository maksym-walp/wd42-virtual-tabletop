import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import ManeuverCard from '../components/ManeuverCard';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

export default function ManeuverCatalog() {
  const [maneuvers, setManeuvers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    setLoading(true);
    api.get(`/api/maneuvers/?${params}`)
      .then(({ data }) => setManeuvers(data.maneuvers))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Маневри</h1>
          <p className="mt-0.5 text-sm text-text-dim">{maneuvers.length} маневрів</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/maneuvers/collections">Колекції</Button>
          <Button to="/maneuvers/new" className="hidden md:inline-flex">+ Новий маневр</Button>
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

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : maneuvers.length === 0 ? (
        <EmptyState title="Маневрів не знайдено" action={<Button to="/maneuvers/new">Створити перший</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {maneuvers.map((m) => <ManeuverCard key={m.id} maneuver={m} />)}
        </div>
      )}

      <Link
        to="/maneuvers/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий маневр"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
