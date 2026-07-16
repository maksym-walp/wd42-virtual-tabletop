import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Castle } from 'lucide-react';
import campaignApi from '../api/campaigns';
import characterApi from '../api/characterSheet';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import PageHeader from '../components/ui/PageHeader';
import Field, { inputClass } from '../components/ui/Field';
import Sheet from '../components/ui/Sheet';

export default function CampaignList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    campaignApi.list()
      .then(setCampaigns)
      .catch(() => setError('Не вдалось завантажити кампанії'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader
        title="🏰 Мої кампанії"
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setJoinOpen(true)}>Приєднатися за кодом</Button>
            <Button to="/campaigns/new">+ Нова кампанія</Button>
          </div>
        }
      />

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {campaigns.length === 0 ? (
        <EmptyState
          icon="🏰"
          title="У вас ще немає кампаній"
          action={<Button to="/campaigns/new">Створити першу</Button>}
        >
          Або приєднайтесь до кампанії майстра за кодом-запрошенням
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} onClick={() => navigate(`/campaigns/${c.id}`)} />
          ))}
        </div>
      )}

      <JoinCampaignSheet
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        onJoined={(campaignId) => navigate(`/campaigns/${campaignId}`)}
      />
    </div>
  );
}

function CampaignCard({ campaign: c, onClick }) {
  return (
    <Card onClick={onClick} className="cursor-pointer hover:border-accent/50">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-display text-lg text-text">{c.name}</h2>
        <Badge color={c.is_gm ? '#1a1a1a' : undefined} bg={c.is_gm ? '#d4af37' : undefined}
          className={c.is_gm ? '' : 'border border-border text-text-dim'}>
          {c.is_gm ? 'Майстер' : 'Гравець'}
        </Badge>
      </div>
      {c.is_gm && (
        <p className="text-sm text-text-dim">
          Код запрошення: <span className="font-mono text-gold">{c.invite_code}</span>
        </p>
      )}
    </Card>
  );
}

function JoinCampaignSheet({ open, onClose, onJoined }) {
  const [characters, setCharacters] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [characterId, setCharacterId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setInviteCode('');
    setCharacterId('');
    setError('');
    characterApi.list().then(setCharacters).catch(() => setCharacters([]));
  }, [open]);

  const handleJoin = async () => {
    if (!inviteCode.trim() || !characterId) {
      setError('Вкажіть код запрошення та оберіть персонажа');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { campaign } = await campaignApi.join(inviteCode.trim().toUpperCase(), characterId);
      onClose();
      onJoined(campaign.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при приєднанні');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Приєднатися до кампанії">
      <div className="flex flex-col gap-4">
        <Field label="Код запрошення">
          <input
            className={inputClass}
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            placeholder="Наприклад, KGTRGRP1"
            maxLength={12}
          />
        </Field>
        <Field label="Ваш персонаж">
          <select className={inputClass} value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
            <option value="">Оберіть персонажа...</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={handleJoin} disabled={saving}>
          {saving ? 'Приєднання...' : 'Приєднатися'}
        </Button>
      </div>
    </Sheet>
  );
}
