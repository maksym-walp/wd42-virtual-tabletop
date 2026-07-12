export const EQUIPMENT_TYPES = {
  weapon:   { label: 'Зброя',     color: '#7a3320', bg: 'rgba(122,51,32,0.12)' },
  armor:    { label: 'Обладунок', color: '#2e5240', bg: 'rgba(46,82,64,0.12)' },
  artifact: { label: 'Артефакт',  color: '#4a3d66', bg: 'rgba(74,61,102,0.12)' },
  item:     { label: 'Предмет',   color: '#8a5a2b', bg: 'rgba(138,90,43,0.12)' },
};

export const DAMAGE_DICE = ['d4', 'd6', 'd8', 'd10', 'd12'];

export const WEAPON_TYPES = {
  melee:     { label: 'Ближня' },
  ranged:    { label: 'Дальньобійна' },
  thrown:    { label: 'Метальна' },
  universal: { label: 'Універсальна' },
};

export const WEAPON_GRIPS = {
  one_handed: { label: 'Одноручна' },
  two_handed: { label: 'Дворучна' },
  versatile:  { label: 'Універсальна' },
  other:      { label: 'Інше' },
};

export const ARMOR_WEIGHTS = {
  light:  { label: 'Легкий' },
  medium: { label: 'Середній' },
  heavy:  { label: 'Важкий' },
};

export const RARITIES = {
  common:    { label: 'Поширений', color: '#5b5b5b' },
  uncommon:  { label: 'Незвичний', color: '#2e5240' },
  rare:      { label: 'Рідкісний', color: '#2b4a8a' },
  legendary: { label: 'Легендарний', color: '#8a5a2b' },
};
