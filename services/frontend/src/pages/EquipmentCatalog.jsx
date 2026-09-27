import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import EquipmentCard from '../components/EquipmentCard';
import CatalogTabs from '../components/CatalogTabs';
import ExportImportActions from '../components/ExportImportActions';
import { getDomainTabs } from '../collectionsDomains';
import ScopeFilter from '../components/ScopeFilter';
import { EQUIPMENT_ENDPOINTS, EQUIPMENT_NEW_LABELS, WEAPON_MODIFIERS, DAMAGE_DICE, weaponModifierLabel, ARMOR_WEIGHTS } from '../constants/equipment';
import useWeaponOptions from '../hooks/useWeaponOptions';
import { downloadJsonFile } from '../utils/downloadJson';
import { buildEquipmentImportTemplate } from '../utils/equipmentImportTemplate';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import DataTable from '../components/ui/DataTable';
import useViewMode from '../hooks/useViewMode';
import useHoverPreview from '../hooks/useHoverPreview';
import CatalogLayout, {
  SidebarSection, SidebarActions, SidebarSearch, SidebarViewCount, SidebarFilters, MobileFab, CATALOG_GRID,
} from '../components/catalog/CatalogLayout';
import SortSelect from '../components/catalog/SortSelect';
import { CatalogPreview, EquipmentPreview } from '../components/catalog/previews';

// Each equipment type (weapon/armor/item) is now its own catalog page/route
// (/equipment/weapon, /equipment/armor, /equipment/items — see App.jsx and
// collectionsDomains.js's equipment.tabs), switched via the shared
// CatalogTabs bar instead of an in-page tab — same pattern compendium uses
// for НІПи/Бестіарій/Види. `type` picks which type-table this instance reads.
export default function EquipmentCatalog({ type }) {
  const { weaponTypes, weaponGrips, weaponTypesMap, weaponGripsMap } = useWeaponOptions();
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
  const [hovered, bindPreview, setHovered] = useHoverPreview();

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

  const fetchItems = useCallback(() => {
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
    return api.get(`${EQUIPMENT_ENDPOINTS[type]}/?${params}`)
      .then(({ data }) => setItems(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [type, search, sort, dir, scope, weaponType, modifier, damageDie, weaponGrip]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleSort = (key) => {
    if (sort === key) { setDir((d) => (d === 'asc' ? 'desc' : 'asc')); }
    else { setSort(key); setDir('asc'); }
  };

  // /export читає наскрізь усі чотири таблиці спорядження (сама union-модель
  // не знає per-kind фільтрів на кшталт weapon_type) — лишаємо тут той самий
  // search/scope/sort/dir, що й у звичайному списку, і додатково відсікаємо
  // на клієнті все, що не належить виду поточної вкладки каталогу.
  const handleExport = async () => {
    const params = new URLSearchParams({ sort, dir });
    if (search) params.set('search', search);
    if (scope) params.set('scope', scope);

    try {
      const { data } = await api.get(`/api/equipment/export?${params}`);
      downloadJsonFile(data.filter((row) => row.type === type), 'equipment_export.json');
    } catch {
      alert('Не вдалося експортувати предмети');
    }
  };

  const handleTemplate = () => buildEquipmentImportTemplate(weaponTypes, weaponGrips);

  const handleImport = async (data) => {
    if (!Array.isArray(data)) {
      alert('Файл має містити масив предметів');
      return;
    }
    try {
      const { data: result } = await api.post('/api/equipment/import', data);
      alert(`Імпортовано записів: ${result.imported}`);
      fetchItems();
    } catch (err) {
      alert(err.response?.data?.message || 'Не вдалося імпортувати предмети');
    }
  };

  const showCards = view === 'cards';
  const activeFilterCount = (type === 'weapon' ? [weaponType, modifier, damageDie, weaponGrip].filter(Boolean).length : 0);
  const newHref = `/equipment/new?type=${type}`;
  const newLabel = EQUIPMENT_NEW_LABELS[type] || 'Новий предмет';

  const columns = [
    { key: 'name', label: 'Назва', sortKey: 'name', render: (item) => item.name },
    ...(type === 'weapon' ? [
      { key: 'weapon_type', label: 'Тип', render: (item) => weaponTypesMap[item.weapon_type]?.label ?? item.weapon_type ?? '—' },
      {
        key: 'weapon_grip', label: 'Особливості',
        render: (item) => (item.weapon_grip?.length
          ? item.weapon_grip.map((g) => weaponGripsMap[g]?.label ?? g).join(', ')
          : '—'),
      },
      { key: 'modifier', label: 'Модифікатор', render: (item) => weaponModifierLabel(item.modifier) ?? '—' },
      { key: 'damage_die', label: 'Кубик шкоди', sortKey: 'damage_die', render: (item) => item.damage_die ?? '—' },
    ] : []),
    ...(type === 'armor' ? [
      { key: 'armor_weight', label: 'Вага', render: (item) => ARMOR_WEIGHTS[item.armor_weight]?.label ?? '—' },
      { key: 'defense_value', label: 'Захист', sortKey: 'defense_value', render: (item) => item.defense_value ?? '—' },
    ] : []),
    { key: 'price', label: 'Ціна', sortKey: 'price', render: (item) => item.price ?? '—' },
  ];

  // Ті самі ключі, що й клік по заголовку таблиці (колонки з sortKey).
  const sortOptions = columns.filter((c) => c.sortKey).map((c) => ({ value: c.sortKey, label: c.label }));

  const sidebar = (
    <>
      <CatalogTabs sidebar tabs={getDomainTabs('equipment')} />

      <SidebarActions newHref={newHref} newLabel={newLabel}>
        <ExportImportActions onExport={handleExport} onImport={handleImport} onTemplate={handleTemplate} />
      </SidebarActions>

      <SidebarSearch value={search} onChange={setSearch} />

      <SidebarViewCount view={view} onViewChange={setView} count={items.length} forms={['запис', 'записи', 'записів']} />

      <SidebarSection label="Джерело">
        <ScopeFilter scope={scope} onChange={setScope} />
      </SidebarSection>

      <SortSelect options={sortOptions} value={sort} onChange={setSort} dir={dir} onDirChange={setDir} />

      {type === 'weapon' && (
        <SidebarFilters open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} activeCount={activeFilterCount}>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">Тип зброї</span>
            <select className={inputClass} value={weaponType} onChange={(e) => setWeaponType(e.target.value)}>
              <option value="">Усі типи</option>
              {weaponTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
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
              {weaponGrips.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
          </div>
        </SidebarFilters>
      )}
    </>
  );

  return (
    <CatalogLayout
      sidebar={sidebar}
      preview={<CatalogPreview item={hovered}>{hovered && <EquipmentPreview item={{ ...hovered, type: hovered.type ?? type }} />}</CatalogPreview>}
    >
      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : items.length === 0 ? (
        <EmptyState title="Предметів не знайдено" action={<Button to={newHref}>Створити перший</Button>} />
      ) : showCards ? (
        <div className={CATALOG_GRID}>
          {items.map((item) => <EquipmentCard key={item.id} item={item} {...bindPreview(item)} />)}
        </div>
      ) : (
        <DataTable
          items={items} columns={columns}
          getKey={(item) => item.id} getHref={(item) => `/equipment/${item.id}`}
          sort={sort} dir={dir} onSort={toggleSort} onRowHover={setHovered}
        />
      )}

      <MobileFab to={newHref} label={newLabel} />
    </CatalogLayout>
  );
}
