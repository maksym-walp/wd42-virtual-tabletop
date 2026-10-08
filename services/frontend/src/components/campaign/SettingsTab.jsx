import { useState } from 'react';
import { Trash2, Lock, LogOut, Copy, RefreshCw, Check } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import useDebounce from '../../hooks/useDebounce';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import SmartTextarea from '../ui/SmartTextarea';

// ================================================================
// Налаштування: для майстра/адміна — назва й опис, код запрошення,
// керування персонажами і видалення кампанії; для гравця — вихід із кампанії.
// ================================================================

export default function SettingsTab({ campaign, isGm, onChange, characters, setCharacters, navigate }) {
  if (!isGm) return <PlayerSettingsTab campaign={campaign} navigate={navigate} />;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <CampaignDetailsCard campaign={campaign} onChange={onChange} />
        <InviteCodeCard campaign={campaign} onChange={onChange} />
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <CampaignCharactersAdmin campaignId={campaign.id} characters={characters} setCharacters={setCharacters} />
        <DangerZone campaign={campaign} navigate={navigate} />
      </div>
    </div>
  );
}

// Код, за яким гравці приєднують персонажів. Новий код робить старий
// недійсним — на випадок, якщо він потрапив не туди.
function InviteCodeCard({ campaign, onChange }) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(campaign.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Не вдалось скопіювати — виділіть код вручну');
    }
  };

  const handleRegenerate = async () => {
    if (!confirm('Згенерувати новий код? Старий перестане працювати.')) return;
    setBusy(true);
    setError('');
    try {
      const updated = await campaignApi.regenerateInviteCode(campaign.id);
      onChange((prev) => ({ ...prev, invite_code: updated.invite_code }));
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось згенерувати новий код');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Код запрошення</p>
      <p className="mb-3 text-sm text-text-dim">Гравці вводять його на сторінці «Кампанії», щоб приєднати свого персонажа.</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="select-all rounded-lg border border-border bg-bg px-4 py-2 font-mono text-lg tracking-widest text-gold">
          {campaign.invite_code}
        </span>
        <Button variant="ghost" size="sm" onClick={handleCopy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Скопійовано' : 'Копіювати'}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={busy}>
          <RefreshCw size={14} /> Новий код
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}

function PlayerSettingsTab({ campaign, navigate }) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const handleLeave = async () => {
    if (!confirm(`Покинути кампанію "${campaign.name}"? Ваші персонажі відв'яжуться від неї.`)) return;
    setLeaving(true);
    try {
      await campaignApi.leave(campaign.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при виході з кампанії');
      setLeaving(false);
    }
  };

  return (
    <Card className="max-w-2xl">
      <p className="mb-3 text-sm text-text-dim">
        Ви покинете кампанію «{campaign.name}» — ваші персонажі відв'яжуться від неї, але самі листи персонажів не видаляться.
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <Button variant="danger" onClick={handleLeave} disabled={leaving}>
        <LogOut size={14} /> {leaving ? 'Вихід...' : 'Покинути кампанію'}
      </Button>
    </Card>
  );
}

function CampaignDetailsCard({ campaign, onChange }) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveName = useDebounce(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      const updated = await campaignApi.rename(campaign.id, trimmed);
      onChange((prev) => ({ ...prev, name: updated.name }));
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при перейменуванні');
    } finally {
      setSaving(false);
    }
  });

  const saveDescription = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateDescription(campaign.id, value);
      onChange((prev) => ({ ...prev, description: updated.description }));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">Назва та опис кампанії</p>
        {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Назва">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => { setName(e.target.value); saveName(e.target.value); }}
            maxLength={200}
          />
        </Field>
        <SmartTextarea
          label="Опис" rows={5}
          value={description}
          onChange={(e) => { setDescription(e.target.value); saveDescription(e.target.value); }}
          placeholder="Коротко про що кампанія, сеттінг, тон гри..."
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Card>
  );
}

function CampaignCharactersAdmin({ campaignId, characters, setCharacters }) {
  const [newCharacterId, setNewCharacterId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [granting, setGranting] = useState(false);
  const [success, setSuccess] = useState('');

  const refresh = () => campaignApi.listCharacters(campaignId).then(setCharacters);

  const handleRemove = async (characterId, characterName) => {
    if (!confirm(`Видалити персонажа "${characterName}" з кампанії? Сам лист персонажа не буде видалено.`)) return;
    try {
      await campaignApi.removeCharacter(campaignId, characterId);
      setCharacters((prev) => prev.filter((c) => c.character_id !== characterId));
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні персонажа з кампанії');
    }
  };

  const handleAdd = async () => {
    if (!newCharacterId.trim()) return;
    setAdding(true);
    setError('');
    try {
      await campaignApi.addCharacter(campaignId, newCharacterId.trim());
      setNewCharacterId('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при додаванні персонажа');
    } finally {
      setAdding(false);
    }
  };

  const handleGrantExperience = async (amount) => {
    setGranting(true);
    setError('');
    setSuccess('');
    try {
      const { updated } = await campaignApi.grantExperience(campaignId, amount);
      setSuccess(`Видано +${amount} досвіду персонажам (${updated})`);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видачі досвіду');
    } finally {
      setGranting(false);
    }
  };

  return (
    <Card>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Персонажі кампанії</p>
      {characters.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-text-dim">Видати досвід усім:</span>
          {[1, 5, 10].map((amount) => (
            <Button key={amount} variant="ghost" size="sm" disabled={granting}
              onClick={() => handleGrantExperience(amount)}>
              +{amount}
            </Button>
          ))}
        </div>
      )}
      {success && <p className="mb-2 text-sm text-sage">{success}</p>}
      <div className="mb-4 flex gap-2">
        <input
          className={`${inputClass} flex-1`}
          value={newCharacterId}
          onChange={(e) => setNewCharacterId(e.target.value)}
          placeholder="ID персонажа, який надав гравець"
        />
        <Button onClick={handleAdd} disabled={adding} size="md">
          {adding ? 'Додавання...' : 'Додати'}
        </Button>
      </div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {characters.length === 0 ? (
        <p className="text-sm text-text-dim">До кампанії ще не приєднано жодного персонажа.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {characters.map((ch) => (
            <li key={ch.character_id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm text-text">
                  {ch.character_name}
                  {ch.is_private && <Lock size={12} className="text-text-dim" aria-label="Приватний персонаж" />}
                </p>
                <p className="text-xs text-text-dim">{ch.archetype} · {ch.race} · {ch.owner_username}</p>
              </div>
              <button
                onClick={() => handleRemove(ch.character_id, ch.character_name)}
                aria-label="Видалити персонажа з кампанії"
                className="shrink-0 p-1 text-text-dim hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DangerZone({ campaign, navigate }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteCampaign = async () => {
    if (!confirm(`Видалити кампанію "${campaign.name}"? Персонажі гравців не видаляться, лише відв'яжуться від кампанії. Це незворотно.`)) return;
    setDeleting(true);
    try {
      await campaignApi.remove(campaign.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні кампанії');
      setDeleting(false);
    }
  };

  return (
    <Card className="border-danger/40">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-danger">Небезпечна зона</p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <Button variant="danger" onClick={handleDeleteCampaign} disabled={deleting}>
        <Trash2 size={14} /> {deleting ? 'Видалення...' : 'Видалити кампанію'}
      </Button>
    </Card>
  );
}
