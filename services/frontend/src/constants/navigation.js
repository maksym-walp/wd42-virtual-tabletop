import { Home, Users, BookOpen, Swords, Zap, TreePine, CircleUserRound } from 'lucide-react';

// Shared between Navbar.jsx (desktop top bar) and BottomNav.jsx (mobile tab bar).
export const NAV_ITEMS = [
  { to: '/',            label: 'Головна',     icon: Home },
  { to: '/characters',  label: 'Персонажі',   icon: Users },
  { to: '/spellbook',   label: 'Заклинання',  icon: BookOpen },
  { to: '/equipment',   label: 'Спорядження', icon: Swords },
  { to: '/maneuvers',   label: 'Маневри',     icon: Zap },
  { to: '/skill-tree',  label: 'Дерево',      icon: TreePine },
  { to: '/profile',     label: 'Профіль',     icon: CircleUserRound },
];
