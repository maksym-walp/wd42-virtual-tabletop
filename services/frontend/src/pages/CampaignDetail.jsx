import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import campaignApi from '../api/campaigns';
import useCampaignEvents from '../hooks/useCampaignEvents';
import CombatTab from './CampaignCombat';
import CampaignHeader from '../components/campaign/CampaignHeader';
import TableTab from '../components/campaign/TableTab';
import ScreenTab from '../components/campaign/ScreenTab';
import SettingsTab from '../components/campaign/SettingsTab';

// Ширма — головна вкладка майстра, Стіл — гравця (див. defaultTab нижче).
const TABS = [
  { key: 'screen', label: 'Ширма', gmOnly: true },
  { key: 'table', label: 'Стіл' },
  { key: 'combat', label: 'Бойова сцена' },
  { key: 'settings', label: 'Налаштування' },
];

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Лічильники real-time подій: вкладка перезапитує свій ресурс, коли її
  // лічильник змінюється.
  const [versions, setVersions] = useState({});

  useEffect(() => {
    Promise.all([campaignApi.getOne(id), campaignApi.listCharacters(id)])
      .then(([c, chars]) => { setCampaign(c); setCharacters(chars); })
      .catch(() => setError('Не вдалось завантажити кампанію'))
      .finally(() => setLoading(false));
  }, [id]);

  const bump = useCallback((topic) => setVersions((v) => ({ ...v, [topic]: (v[topic] ?? 0) + 1 })), []);

  const refetchCampaign = () => campaignApi.getOne(id)
    .then(setCampaign)
    // Кампанію видалили або гравця відв'язали — більше нічого показувати.
    .catch((err) => { if ([403, 404].includes(err.response?.status)) navigate('/campaigns'); });

  useCampaignEvents(campaign ? id : null, {
    campaign: refetchCampaign,
    characters: () => {
      if (!campaign?.is_gm) refetchCampaign();
      campaignApi.listCharacters(id).then(setCharacters).catch(() => {});
      bump('characters');
    },
    board: () => bump('board'),
    screen: () => bump('screen'),
    sessions: () => bump('sessions'),
    combat: () => bump('combat'),
  });

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (error || !campaign) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4 text-danger">{error || 'Кампанію не знайдено'}</p>
        <Link to="/campaigns" className="text-sm text-accent">← До списку кампаній</Link>
      </div>
    );
  }

  // is_gm — майстерські права: власний майстер кампанії або адмін.
  const isGm = campaign.is_gm;
  const tabs = TABS.filter((t) => !t.gmOnly || isGm);
  const requested = searchParams.get('tab');
  const defaultTab = tabs[0].key;
  const tab = tabs.some((t) => t.key === requested) ? requested : defaultTab;

  const selectTab = (key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === defaultTab) next.delete('tab'); else next.set('tab', key);
      return next;
    }, { replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 pb-24 sm:px-6 md:pb-8">
      <CampaignHeader campaign={campaign} />

      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 border-b border-border">
          {tabs.map((t) => (
            <button key={t.key}
              className={`whitespace-nowrap rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-transparent text-text-dim'
              }`}
              onClick={() => selectTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'table' && (
        <TableTab
          campaign={campaign}
          isGm={isGm}
          onChange={setCampaign}
          version={versions.board}
          sessionsVersion={versions.sessions}
        />
      )}
      {tab === 'screen' && isGm && (
        <ScreenTab
          campaign={campaign}
          characters={characters}
          onChange={setCampaign}
          screenVersion={versions.screen}
          charactersVersion={versions.characters}
        />
      )}
      {tab === 'combat' && (
        <CombatTab campaignId={campaign.id} isGm={isGm} characters={characters} version={versions.combat} />
      )}
      {tab === 'settings' && (
        <SettingsTab
          campaign={campaign}
          isGm={isGm}
          onChange={setCampaign}
          characters={characters}
          setCharacters={setCharacters}
          navigate={navigate}
        />
      )}
    </div>
  );
}
