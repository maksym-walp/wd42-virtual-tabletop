import { useState } from 'react';
import { inputClass } from './ui/Field';
import Button from './ui/Button';

// Admin-only control to reassign a record's owner/author to another
// registered user by username, without touching anything else about the
// record. Rendered by the caller only when the viewer is an admin — this
// component doesn't check the role itself.
export default function ChangeOwnerControl({ onSubmit }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const cancel = () => {
    setEditing(false);
    setUsername('');
    setError('');
  };

  const handleSave = async () => {
    if (!username.trim()) return;
    setSaving(true);
    setError('');
    try {
      await onSubmit(username.trim());
      cancel();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося змінити власника');
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        Змінити власника
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className={`${inputClass} min-w-0 flex-1 basis-48`}
        placeholder="username нового власника"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
        autoFocus
      />
      <Button size="sm" onClick={handleSave} disabled={saving || !username.trim()}>
        {saving ? 'Збереження...' : 'Зберегти'}
      </Button>
      <Button variant="ghost" size="sm" onClick={cancel} disabled={saving}>
        Скасувати
      </Button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
