import { Users, BookOpen, Swords, Zap, Star, TreePine, Castle, Gem, Map, Skull } from 'lucide-react';

// Desktop Navbar: main inline links (logo already covers Home).
export const NAV_MAIN_ITEMS = [
  { to: '/skill-tree', label: 'Дерево',    icon: TreePine },
  { to: '/campaigns',  label: 'Кампанії',  icon: Castle },
  { to: '/characters', label: 'Персонажі', icon: Users },
];

// Desktop Navbar: "Ще" dropdown.
export const NAV_MORE_ITEMS = [
  { to: '/maps',       label: 'Мапи',        icon: Map },
  { to: '/compendium', label: 'НІПи та істоти', icon: Skull },
  { to: '/artifacts',  label: 'Артефакти',   icon: Gem },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння',      icon: Star },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
  { to: '/maneuvers',  label: 'Маневри',     icon: Zap },
];

// Mobile BottomNav: a settings icon (not sourced from this array — opens a
// popup with profile/theme/logout) + 1 direct tab + a hardcoded centered
// "Головна" tab (not sourced from this array either) + a dedicated
// dice-roll trigger (not a route, opens the DiceContext panel) + "Ще"
// overflow for the rest — kept to exactly 5 equal-width tabs so the bar
// never needs horizontal scrolling.
export const MOBILE_PRIMARY_NAV_ITEMS = [
  { to: '/characters', label: 'Персонажі', icon: Users },
];

export const MOBILE_MORE_NAV_ITEMS = [
  { to: '/campaigns',  label: 'Кампанії',    icon: Castle },
  { to: '/maps',       label: 'Мапи',        icon: Map },
  { to: '/compendium', label: 'НІПи та істоти', icon: Skull },
  { to: '/skill-tree', label: 'Дерево',      icon: TreePine },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння',      icon: Star },
  { to: '/maneuvers',  label: 'Маневри',     icon: Zap },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
  { to: '/artifacts',  label: 'Артефакти',   icon: Gem },
];
