// Шаблони імпорту для компендіуму (POST /api/compendium/.../import) — JSONC
// (з коментарями), той самий прийом, що й у locationImportTemplate.js. Усі
// чотири сутності лежать в одному файлі: вони дуже прості й тісно пов'язані
// (species/race — верхній рівень, subspecies/peoples — їхні підкатегорії).

export function buildSpeciesImportTemplate() {
  return `// Шаблон імпорту видів для POST /api/compendium/species/import.
// Масив об'єктів — кожен є окремим видом. Поле "id" ігнорується. Записи без
// "name" пропускаються.
//
// Поля:
//   name        — обов'язкове, рядок
//   description — рядок або null
//   health_die  — один з: d4, d6, d8, d10, d12, d20 (інакше — d6)
//   is_public   — true / false
[
  {
    "name": "Приклад: Ваморіанці",
    "description": "Рослиноподібний народ, що живиться світлом.",
    "health_die": "d8",
    "is_public": true
  }
]
`;
}

export function buildRaceImportTemplate() {
  return `// Шаблон імпорту рас для POST /api/compendium/races/import.
// Масив об'єктів — кожен є окремою расою. Поле "id" ігнорується, "image_url"
// завжди стає null (зображення з чужого експорту тут не лежать на диску).
// Записи без "name" пропускаються.
//
// Поля:
//   name        — обов'язкове, рядок
//   description — рядок або null
//   is_public   — true / false
[
  {
    "name": "Приклад: Нащадки Старого Легіону",
    "description": "Люди, чиї предки заснували Віранту.",
    "is_public": true
  }
]
`;
}

// species — { id, name } цього виду: записи імпортуються прямо в нього
// (species_id не поле запису — воно фіксоване параметром запиту).
export function buildSubspeciesImportTemplate(species) {
  return `// Шаблон імпорту підвидів для POST /api/compendium/subspecies/import?species_id=${species?.id ?? '<id>'}.
// Усі записи потраплять у вид «${species?.name ?? '?'}» — поля species_id у
// записах немає, бо він фіксований цим викликом. Поле "id" ігнорується.
// Записи без "name" пропускаються.
//
// Поля:
//   name        — обов'язкове, рядок
//   description — рядок або null
//   health_die  — один з: d4, d6, d8, d10, d12, d20 (інакше — d6)
//   is_public   — true / false
[
  {
    "name": "Приклад: Світлі ваморіанці",
    "description": "Підвид, що живе на відкритих рівнинах.",
    "health_die": "d8",
    "is_public": true
  }
]
`;
}

// race — { id, name } цієї раси: записи імпортуються прямо в неї (race_id
// не поле запису — воно фіксоване параметром запиту).
export function buildPeopleImportTemplate(race) {
  return `// Шаблон імпорту народів для POST /api/compendium/peoples/import?race_id=${race?.id ?? '<id>'}.
// Усі записи потраплять у расу «${race?.name ?? '?'}» — поля race_id у
// записах немає, бо він фіксований цим викликом. Поле "id" ігнорується.
// Записи без "name" пропускаються.
//
// Поля:
//   name        — обов'язкове, рядок
//   description — рядок або null
//   origin      — рядок (звідки походить народ) або null
//   is_public   — true / false
[
  {
    "name": "Приклад: Віранські нащадки",
    "description": "Ті, хто лишився в руїнах після падіння столиці.",
    "origin": "Віранта",
    "is_public": true
  }
]
`;
}
