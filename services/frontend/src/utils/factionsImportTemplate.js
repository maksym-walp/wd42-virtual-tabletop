// Шаблон для POST /api/npcs/factions/import — JSONC (з коментарями), той
// самий прийом, що й у locationImportTemplate.js. Лідери й учасники — це
// зв'язки з НІПами/персонажами, а не поле запису, тож їх імпорт не несе —
// додаються вручну після імпорту (та ж домовленість, що й у
// abilitiesImportTemplate.js для lore_creator_npc_id).
export function buildFactionsImportTemplate() {
  return `// Шаблон імпорту фракцій для POST /api/npcs/factions/import.
// Масив об'єктів — кожен є окремою фракцією. Поле "id" ігнорується,
// "symbol_url" завжди стає null — заповнювати не потрібно. Лідери й
// учасники фракції сюди не входять — додай їх вручну зі сторінки фракції
// після імпорту. Записи без "name" пропускаються.
//
// Поля:
//   name        — обов'язкове, рядок
//   description — рядок або null
//   is_public   — true / false
[
  {
    "name": "Приклад: Орден Світанку",
    "description": "Таємний орден, що полює на реліквії Старого Легіону.",
    "is_public": true
  }
]
`;
}
