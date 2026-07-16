import { Home, Users, BookOpen, Swords, Zap, Star, TreePine, CircleUserRound, Castle } from 'lucide-react';

// Full set — used by the desktop Navbar, which has plenty of horizontal
// room and doesn't need an overflow menu.
export const NAV_ITEMS = [
  { to: '/skill-tree', label: 'Дерево',      icon: TreePine },
  { to: '/',           label: 'Головна',     icon: Home },
  { to: '/characters', label: 'Персонажі',   icon: Users },
  { to: '/campaigns',  label: 'Кампанії',    icon: Castle },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння',      icon: Star },
  { to: '/maneuvers',  label: 'Маневри',     icon: Zap },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
  { to: '/profile',    label: 'Профіль',     icon: CircleUserRound },
];

// Mobile BottomNav: 3 direct tabs + a dedicated dice-roll trigger (not a
// route, opens the DiceContext panel) + "Ще" overflow for the rest — kept to
// exactly 5 equal-width tabs so the bar never needs horizontal scrolling to
// reach "Ще" on narrow phones.
export const MOBILE_PRIMARY_NAV_ITEMS = [
  { to: '/profile',    label: 'Профіль',   icon: CircleUserRound },
  { to: '/characters', label: 'Персонажі', icon: Users },
  { to: '/',           label: 'Головна',   icon: Home },
];

export const MOBILE_MORE_NAV_ITEMS = [
  { to: '/skill-tree', label: 'Дерево',      icon: TreePine },
  { to: '/campaigns',  label: 'Кампанії',    icon: Castle },
  { to: '/spellbook',  label: 'Заклинання',  icon: BookOpen },
  { to: '/abilities',  label: 'Вміння',      icon: Star },
  { to: '/maneuvers',  label: 'Маневри',     icon: Zap },
  { to: '/equipment',  label: 'Спорядження', icon: Swords },
];
