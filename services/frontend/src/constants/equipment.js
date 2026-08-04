import { CHARACTERISTICS } from './characterSheet';

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
  weapon:   '/api/equipment/weapons',
  armor:    '/api/equipment/armor',
  item:     '/api/equipment/items',
  artifact: '/api/equipment/artifacts',
};

// Frontend route segment per type — weapon/armor keep their type key as the
// URL segment; "item" is pluralized to "items" for the route only (reads
// better as a listing page), same split as EQUIPMENT_ENDPOINTS above but
// purely a routing concern, not a backend one.
export const EQUIPMENT_TYPE_PATHS = {
  weapon:   'weapon',
  armor:    'armor',
  item:     'items',
  artifact: 'artifacts',
};

export const DAMAGE_DICE = ['d4', 'd6', 'd8', 'd10', 'd12'];

// Типи зброї (weapon_type) та особливості/хват (weapon_grip) більше не
// захардкоджені тут — набір значень редагується з адмін-панелі
// (services/admin) і читається через useWeaponOptions() /
// GET /api/equipment/weapons/options.

// The two most common weapon modifiers get their own shortcut button in the
// form; "Інше" (not a stored value itself) opens a picker over every skill
// below instead. A weapon's `modifier` column ends up holding either
// 'universal' or one of the 20 CHARACTERISTICS skill keys — 'sleight_of_hand'
// and 'strength' included, just reached via the shortcut instead of the picker.
export const WEAPON_MODIFIERS = {
  sleight_of_hand: { label: 'Вправність рук' },
  strength:        { label: 'Сила' },
  universal:       { label: 'Універсальний' },
};

export function weaponModifierLabel(key) {
  if (!key) return null;
  if (WEAPON_MODIFIERS[key]) return WEAPON_MODIFIERS[key].label;
  for (const { skills } of CHARACTERISTICS) {
    const skill = skills.find((s) => s.key === key);
    if (skill) return skill.label;
  }
  return key;
}

export const ARMOR_WEIGHTS = {
  light:  { label: 'Легкий' },
  medium: { label: 'Середній' },
  heavy:  { label: 'Важкий' },
};

// "+ Новий ..." label on the weapon/armor/item catalog tabs (EquipmentCatalog),
// which share one page/component across all three types.
export const EQUIPMENT_NEW_LABELS = {
  weapon: 'Нова зброя',
  armor:  'Новий обладунок',
  item:   'Новий предмет',
};
