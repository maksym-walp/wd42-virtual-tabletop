import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import diceApi from '../api/dice';
import Card from '../components/ui/Card';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ displayName: '', bio: '', avatarUrl: '' });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [diceStats, setDiceStats] = useState(null);

  useEffect(() => {
    api.get('/api/profile/me')
      .then(({ data }) => {
        setForm({
          displayName: data.profile.display_name || '',
          bio: data.profile.bio || '',
          avatarUrl: data.profile.avatar_url || '',
        });
      })
      .catch(() => setStatus('Не вдалося завантажити профіль'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    diceApi.stats().then(setDiceStats).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      await api.put('/api/profile/me', form);
      setStatus('Збережено!');
      setTimeout(() => setStatus(''), 2500);
    } catch {
      setStatus('Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (loading) return <div className="mx-auto max-w-xl px-4 py-8 text-text-dim">Завантаження...</div>;

  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title="Профіль" />

      <Card className="mb-4 flex flex-col gap-2">
        <p className="text-sm"><span className="mr-2 text-xs uppercase text-text-dim">Email</span>{user.email}</p>
        <p className="text-sm"><span className="mr-2 text-xs uppercase text-text-dim">Нікнейм</span>@{user.username}</p>
        <p className="text-sm"><span className="mr-2 text-xs uppercase text-text-dim">Роль</span>{user.role}</p>
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-lg text-text">Про себе</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Відображуване ім'я">
            <input
              type="text"
              className={inputClass}
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              maxLength={200}
            />
          </Field>

          <Field label="Біографія">
            <textarea
              className={`${inputClass} resize-y`}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              rows={4}
            />
          </Field>

          <Field label="URL аватара">
            <input
              type="url"
              className={inputClass}
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
            />
          </Field>

          {status && (
            <p className={`text-sm font-semibold ${status === 'Збережено!' ? 'text-sage' : 'text-danger'}`}>
              {status}
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? 'Зберігаємо...' : 'Зберегти'}
          </Button>
        </form>
      </Card>

      {diceStats && diceStats.total_rolls > 0 && (
        <Card className="mt-4">
          <h2 className="mb-4 font-display text-lg text-text">Статистика кидків</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Всього кидків" value={diceStats.total_rolls} />
            <StatTile label="Всього кубиків" value={diceStats.total_dice_rolled} />
            <StatTile label="Натуральні 20" value={diceStats.nat20_count} />
            <StatTile label="Натуральні 1" value={diceStats.nat1_count} />
          </div>
        </Card>
      )}

      <Button variant="ghost" onClick={handleLogout} className="mt-4 w-full md:hidden">
        <LogOut size={16} /> Вийти
      </Button>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg px-2 py-3">
      <span className="font-display text-xl text-accent">{value}</span>
      <span className="text-center text-[0.65rem] uppercase tracking-wide text-text-dim">{label}</span>
    </div>
  );
}
