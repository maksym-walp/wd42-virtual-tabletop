// Шаблон імпорту колекції (POST /api/<сервіс>/collections/import) — JSONC, як
// і шаблони імпорту записів. Описи полів вкладених записів не дублюються:
// беруться з готового шаблону імпорту записів цього ж каталогу
// (recordTemplate — його текст), тож при зміні полів записів колекція
// отримує оновлений опис автоматично.
//
// recordTemplate має вигляд: рядки-коментарі (`//`), де розділ полів
// починається рядком «// Поля…» / «// Спільні поля…», далі — JSON-масив.
function splitRecordTemplate(text) {
  const lines = text.split('\n');
  const jsonStart = lines.findIndex((l) => l.trim() !== '' && !l.startsWith('//'));
  const comment = lines.slice(0, jsonStart);
  const fieldsAt = comment.findIndex((l) => /^\/\/ (Спільні )?[Пп]оля/.test(l));
  const fieldDocs = comment.slice(fieldsAt === -1 ? 0 : fieldsAt);
  while (fieldDocs.length && fieldDocs[fieldDocs.length - 1].trim() === '//') fieldDocs.pop();
  return { fieldDocs: fieldDocs.join('\n'), itemsJson: lines.slice(jsonStart).join('\n').trim() };
}

export function buildCollectionImportTemplate({ endpoint, collectionsLabel, recordsLabel, recordTemplate, example }) {
  const { fieldDocs, itemsJson } = splitRecordTemplate(recordTemplate);
  const indentedItems = itemsJson.split('\n').map((l, i) => (i === 0 ? l : `  ${l}`)).join('\n');

  return `// Шаблон імпорту колекції (${collectionsLabel}) для POST ${endpoint}.
// Один об'єкт колекції або масив таких об'єктів. Власником колекції стає
// користувач, що робить імпорт. Зображення колекції не імпортується.
//
// Поля колекції:
//   name         — обов'язкове, рядок
//   description  — рядок або null
//   is_public    — true / false
//   items        — масив ${recordsLabel}, які створюються разом із колекцією (необов'язково).
//                  Вкладені записи імпортуються як нові (поле "id" ігнорується) лише від імені
//                  майстра гри чи адміністратора — решта користувачів імпортує тільки саму
//                  колекцію, а "items" пропускається. Формат запису — той самий, що в шаблоні
//                  імпорту ${recordsLabel}; поля описано нижче.
//
// Поля запису в "items":
${fieldDocs}
{
  "name": ${JSON.stringify(example.name)},
  "description": ${JSON.stringify(example.description)},
  "is_public": true,
  "items": ${indentedItems}
}
`;
}
