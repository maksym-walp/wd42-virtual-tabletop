import { DURATION_UNITS } from '../constants/abilities';

// Шаблон для POST /api/abilities/import — з коментарями (JSONC), той самий
// прийом, що й у equipmentImportTemplate.js. На відміну від спорядження,
// вміння не мають адміном-налаштовуваних переліків (архетипи/тривалість —
// статичні), тому параметрів функція не приймає.
export function buildAbilitiesImportTemplate() {
  const durationUnitList = Object.entries(DURATION_UNITS).map(([k, v]) => `${k} (${v})`).join(', ');

  return `// Шаблон імпорту вмінь для POST /api/abilities/import.
// Масив об'єктів — кожен є окремим вмінням. Поле "id" ігнорується (нові
// записи отримують власні id), "image_url" завжди стає null — заповнювати
// не потрібно. Власником усіх імпортованих записів стає користувач, що
// робить імпорт.
//
// Поля:
//   name                  — обов'язкове, рядок
//   archetypes            — обов'язкове, масив з: fighter (Бійці), spellcaster (Чаклуни), rogue (Пройдисвіти) — хоча б один
//   mechanical_desc       — рядок або null — що відбувається механічно
//   narrative_desc        — рядок або null — як це виглядає у світі гри
//   is_public             — true / false
//   is_maneuver           — true / false — чи може використовуватись як маневр / дія в бою
//   duration_value        — число або null (має сенс лише коли duration_unit не "instant"/"permanent")
//   duration_unit         — один з: ${durationUnitList}
//   lore_creator          — рядок або null — вільний текст, ім'я лорного автора/винахідника вміння
//   lore_creator_npc_id   — uuid або null — id запису НІПа з бестіарію (compendium), якщо творець
//                           прив'язаний до конкретного НІПа. Не обов'язково: якщо такого id немає
//                           чи він не потрібен, досить самого lore_creator як вільного тексту.
//
[
  {
    "name": "Приклад: Стрімкий випад",
    "archetypes": ["fighter", "rogue"],
    "mechanical_desc": "Різкий випад уперед, що дозволяє атакувати ще раз цього ж ходу.",
    "narrative_desc": null,
    "is_public": true,
    "is_maneuver": true,
    "duration_value": 2,
    "duration_unit": "action",
    "lore_creator": "Майстер клинка Освальд",
    "lore_creator_npc_id": null
  }
]
`;
}
