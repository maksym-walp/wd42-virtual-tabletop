// Artifacts are their own catalog/service — see constants/artifacts.js.
// No per-type accent color — a type is just a label here, not a hue to
// differentiate by (that's reserved for archetype badges, which do map to
// one specific archetype).
export const EQUIPMENT_TYPES = {
  weapon:   { label: 'Зброя' },
  armor:    { label: 'Обладунок' },
  item:     { label: 'Предмет' },
};

// Кожен вид спорядження — окрема таблиця й окремий ендпоінт
// (39-equipment-split-tables.sql). Запис завжди йде на ендпоінт виду; корінь
// /api/equipment/ лишається спільним читальним зрізом по всіх трьох, бо там,
// де вид наперед невідомий (перехід за голим id, пікери в листі персонажа й
// у заклинаннях), питати треба одразу всі.
export const EQUIPMENT_ENDPOINTS = {
  weapon: '/api/equipment/weapons',
  armor:  '/api/equipment/armor',
  item:   '/api/equipment/items',
};

// Frontend route segment per type — weapon/armor keep their type key as the
// URL segment; "item" is pluralized to "items" for the route only (reads
// better as a listing page), same split as EQUIPMENT_ENDPOINTS above but
// purely a routing concern, not a backend one.
export const EQUIPMENT_TYPE_PATHS = {
  weapon: 'weapon',
  armor:  'armor',
  item:   'items',
};

export const DAMAGE_DICE = ['d4', 'd6', 'd8', 'd10', 'd12'];

export const WEAPON_TYPES = {
  melee:     { label: 'Ближня' },
  ranged:    { label: 'Дальньобійна' },
  thrown:    { label: 'Метальна' },
  universal: { label: 'Універсальна' },
};

export const WEAPON_GRIPS = {
  one_handed: { label: 'Одноручна' },
  two_handed: { label: 'Дворучна' },
  versatile:  { label: 'Універсальна' },
  other:      { label: 'Інше' },
};

export const ARMOR_WEIGHTS = {
  light:  { label: 'Легкий' },
  medium: { label: 'Середній' },
  heavy:  { label: 'Важкий' },
};
