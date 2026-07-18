import { ScrollText, BookOpen, TreePine, Swords, Zap, Star, CircleUserRound, Castle, Gem } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';

const TOOLS = [
  { id: 'profile',    label: 'Профіль',           icon: CircleUserRound, href: '/profile' },
  { id: 'skill-tree', label: 'Дерево розвитку',   icon: TreePine,        href: '/skill-tree' },
  { id: 'characters', label: 'Листи персонажів',  icon: ScrollText,      href: '/characters' },
  { id: 'campaigns',  label: 'Кампанії',          icon: Castle,          href: '/campaigns' },
  { id: 'spellbook',  label: 'Книга заклинань',   icon: BookOpen,        href: '/spellbook' },
  { id: 'abilities',  label: 'Вміння',            icon: Star,            href: '/abilities' },
  { id: 'maneuvers',  label: 'Маневри',           icon: Zap,             href: '/maneuvers' },
  { id: 'equipment',  label: 'Спорядження',       icon: Swords,          href: '/equipment' },
  { id: 'artifacts',  label: 'Артефакти',         icon: Gem,             href: '/artifacts' },
];

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title={`Вітаємо, ${user.username}!`} subtitle="Оберіть інструмент для гри" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map(({ id, label, icon: Icon, href }) => (
          <Card key={id} className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Icon size={28} strokeWidth={1.75} />
            </div>
            <h2 className="font-display text-lg text-text">{label}</h2>
            <Button to={href} className="w-full">Відкрити</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
