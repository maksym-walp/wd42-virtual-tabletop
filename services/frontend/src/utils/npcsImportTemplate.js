import { HEALTH_DICE } from '../constants/compendium';

// Шаблон для POST /api/npcs/npcs/import — з коментарями (JSONC), той самий прийом,
// що й в abilitiesImportTemplate.js. Формат — як у експорту колекції НІПів.
export function buildNpcsImportTemplate() {
  return `// Шаблон імпорту НІПів для POST /api/npcs/npcs/import (лише майстер гри чи адмін).
// Масив об'єктів — кожен є окремим НІПом. Поле "id" ігнорується (нові записи
// отримують власні id), "image_url" завжди стає null. Власником усіх
// імпортованих записів стає користувач, що робить імпорт. Посилання на
// довідники іншого деплою (species_id, subspecies_id, race_id, people_id) і
// дати народження/смерті з календарями скидаються — їх можна задати вже в
// редакторі НІПа. Спорядження, стосунки та фракції НІПа не імпортуються.
//
// Поля:
//   name                — обов'язкове, рядок
//   description         — рядок або null
//   motivation          — рядок або null
//   backstory           — рядок або null
//   private_notes       — рядок або null — нотатки, видимі лише автору й майстрам
//   gender              — один з: male (чоловіча), female (жіноча), other (інша), unspecified (не вказано), або null
//   age                 — ціле невід'ємне число або null
//   dexterity, body, intelligence, wisdom, charisma
//                       — обов'язкові, цілі від 1 до 6 (спритність, статура, інтелект, мудрість, харизма)
//   health_die_override — один з: ${HEALTH_DICE.join(', ')}, або null (кістка здоров'я за видом)
//   is_public           — true / false
//
[
  {
    "name": "Приклад: Старий Том",
    "description": "Сивий корчмар із шрамом через ліве око.",
    "motivation": "Вберегти свою корчму від боргів.",
    "backstory": "Колись служив найманцем у північних війнах.",
    "private_notes": null,
    "gender": "male",
    "age": 61,
    "dexterity": 2,
    "body": 4,
    "intelligence": 3,
    "wisdom": 4,
    "charisma": 3,
    "health_die_override": null,
    "is_public": true
  }
]
`;
}
