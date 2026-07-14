import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, LayoutGrid, Table2 } from 'lucide-react';
import api from '../api/client';
import EquipmentCard from '../components/EquipmentCard';
import CollectionsRow from '../components/CollectionsRow';
import { EQUIPMENT_TYPES, WEAPON_TYPES, WEAPON_GRIPS, ARMOR_WEIGHTS, RARITIES } from '../constants/equipment';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';

const TYPE_TABS = ['weapon', 'armor', 'artifact', 'item'];

export default function EquipmentCatalog() {
  const [type, setType]     = useState('weapon');
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState('name');
  const [dir, setDir]       = useState('asc');
  const [view, setView]     = useState('table'); // table | cards

  useEffect(() => {
    const params = new URLSearchParams({ type, sort, dir });
    if (search) params.set('search', search);

    setLoading(true);
    api.get(`/api/equipment/?${params}`)
      .then(({ data }) => setItems(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [type, search, sort, dir]);

  const changeType = (t) => {
    setType(t);
    setSort('name');
    setDir('asc');
  };

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  const showCards = view === 'cards';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-accent sm:text-3xl">Спорядження</h1>
          <p className="mt-0.5 text-sm text-text-dim">{items.length} предметів</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" to="/equipment/collections">Колекції</Button>
          <Button to="/equipment/new" className="hidden md:inline-flex">+ Новий предмет</Button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {TYPE_TABS.map((t) => (
            <button
              key={t}
              onClick={() => changeType(t)}
              className="rounded border px-3 py-1.5 text-sm font-semibold transition-colors"
              style={type === t
                ? { borderColor: EQUIPMENT_TYPES[t].color, color: EQUIPMENT_TYPES[t].color, background: EQUIPMENT_TYPES[t].color + '18' }
                : { borderColor: 'var(--color-border)', color: 'var(--color-text-dim)' }}
            >
              {EQUIPMENT_TYPES[t].label}
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

      <CollectionsRow domainKey="equipment" />

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : items.length === 0 ? (
        <EmptyState title="Предметів не знайдено" action={<Button to="/equipment/new">Створити перший</Button>} />
      ) : showCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <EquipmentCard key={item.id} item={item} />)}
        </div>
      ) : (
        <EquipmentTable type={type} items={items} sort={sort} dir={dir} onSort={toggleSort} />
      )}

      <Link
        to="/equipment/new"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label="Новий предмет"
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

function EquipmentTable({ type, items, sort, dir, onSort }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <Th label="Назва" sortKey="name" sort={sort} dir={dir} onSort={onSort} />
            {type === 'weapon' && (
              <>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Тип</th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Особливості</th>
                <Th label="Кубик шкоди" sortKey="damage_die" sort={sort} dir={dir} onSort={onSort} />
              </>
            )}
            {type === 'armor' && (
              <>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Вага</th>
                <Th label="Захист" sortKey="defense_value" sort={sort} dir={dir} onSort={onSort} />
              </>
            )}
            {type === 'artifact' && (
              <>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Творець</th>
                <th className="border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">Рідкість</th>
              </>
            )}
            <Th label="Ціна" sortKey="price" sort={sort} dir={dir} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-surface-hover">
              <td className="border-b border-bg px-3 py-2">
                <Link to={`/equipment/${item.id}`} className="text-accent hover:underline">{item.name}</Link>
                {item.is_public && <span className="ml-1.5 text-[0.65rem] italic text-text-dim">публічне</span>}
              </td>
              {type === 'weapon' && (
                <>
                  <td className="border-b border-bg px-3 py-2 text-text-muted">{WEAPON_TYPES[item.weapon_type]?.label ?? '—'}</td>
                  <td className="border-b border-bg px-3 py-2 text-text-muted">{WEAPON_GRIPS[item.weapon_grip]?.label ?? '—'}</td>
                  <td className="border-b border-bg px-3 py-2 text-text-muted">{item.damage_die ?? '—'}</td>
                </>
              )}
              {type === 'armor' && (
                <>
                  <td className="border-b border-bg px-3 py-2 text-text-muted">{ARMOR_WEIGHTS[item.armor_weight]?.label ?? '—'}</td>
                  <td className="border-b border-bg px-3 py-2 text-text-muted">{item.defense_value ?? '—'}</td>
                </>
              )}
              {type === 'artifact' && (
                <>
                  <td className="border-b border-bg px-3 py-2 text-text-muted">{item.creator ?? '—'}</td>
                  <td className="border-b border-bg px-3 py-2">
                    {item.rarity
                      ? <span style={{ color: RARITIES[item.rarity]?.color }}>{RARITIES[item.rarity]?.label}</span>
                      : <span className="text-text-muted">—</span>}
                  </td>
                </>
              )}
              <td className="border-b border-bg px-3 py-2 text-text-muted">{item.price ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
