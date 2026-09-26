import { NATURE_TYPES, SPELL_KINDS, SPELL_COMPLEXITIES, RITUAL_TYPES, DURATION_UNITS, ACTION_OPTIONS, COMPONENT_UNITS } from '../constants/spellbook';

// Шаблон для POST /api/spellbook/import — з коментарями (JSONC), той самий
// прийом, що й у equipmentImportTemplate.js. Заклинання не мають
// адміном-налаштовуваних переліків, тому параметрів функція не приймає.
export function buildSpellbookImportTemplate() {
  const natureList = Object.entries(NATURE_TYPES).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const complexityList = Object.entries(SPELL_COMPLEXITIES).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const spellKindList = Object.entries(SPELL_KINDS).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const ritualList = Object.entries(RITUAL_TYPES).map(([k, v]) => `${k} (${v.label})`).join(', ');
  const durationUnitList = Object.entries(DURATION_UNITS).map(([k, v]) => `${k} (${v})`).join(', ');
  const actionTimeList = ACTION_OPTIONS.map((o) => o.value).join(', ');
  const unitList = COMPONENT_UNITS.join(', ');

  return `// Шаблон імпорту заклинань для POST /api/spellbook/import.
// Масив об'єктів — кожен є окремим заклинанням. Поле "id" ігнорується (нові
// записи отримують власні id), "image_url" завжди стає null — заповнювати
// не потрібно. Власником усіх імпортованих записів стає користувач, що
// робить імпорт.
//
// Поля:
//   name                  — обов'язкове, рядок
//   nature                — масив з: ${natureList}
//   spell_kind            — один з: ${spellKindList}
//   complexity            — один з: ${complexityList}, або null
//   mechanical_desc       — рядок або null — що відбувається механічно
//   narrative_desc        — рядок або null — як це виглядає у світі гри
//   lore_creator          — рядок або null — вільний текст, ім'я лорного автора заклинання
//   lore_creator_npc_id   — uuid або null — id запису НІПа з бестіарію (compendium), якщо творець
//                           прив'язаний до конкретного НІПа. Не обов'язково: якщо такого id немає
//                           чи він не потрібен, досить самого lore_creator як вільного тексту.
//   energy_cost           — число (магічна енергія)
//   action_time           — одне з: ${actionTimeList}
//   ritual                — один з: ${ritualList}
//   duration_value        — число або null (має сенс лише коли duration_unit не "instant"/"permanent")
//   duration_unit         — один з: ${durationUnitList}
//   range_desc            — рядок або null, напр. "Дотик", "10 метрів", "Себе"
//   components            — масив об'єктів { item_id, name, quantity, unit }:
//                             item_id  — uuid предмета спорядження або null
//                             name     — рядок, обов'язково
//                             quantity — число
//                             unit     — рядок, напр. одна з: ${unitList} (або довільна своя)
//   is_public             — true / false
//   levels                — масив рівнів 2..N (хронологічні версії; поля вище — це рівень 1).
//                           Кожен рівень — об'єкт з тими самими полями: complexity, spell_kind,
//                           energy_cost, action_time, ritual, duration_value, duration_unit,
//                           range_desc, components, mechanical_desc, narrative_desc,
//                           lore_creator, lore_creator_npc_id. Порожній масив — лише один рівень.
//
[
  {
    "name": "Приклад: Вогняна стріла",
    "nature": ["elemental"],
    "spell_kind": "ranged",
    "complexity": "simple",
    "mechanical_desc": "Заклинач кидає d8 вогняної шкоди по цілі в межах дальності.",
    "narrative_desc": "Невеличка стріла полум'я зривається з пальців чаклуна.",
    "lore_creator": "Архімаг Ельдран Сірий",
    "lore_creator_npc_id": null,
    "energy_cost": 3,
    "action_time": 1,
    "ritual": "impossible",
    "duration_value": null,
    "duration_unit": "instant",
    "range_desc": "10 метрів",
    "components": [
      { "item_id": null, "name": "Дрібка сірки", "quantity": 1, "unit": "щіпки" }
    ],
    "is_public": true,
    "levels": [
      {
        "complexity": "medium",
        "spell_kind": "ranged",
        "energy_cost": 5,
        "action_time": 2,
        "ritual": "impossible",
        "duration_value": null,
        "duration_unit": "instant",
        "range_desc": "20 метрів",
        "components": [],
        "mechanical_desc": "Заклинач кидає 2d8 вогняної шкоди по цілі в межах дальності.",
        "narrative_desc": "Стріла розгоряється до сліпучо-білого полум'я.",
        "lore_creator": "Архімаг Ельдран Сірий",
        "lore_creator_npc_id": null
      }
    ]
  }
]
`;
}
