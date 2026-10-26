import { NavLink } from 'react-router-dom';
import CatalogTabs from '../CatalogTabs';

const TABS = [
  { label: 'Календарі', to: '/chronology', end: true },
  { label: 'Події', to: '/chronology/events' },
];

// Верхній рівень сервісу «Хронологія»: каталог календарів і окрема вкладка
// подій (раніше «Події» були підвкладкою всередині конкретного календаря).
// compact — широкий перемикач у короткій шапці сторінки подій.
export default function ChronologyTabs({ compact = false }) {
  if (!compact) return <CatalogTabs tabs={TABS} />;
  return (
    <nav className="flex min-w-[16rem] max-w-3xl flex-1 gap-1 rounded-lg border border-border bg-surface p-1 md:min-w-[26rem]">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            `flex-1 whitespace-nowrap rounded-md border px-4 py-1.5 text-center text-sm font-semibold transition-colors ${
              isActive ? 'border-gold/60 bg-gold/10 text-gold' : 'border-transparent text-text-dim hover:bg-surface-hover'
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
