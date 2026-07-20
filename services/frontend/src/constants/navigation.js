import { Users, BookOpen, Swords, Zap, Star, TreePine, CircleUserRound, Castle, Gem } from 'lucide-react';

// Desktop Navbar: main inline links (logo already covers Home).
export const NAV_MAIN_ITEMS = [
  { to: '/skill-tree', label: 'Дерево',    icon: TreePine },
  { to: '/campaigns',  label: 'Кампанії',  icon: Castle },
  { to: '/characters', label: 'Персонажі', icon: Users },
];

// Desktop Navbar: "Ще" dropdown.
export const NAV_MORE_ITEMS = [
  { to: '/artifacts',  label: 'Артефакти',   icon: Gem },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння',      icon: Star },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
  { to: '/maneuvers',  label: 'Маневри',     icon: Zap },
];

// Mobile BottomNav: 2 direct tabs + a hardcoded centered "Головна" tab (not
// sourced from this array) + a dedicated dice-roll trigger (not a route,
// opens the DiceContext panel) + "Ще" overflow for the rest — kept to
// exactly 5 equal-width tabs so the bar never needs horizontal scrolling.
export const MOBILE_PRIMARY_NAV_ITEMS = [
  { to: '/campaigns',  label: 'Кампанії',  icon: Castle },
  { to: '/characters', label: 'Персонажі', icon: Users },
];

export const MOBILE_MORE_NAV_ITEMS = [
  { to: '/skill-tree', label: 'Дерево',      icon: TreePine },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння',      icon: Star },
  { to: '/maneuvers',  label: 'Маневри',     icon: Zap },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
  { to: '/artifacts',  label: 'Артефакти',   icon: Gem },
  { to: '/profile',    label: 'Особистий профіль', icon: CircleUserRound },
];
