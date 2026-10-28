// Назви рівнів, розмірів і ефектів зілля для форми й каталогу (GET
// /potions/options). Відповідність «рівень → кубик» і «розмір → порції» —
// у згенерованих колонках equipment.potions (міграція 110, heal_die/portions);
// die/portions тут — лише підписи для UI і мусять із нею збігатися.
const POTION_TIERS = [
  { key: 'tincture',  label: 'Настоянка', die: 4 },
  { key: 'decoction', label: 'Відвар',    die: 6 },
  { key: 'balm',      label: 'Бальзам',   die: 8 },
  { key: 'elixir',    label: 'Еліксир',   die: 10 },
  { key: 'extract',   label: 'Екстракт',  die: 12 },
];

const POTION_SIZES = [
  { key: 'ampoule', label: 'Ампула',   portions: 1 },
  { key: 'tube',    label: 'Пробірка', portions: 3 },
  { key: 'flask',   label: 'Флакон',   portions: 6 },
  { key: 'carafe',  label: 'Карафа',   portions: 10 },
];

const POTION_EFFECTS = [
  { key: 'healing', label: 'Зцілення' },
];

module.exports = { POTION_TIERS, POTION_SIZES, POTION_EFFECTS };
