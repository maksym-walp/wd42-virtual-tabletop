import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import api from '../api/client';
import EquipmentCard from '../components/EquipmentCard';
import CatalogTabs from '../components/CatalogTabs';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { EQUIPMENT_ENDPOINTS, EQUIPMENT_NEW_LABELS, WEAPON_TYPES, WEAPON_GRIPS, WEAPON_MODIFIERS, DAMAGE_DICE, weaponModifierLabel, ARMOR_WEIGHTS } from '../constants/equipment';
import { pluralizeUk } from '../utils/pluralize';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import FilterAccordion from '../components/ui/FilterAccordion';
import FilterToggleButton from '../components/ui/FilterToggleButton';
import EmptyState from '../components/ui/EmptyState';
import ViewToggle from '../components/ui/ViewToggle';
import DataTable from '../components/ui/DataTable';
import useViewMode from '../hooks/useViewMode';

// Each equipment type (weapon/armor/item) is now its own catalog page/route
// (/equipment/weapon, /equipment/armor, /equipment/items — see App.jsx and
// collectionsDomains.js's equipment.tabs), switched via the shared
// CatalogTabs bar instead of an in-page tab — same pattern compendium uses
// for НІПи/Бестіарій/Види. `type` picks which type-table this instance reads.
export default function EquipmentCatalog({ type }) {
  const [scope, setScope]   = useState('');
  const [weaponType, setWeaponType] = useState('');
  const [modifier, setModifier] = useState('');
  const [damageDie, setDamageDie] = useState('');
  const [weaponGrip, setWeaponGrip] = useState('');
  const [items, setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState('name');
  const [dir, setDir]       = useState('asc');
  const [view, setView]     = useViewMode('equipment'); // table | cards
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Скидаємо сортування й специфічні для зброї фільтри щоразу, як заходимо на
  // інший тип — ключі сортування (наприклад "defense_value") не всі спільні
  // між таблицями, а модифікатор/тип/кубик шкоди/особливості існують лише в зброї.
  useEffect(() => {
    setSort('name');
    setDir('asc');
    setWeaponType('');
    setModifier('');
    setDamageDie('');
    setWeaponGrip('');
  }, [type]);

  useEffect(() => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);
    if (type === 'weapon') {
      if (weaponType) params.set('weapon_type', weaponType);
      if (modifier) params.set('modifier', modifier);
      if (damageDie) params.set('damage_die', damageDie);
      if (weaponGrip) params.set('weapon_grip', weaponGrip);
    }

    setLoading(true);
    api.get(`${EQUIPMENT_ENDPOINTS[type]}/?${params}`)
      .then(({ data }) => setItems(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [type, search, sort, dir, scope, weaponType, modifier, damageDie, weaponGrip]);

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  const showCards = view === 'cards';
  const activeFilterCount = (scope ? 1 : 0) + (type === 'weapon' ? [weaponType, modifier, damageDie, weaponGrip].filter(Boolean).length : 0);
  const newHref = `/equipment/new?type=${type}`;
  const newLabel = EQUIPMENT_NEW_LABELS[type] || 'Новий предмет';

  const columns = [
    { key: 'name', label: 'Назва', sortKey: 'name', render: (item) => item.name },
    ...(type === 'weapon' ? [
      { key: 'weapon_type', label: 'Тип', render: (item) => WEAPON_TYPES[item.weapon_type]?.label ?? '—' },
      { key: 'weapon_grip', label: 'Особливості', render: (item) => WEAPON_GRIPS[item.weapon_grip]?.label ?? '—' },
      { key: 'modifier', label: 'Модифікатор', render: (item) => weaponModifierLabel(item.modifier) ?? '—' },
      { key: 'damage_die', label: 'Кубик шкоди', sortKey: 'damage_die', render: (item) => item.damage_die ?? '—' },
    ] : []),
    ...(type === 'armor' ? [
      { key: 'armor_weight', label: 'Вага', render: (item) => ARMOR_WEIGHTS[item.armor_weight]?.label ?? '—' },
      { key: 'defense_value', label: 'Захист', sortKey: 'defense_value', render: (item) => item.defense_value ?? '—' },
    ] : []),
    { key: 'price', label: 'Ціна', sortKey: 'price', render: (item) => item.price ?? '—' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <CatalogTabs tabs={getDomainTabs('equipment')} />

      <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="col-start-1">
          <ViewToggle mode={view} onChange={setView} />
        </div>
        <p className="col-start-2 hidden justify-self-center text-sm text-text-dim sm:block">
          {items.length} {pluralizeUk(items.length, ['запис', 'записи', 'записів'])}
        </p>
        <Button to={newHref} className="col-start-3 hidden justify-self-end whitespace-nowrap md:inline-flex">+ {newLabel}</Button>
      </div>

      <div className="mb-3 flex gap-2.5">
        <div className="relative flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className={`${inputClass} pl-10`}
            placeholder="Пошук за назвою..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <FilterToggleButton open={filtersOpen} onClick={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount} />
      </div>

      <FilterAccordion open={filtersOpen}>
        <div className="flex flex-col gap-4">
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Джерело</span>
            <ScopeFilter scope={scope} onChange={setScope} />
          </div>
          {type === 'weapon' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Тип зброї</span>
                <select className={inputClass} value={weaponType} onChange={(e) => setWeaponType(e.target.value)}>
                  <option value="">Усі типи</option>
                  {Object.entries(WEAPON_TYPES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Модифікатор</span>
                <select className={inputClass} value={modifier} onChange={(e) => setModifier(e.target.value)}>
                  <option value="">Усі модифікатори</option>
                  {Object.entries(WEAPON_MODIFIERS).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Кубик шкоди</span>
                <select className={inputClass} value={damageDie} onChange={(e) => setDamageDie(e.target.value)}>
                  <option value="">Усі кубики</option>
                  {DAMAGE_DICE.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Особливості</span>
                <select className={inputClass} value={weaponGrip} onChange={(e) => setWeaponGrip(e.target.value)}>
                  <option value="">Усі особливості</option>
                  {Object.entries(WEAPON_GRIPS).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </FilterAccordion>

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : items.length === 0 ? (
        <EmptyState title="Предметів не знайдено" action={<Button to={newHref}>Створити перший</Button>} />
      ) : showCards ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => <EquipmentCard key={item.id} item={item} />)}
        </div>
      ) : (
        <DataTable
          items={items} columns={columns}
          getKey={(item) => item.id} getHref={(item) => `/equipment/${item.id}`}
          sort={sort} dir={dir} onSort={toggleSort}
        />
      )}

      <Link
        to={newHref}
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:hidden"
        aria-label={newLabel}
      >
        <Plus size={26} />
      </Link>
    </div>
  );
}

