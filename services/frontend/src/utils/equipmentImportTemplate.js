import { DAMAGE_DICE, ARMOR_WEIGHTS, WEAPON_MODIFIERS } from '../constants/equipment';
import { RARITIES } from '../constants/artifacts';

// Шаблон для POST /api/equipment/import — з коментарями (JSONC), щоб людина
// чи LLM, яка його заповнює, одразу бачила в самому файлі допустимі
// значення полів (типи/особливості зброї підтягуються з поточної
// конфігурації адмінки, а не захардкоджені), замість того щоб шукати їх
// окремо. Коментарі знімає stripJsonComments перед JSON.parse — самі вони
// невалідний JSON.
export function buildEquipmentImportTemplate(weaponTypes, weaponGrips) {
  const listOf = (arr, keyOf = (o) => o.key, labelOf = (o) => o.label) =>
    arr.map((o) => `${keyOf(o)} (${labelOf(o)})`).join(', ');

  const weaponTypeList = weaponTypes.length ? listOf(weaponTypes) : '— наразі не налаштовано в адмінці';
  const weaponGripList = weaponGrips.length ? listOf(weaponGrips) : '— наразі не налаштовано в адмінці';
  const damageDiceList = DAMAGE_DICE.join(', ');
  const armorWeightList = Object.entries(ARMOR_WEIGHTS).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const rarityList = Object.entries(RARITIES).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const modifierList = Object.entries(WEAPON_MODIFIERS).map(([k, v]) => `${k} (${v.label})`).join(', ');

  const exampleWeaponType = weaponTypes[0]?.key || 'melee';
  const exampleWeaponGrip = weaponGrips[0] ? `["${weaponGrips[0].key}"]` : '[]';

  return `// Шаблон імпорту спорядження для POST /api/equipment/import.
// Масив об'єктів — кожен є окремим предметом/зброєю/обладунком/артефактом.
// Поле "id" ігнорується (нові записи отримують власні id), "image_url" і
// "thumbnail_url" завжди стають null — заповнювати їх не потрібно.
// Власником усіх імпортованих записів стає користувач, що робить імпорт.
//
// Спільні поля (усі види):
//   type         — обов'язкове: "item" | "weapon" | "armor" | "artifact" | "potion"
//   name         — обов'язкове, рядок
//   description  — рядок або null
//   is_public    — true / false
//   price        — число або null
//
// Додаткові поля залежно від "type":
//   weapon:   damage_die — один з: ${damageDiceList}
//             weapon_type — один з: ${weaponTypeList}
//             weapon_grip — масив ключів з: ${weaponGripList}
//             modifier — ${modifierList}, або ключ будь-якого навику персонажа
//   armor:    defense_value — число; armor_weight — один з: ${armorWeightList}
//   artifact: creator — рядок; rarity — один з: ${rarityList}
//   potion:   effect — "healing"; potion_tier — "tincture" (d4) | "decoction" (d6) |
//             "balm" (d8) | "elixir" (d10) | "extract" (d12); potion_size — "ampoule" (1 порція) |
//             "tube" (3) | "flask" (6) | "carafe" (10); невідоме значення стає першим у списку
//   item:     додаткових полів немає
//
[
  {
    "type": "weapon",
    "name": "Приклад: Короткий меч",
    "description": "Опис предмета",
    "is_public": true,
    "price": 15,
    "damage_die": "d6",
    "weapon_type": "${exampleWeaponType}",
    "weapon_grip": ${exampleWeaponGrip},
    "modifier": "strength"
  }
]
`;
}

// Шаблон лише для артефактів — той самий ендпоінт і формат, що й вище, але
// приклад і підказки стосуються тільки одного виду. "type": "artifact"
// обов'язкове, бо /import сортує записи за ним і пропускає невідомі.
export function buildArtifactImportTemplate() {
  const rarityList = Object.entries(RARITIES).map(([k, v]) => `${k} (${v.label})`).join(', ');

  return `// Шаблон імпорту артефактів для POST /api/equipment/import.
// Масив об'єктів — кожен є окремим артефактом.
// Поле "id" ігнорується (нові записи отримують власні id), "image_url" і
// "thumbnail_url" завжди стають null — зображення додається після імпорту.
// Власником усіх імпортованих записів стає користувач, що робить імпорт.
//
// Поля:
//   type         — обов'язкове, завжди "artifact"
//   name         — обов'язкове, рядок
//   description  — рядок (HTML з редактора або простий текст) або null
//   creator      — хто створив артефакт, рядок або null
//   rarity       — один з: ${rarityList}; інше значення стане порожнім
//   price        — число або null
//   is_public    — true / false
//
[
  {
    "type": "artifact",
    "name": "Приклад: Клинок долі",
    "description": "Опис артефакту",
    "creator": "Невідомий коваль",
    "rarity": "rare",
    "price": 500,
    "is_public": true
  }
]
`;
}
