import { useState } from 'react';
import Sheet from './ui/Sheet';
import Button from './ui/Button';

// GM-only bulk editor: every skill's value and progress circles, all at
// once, bypassing the cost formula entirely (matches the backend's existing
// trust model — SkillModel.patch/bulkUpdate just clamp, no XP check). Only
// reachable when the sheet already told us this viewer is a GM for THIS
// character (authorizeCharacterWrite scopes that to characters attached to
// one of their campaigns — see character.controller.js's is_gm).
export default function GmSkillEditor({ open, onClose, characteristics, skillMap, onSave }) {
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(
      Object.entries(skillMap).map(([key, s]) => [key, { value: s.value, progress_marks: s.progress_marks }])
    )
  );
  const [saving, setSaving] = useState(false);

  const setField = (key, field, raw) => {
    const n = parseInt(raw, 10);
    setDraft(prev => ({ ...prev, [key]: { ...prev[key], [field]: Number.isNaN(n) ? 0 : n } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(draft).map(([skill_key, d]) => ({
        skill_key,
        value: Math.max(0, Math.min(12, d.value)),
        progress_marks: Math.max(0, Math.min(4, d.progress_marks)),
      }));
      await onSave(updates);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Редагування навичок персонажа">
      <div className="flex flex-col gap-4">
        {characteristics.map(char => (
          <div key={char.key} className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{char.label}</p>
            {char.skills.map(skill => {
              const d = draft[skill.key] || { value: 1, progress_marks: 0 };
              return (
                <div key={skill.key} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text-muted">{skill.label}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 text-xs text-text-dim">
                      Знач.
                      <input
                        type="number" min={0} max={12}
                        className="w-14 rounded border border-border bg-bg px-1.5 py-1 text-center text-sm text-text"
                        value={d.value}
                        onChange={e => setField(skill.key, 'value', e.target.value)}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-text-dim">
                      Кола
                      <input
                        type="number" min={0} max={4}
                        className="w-14 rounded border border-border bg-bg px-1.5 py-1 text-center text-sm text-text"
                        value={d.progress_marks}
                        onChange={e => setField(skill.key, 'progress_marks', e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Збереження...' : 'Зберегти зміни'}</Button>
      </div>
    </Sheet>
  );
}
