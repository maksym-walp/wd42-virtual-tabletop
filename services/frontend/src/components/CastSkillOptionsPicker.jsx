import { Plus, Trash2 } from 'lucide-react';
import { inputClass } from './ui/Field';
import { SKILL_TARGETS } from '../constants/nodeModifiers';

// Альтернативна навичка чарування (skill_tree.nodes.cast_skill_options,
// міграція 119, форма магії — 124): для заклинань обраної форми магії
// гравець може під час кастування обрати skill_key замість Чарування —
// сам обирає, система нічого не вирішує автоматично (розділ 2). Окремо
// від NodeModifiersPicker: там target — фіксована навичка, яку підсилює
// ефект; тут натомість форма заклинань (nature) змінює саму навичку
// перевірки.
//
// value: [{ id, magic_form, skill_key, note }]
export default function CastSkillOptionsPicker({ value = [], onChange, magicForms = [] }) {
  const newOption = () => ({
    id: crypto.randomUUID(),
    magic_form: magicForms[0]?.key ?? '',
    skill_key: 'spellcasting',
    note: '',
  });

  const update = (id, patch) => onChange(value.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const remove = (id) => onChange(value.filter((o) => o.id !== id));

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && (
        <p className="text-xs italic text-text-dim">
          Альтернативних навичок немає — заклинання кастуються лише Чаруванням.
        </p>
      )}

      {value.map((opt) => (
        <div key={opt.id} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} min-w-0 flex-1`}
              value={opt.magic_form}
              onChange={(e) => update(opt.id, { magic_form: e.target.value })}
            >
              {magicForms.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>

            <select
              className={`${inputClass} min-w-0 flex-1`}
              value={opt.skill_key}
              onChange={(e) => update(opt.id, { skill_key: e.target.value })}
            >
              {SKILL_TARGETS.map((t) => (
                <option key={t.key} value={t.key}>{t.group} · {t.label}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => remove(opt.id)}
              aria-label="Прибрати альтернативну навичку"
              className="rounded p-1.5 text-text-dim hover:bg-surface-hover hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <input
            type="text"
            className={inputClass}
            placeholder="Примітка (необов'язково)"
            value={opt.note ?? ''}
            onChange={(e) => update(opt.id, { note: e.target.value })}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, newOption()])}
        disabled={magicForms.length === 0}
        className="inline-flex items-center gap-1.5 self-start rounded border border-border px-2.5 py-1.5 text-xs font-semibold text-text-dim hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={14} /> Альтернативна навичка
      </button>
    </div>
  );
}
