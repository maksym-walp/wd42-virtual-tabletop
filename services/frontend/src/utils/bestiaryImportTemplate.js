import { HEALTH_DICE } from '../constants/compendium';

// Шаблон для POST /api/bestiary/creatures/import — з коментарями (JSONC). Формат — як у
// експорту колекції істот.
export function buildBestiaryImportTemplate() {
  return `// Шаблон імпорту істот для POST /api/bestiary/creatures/import (лише майстер гри чи адмін).
// Масив об'єктів — кожен є окремою істотою. Поле "id" ігнорується (нові записи
// отримують власні id), "image_url" завжди стає null. Власником усіх
// імпортованих записів стає користувач, що робить імпорт. Посилання на
// довідники іншого деплою (species_id, subspecies_id, race_id, people_id)
// скидаються — їх можна задати вже в редакторі істоти. Спорядження, вміння та
// заклинання істоти не імпортуються.
//
// Поля:
//   name                — обов'язкове, рядок
//   description         — рядок або null
//   history             — рядок або null
//   dexterity, body, intelligence, wisdom, charisma
//                       — обов'язкові, цілі від 1 до 6 (спритність, статура, інтелект, мудрість, харизма)
//   health_die_override — один з: ${HEALTH_DICE.join(', ')}, або null (кістка здоров'я за видом)
//   is_public           — true / false
//
[
  {
    "name": "Приклад: Вовк-вожак",
    "description": "Великий сірий вовк із пошматованим вухом.",
    "history": "Очолює зграю, що полює на східному тракті.",
    "dexterity": 4,
    "body": 3,
    "intelligence": 2,
    "wisdom": 4,
    "charisma": 2,
    "health_die_override": null,
    "is_public": false
  }
]
`;
}
