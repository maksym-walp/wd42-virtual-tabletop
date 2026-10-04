import { useState, useEffect } from 'react';
import { inputClass } from '../ui/Field';

// Inline-editable faction role: saves on blur or Enter, only when the text
// actually changed (empty -> null, i.e. "роль не вказана").
export default function RoleInput({ value, onSave, className = '' }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => { setDraft(value || ''); }, [value]);

  const commit = () => {
    const next = draft.trim() || null;
    if (next !== (value || null)) onSave(next);
  };

  return (
    <input
      className={`${inputClass} text-sm ${className}`} placeholder="Роль" maxLength={200}
      value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
    />
  );
}
