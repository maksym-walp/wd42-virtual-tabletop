import { Users, BookOpen, Swords, Star, TreePine, Castle, Map, Skull, CalendarDays } from 'lucide-react';

// Desktop Navbar: main inline links (logo already covers Home).
export const NAV_MAIN_ITEMS = [
  { to: '/characters', label: 'Персонажі', icon: Users },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння і маневри', icon: Star },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
];

// Desktop Navbar: "Ще" dropdown.
export const NAV_MORE_ITEMS = [
  { to: '/skill-tree', label: 'Дерево',    icon: TreePine },
  { to: '/maps',       label: 'Мапи',        icon: Map },
  { to: '/compendium', label: 'НІПи та істоти', icon: Skull },
  { to: '/campaigns',  label: 'Кампанії',  icon: Castle },
  { to: '/chronology', label: 'Хронологія', icon: CalendarDays },
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
  { to: '/chronology', label: 'Хронологія',  icon: CalendarDays },
  { to: '/compendium', label: 'НІПи та істоти', icon: Skull },
  { to: '/skill-tree', label: 'Дерево',      icon: TreePine },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння і маневри', icon: Star },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
];
