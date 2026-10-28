import { downloadJsonFile } from './downloadJson';

// Шаблони для імпорту сузір'їв і колод — з коментарями (JSONC), як і шаблон
// спорядження: коментарі знімає parseJsonWithComments перед JSON.parse.

export function buildConstellationImportTemplate() {
  return `// Шаблон імпорту сузір'я для POST /api/tools/constellations/import.
// Це або один об'єкт, або масив таких об'єктів (до 50). Поле "type"
// необов'язкове, але якщо задане — має бути "constellation".
// Імпортоване сузір'я завжди стає приватним, власником — той, хто імпортує.
//
// Поля сузір'я:
//   name         — обов'язкове, рядок до 200 символів
//   description  — рядок до 5000 символів або null
//   gm_notes     — приватні нотатки майстра (до 10000 символів) або null
//   data.stars   — масив зірок (до 200):
//       id          — унікальний рядок у межах сузір'я (на нього посилаються лінії)
//       x, y        — координати на полотні, числа (приблизно від -500 до 500)
//       size        — рівень зірки: 1, 2 або 3
//       name        — назва зірки, до 100 символів
//       description — опис зірки, до 2000 символів
//   data.lines   — масив ліній (до 500): "a" і "b" — id двох різних зірок
//
{
  "type": "constellation",
  "name": "Приклад: Дракон",
  "description": "Сузір'я, що вказує шлях на північ",
  "gm_notes": "Око дракона — ключ до гробниці; гравці про це не знають",
  "data": {
    "stars": [
      { "id": "s1", "x": -80, "y": 20, "size": 3, "name": "Расабан", "description": "Око дракона" },
      { "id": "s2", "x": 0, "y": -30, "size": 2, "name": "Етамін", "description": "" },
      { "id": "s3", "x": 90, "y": 40, "size": 1, "name": "Альтаїс", "description": "" }
    ],
    "lines": [
      { "a": "s1", "b": "s2" },
      { "a": "s2", "b": "s3" }
    ]
  }
}
`;
}

export function buildDeckImportTemplate() {
  return `// Шаблон імпорту колоди карт для POST /api/tools/decks/import.
// Це або один об'єкт, або масив таких об'єктів (до 50). Поле "type"
// необов'язкове, але якщо задане — має бути "deck".
// Імпортована колода завжди стає приватною, власником — той, хто імпортує.
//
// Поля колоди:
//   name            — обов'язкове, рядок до 200 символів
//   description     — рядок до 5000 символів або null
//   back_image_url  — зворот колоди: "/uploads/..." або "https://..." чи null
//   data.suits      — масті (до 12): id (унікальний рядок), name, image_url (чи null).
//                     image_url масті стає сорочкою всіх карт цієї масті
//   data.ranks      — номінали (до 60): id (унікальний рядок), name
//   data.cards      — карти (до 200):
//       id          — унікальний рядок
//       suit_id     — id масті або null (карта без масті, наприклад старший аркан)
//       rank_id     — id номіналу або null
//       name        — до 150 символів. Обов'язкове, якщо немає suit_id або rank_id;
//                     коли є і масть, і номінал — можна "" (назва буде «номінал · масть»)
//       description — опис карти, до 2000 символів (необов'язковий)
//       effect      — ефект карти, до 2000 символів (необов'язковий)
//       interpretation — трактування карти, до 2000 символів (необов'язкове)
//       image_url   — лице карти: "/uploads/..." або "https://..." чи null
//
{
  "type": "deck",
  "name": "Приклад: Міні-таро",
  "description": "Дві масті по два номінали та один старший аркан",
  "back_image_url": null,
  "data": {
    "suits": [
      { "id": "cups", "name": "Кубки", "image_url": null },
      { "id": "swords", "name": "Мечі", "image_url": null }
    ],
    "ranks": [
      { "id": "ace", "name": "Туз" },
      { "id": "two", "name": "Двійка" }
    ],
    "cards": [
      { "id": "c1", "suit_id": "cups", "rank_id": "ace", "name": "Туз Кубків", "description": "Початок почуттів", "effect": "Добери одну карту", "interpretation": "Нова любов чи дружба", "image_url": null },
      { "id": "c2", "suit_id": "cups", "rank_id": "two", "name": "", "description": "", "image_url": null },
      { "id": "c3", "suit_id": "swords", "rank_id": "ace", "name": "", "description": "", "image_url": null },
      { "id": "c4", "suit_id": "swords", "rank_id": "two", "name": "", "description": "", "image_url": null },
      { "id": "c5", "suit_id": null, "rank_id": null, "name": "Шут", "description": "Нова дорога", "image_url": null }
    ]
  }
}
`;
}

// Імпорт з ExportImportActions: приймає розпарсений JSON, показує підсумок.
export async function runImport(api, data, { onDone, noun }) {
  if (data === null || typeof data !== 'object') {
    alert(`Файл має містити ${noun} або масив ${noun}`);
    return;
  }
  try {
    const result = await api.importMany(data);
    alert(`Імпортовано: ${result.imported}`);
    onDone?.(result);
  } catch (err) {
    alert(err.response?.data?.message || 'Не вдалося імпортувати');
  }
}

export async function exportOne(api, id, filename) {
  try {
    downloadJsonFile(await api.exportOne(id), filename);
  } catch {
    alert('Не вдалося експортувати');
  }
}
