import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import diceApi from '../api/dice';
import Card from '../components/ui/Card';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';

export default function Profile() {
  const { user, logout, updateAccount, changePassword } = useAuth();
  const navigate = useNavigate();
  const [accountForm, setAccountForm] = useState({ username: user.username, email: user.email });
  const [accountStatus, setAccountStatus] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [diceStats, setDiceStats] = useState(null);

  useEffect(() => {
    diceApi.stats().then(setDiceStats).catch(() => {});
  }, []);

  const handleAccountSubmit = async (e) => {
    e.preventDefault();
    setAccountSaving(true);
    setAccountStatus('');
    try {
      await updateAccount(accountForm);
      setAccountStatus('Збережено!');
      setTimeout(() => setAccountStatus(''), 2500);
    } catch (err) {
      setAccountStatus(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setAccountSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus('Паролі не співпадають');
      return;
    }
    setPasswordSaving(true);
    setPasswordStatus('');
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      navigate('/login');
    } catch (err) {
      setPasswordStatus(err.response?.data?.message || 'Помилка зміни паролю');
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader
        title="Профіль"
        action={<Button variant="ghost" size="sm" to={`/profile/${user.username}`}>Мій публічний профіль</Button>}
      />

      <Card className="mb-4">
        <h2 className="mb-4 font-display text-lg text-text">Обліковий запис</h2>
        <form onSubmit={handleAccountSubmit} className="flex flex-col gap-4">
          <Field label="Нікнейм">
            <input
              type="text"
              className={inputClass}
              value={accountForm.username}
              onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
              minLength={3}
              maxLength={50}
              required
              autoComplete="nickname"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              className={inputClass}
              value={accountForm.email}
              onChange={(e) => setAccountForm({ ...accountForm, email: e.target.value })}
              required
              autoComplete="email"
            />
          </Field>

          <p className="text-sm"><span className="mr-2 text-xs uppercase text-text-dim">Роль</span>{user.role}</p>

          {accountStatus && (
            <p className={`text-sm font-semibold ${accountStatus === 'Збережено!' ? 'text-sage' : 'text-danger'}`}>
              {accountStatus}
            </p>
          )}

          <Button type="submit" disabled={accountSaving}>
            {accountSaving ? 'Зберігаємо...' : 'Зберегти'}
          </Button>
        </form>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-4 font-display text-lg text-text">Зміна паролю</h2>
        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
          <input type="text" name="username" value={user.username} readOnly hidden autoComplete="username" tabIndex={-1} aria-hidden="true" />

          <Field label="Поточний пароль">
            <input
              type="password"
              className={inputClass}
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              required
              autoComplete="current-password"
            />
          </Field>

          <Field label="Новий пароль (мінімум 8 символів)">
            <input
              type="password"
              className={inputClass}
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>

          <Field label="Повторіть новий пароль">
            <input
              type="password"
              className={inputClass}
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              minLength={8}
              required
              autoComplete="new-password"
            />
          </Field>

          {passwordStatus && <p className="text-sm font-semibold text-danger">{passwordStatus}</p>}

          <Button type="submit" disabled={passwordSaving}>
            {passwordSaving ? 'Змінюємо...' : 'Змінити пароль'}
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
