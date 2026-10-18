import { Link } from 'react-router-dom';
import { Sparkles, Layers } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';

// Вітрина допоміжних інструментів. Новий інструмент — новий елемент у TOOLS.
const TOOLS = [
  {
    to: '/tools/constellations',
    icon: Sparkles,
    title: 'Сузір\'я',
    text: 'Візерунки із зірок і ліній: кожна зірка має назву, опис і рівень від 1 до 3.',
  },
  {
    to: '/tools/decks',
    icon: Layers,
    title: 'Колоди карт',
    text: 'Власні колоди таро чи будь-яких інших карт: масті, номінали, зображення, стопки й перетасовка.',
  },
];

export default function ToolsHome() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title="🧰 Інструменти" subtitle="Допоміжні засоби для гри" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TOOLS.map(({ to, icon: Icon, title, text }) => (
          <Link
            key={to}
            to={to}
            className="flex gap-4 rounded-lg border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
            style={{ borderLeft: '4px solid var(--color-accent)' }}
          >
            <Icon size={28} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <h2 className="font-display text-xl text-accent">{title}</h2>
              <p className="mt-1 text-sm text-text-muted">{text}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
