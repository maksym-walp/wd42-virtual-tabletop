import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import AbilityCard from '../components/AbilityCard';
import CollectionsRow from '../components/CollectionsRow';
import ScopeFilter from '../components/ScopeFilter';
import { ARCHETYPES, ARCHETYPE_COLORS } from '../constants/characterSheet';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

const ARCHETYPE_TABS = ['fighter', 'spellcaster', 'rogue'];

export default function AbilityCatalog() {
  const [archetype, setArchetype] = useState('');
  const [scope, setScope] = useState('');
  const [abilities, setAbilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (archetype) params.set('archetype', archetype);
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);

    setLoading(true);
    api.get(`/api/abilities/?${params}`)
      .then(({ data }) => setAbilities(data.abilities))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [archetype, search, scope]);

  // Hide collections when a narrowing filter (search or archetype) is active.
  // Scope is excluded — it keeps collections split, not hidden.
  const filtersActive = !!(search || archetype);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Вміння</h1>
          <p className="mt-0.5 text-sm text-text-dim">{abilities.length} вмінь</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/abilities/collections">Колекції</Button>
          <Button to="/abilities/new" className="hidden md:inline-flex">+ Нове вміння</Button>
        </div>
      </div>

      <ScopeFilter scope={scope} onChange={setScope} className="mb-4" />

      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setArchetype('')}
          className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
            archetype === '' ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
          }`}
        >
          Усі
        </button>
        {ARCHETYPE_TABS.map((a) => (
          <button
            key={a}
            onClick={() => setArchetype(a)}
            className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
            style={archetype === a
              ? { borderColor: ARCHETYPE_COLORS[a].color, color: ARCHETYPE_COLORS[a].color, background: ARCHETYPE_COLORS[a].color + '18' }
              : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
          >
            {ARCHETYPES[a].label}
          </button>
        ))}
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

      {!filtersActive && <CollectionsRow domainKey="abilities" scope={scope} />}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : abilities.length === 0 ? (
        <EmptyState title="Вмінь не знайдено" action={<Button to="/abilities/new">Створити перше</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {abilities.map((a) => <AbilityCard key={a.id} ability={a} />)}
        </div>
      )}

      <Link
        to="/abilities/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Нове вміння"
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}
