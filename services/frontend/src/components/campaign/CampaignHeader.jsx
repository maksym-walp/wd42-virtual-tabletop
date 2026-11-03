import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ShareButton from '../ShareButton';

// Компактна шапка кампанії: назва, вкладки й нікнейм майстра в одному рядку.
// Опис кампанії показаний на картці в списку кампаній; код запрошення
// живе в Налаштуваннях.
export default function CampaignHeader({ campaign, tabs, tab, onSelectTab }) {
  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link to="/campaigns" aria-label="До списку кампаній" title="Кампанії"
          className="text-text-dim hover:text-accent">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-2xl leading-tight text-accent">{campaign.name}</h1>
        <ShareButton />
        {tabs && tabs.length > 0 && (
          <nav className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <button key={t.key}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-semibold transition-colors ${
                  tab === t.key ? 'bg-gold/10 text-gold' : 'text-text-dim hover:text-text'
                }`}
                onClick={() => onSelectTab(t.key)}>
                {t.label}
              </button>
            ))}
          </nav>
        )}
        <span className="text-sm text-text-dim sm:ml-auto">
          Майстер: <span className="text-text">{campaign.gm_username}</span>
        </span>
      </div>
    </header>
  );
}
