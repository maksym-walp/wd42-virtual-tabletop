import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import campaignApi from '../api/campaigns';
import Card from '../components/ui/Card';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';

export default function CampaignNew() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Вкажіть назву кампанії');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const campaign = await campaignApi.create({ name: name.trim() });
      navigate(`/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при створенні');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title="🏰 Нова кампанія" />
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Назва кампанії">
            <input
              autoFocus
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Тіні Старого Лісу"
              maxLength={200}
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={saving}>
            {saving ? 'Створення...' : 'Створити кампанію'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
