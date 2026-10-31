import { Plus, Trash2 } from 'lucide-react';
import { inputClass } from './ui/Field';
import {
  COMBAT_TARGETS, SKILL_TARGETS, modesForTarget, needsValue, modifierLabel,
} from '../constants/nodeModifiers';

// Механічний бік ефекту вузла: що саме система застосує сама, коли вузол
// відкрито (skill_tree.nodes.modifiers, міграція 112). Текстовий «Ефект»
// лишається поруч — він описує, modifiers діють.
//
// value: [{ id, target, mode, value, situational, note }]

const newModifier = () => ({
  // crypto.randomUUID є в усіх браузерах, які тягне Vite-збірка.
  id: crypto.randomUUID(),
  target: 'evasion', mode: 'adv', value: 1, situational: false, note: '',
});

export default function NodeModifiersPicker({ value = [], onChange }) {
  const update = (id, patch) => onChange(value.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const remove = (id) => onChange(value.filter((m) => m.id !== id));

  // Кубики шкоди режиму не мають — при зміні цілі режим доводиться
  // привести до дозволеного, інакше сервер мовчки відкине рядок.
  const changeTarget = (mod, target) => {
    const allowed = modesForTarget(target).map((m) => m.key);
    update(mod.id, { target, mode: allowed.includes(mod.mode) ? mod.mode : allowed[0] });
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 && (
        <p className="text-xs italic text-text-dim">
          Модифікаторів немає — вузол впливає лише текстом.
        </p>
      )}

      {value.map((mod) => (
        <div key={mod.id} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={`${inputClass} min-w-0 flex-1`}
              value={mod.target}
              onChange={(e) => changeTarget(mod, e.target.value)}
            >
              <optgroup label="Бойові кидки">
                {COMBAT_TARGETS.map((t) => (
                  <option key={t.key} value={t.key}>{t.label}</option>
                ))}
              </optgroup>
              <optgroup label="Навички">
                {SKILL_TARGETS.map((t) => (
                  <option key={t.key} value={t.key}>{t.group} · {t.label}</option>
                ))}
              </optgroup>
            </select>

            <select
              className={`${inputClass} min-w-0 flex-1`}
              value={mod.mode}
              onChange={(e) => update(mod.id, { mode: e.target.value })}
            >
              {modesForTarget(mod.target).map((m) => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>

            {needsValue(mod.mode) && (
              <input
                type="number"
                className={`${inputClass} w-20`}
                value={mod.value ?? 1}
                onChange={(e) => update(mod.id, { value: parseInt(e.target.value, 10) || 0 })}
              />
            )}

            <button
              type="button"
              onClick={() => remove(mod.id)}
              aria-label="Прибрати модифікатор"
              className="rounded p-1.5 text-text-dim hover:bg-surface-hover hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-text">
              <input
                type="checkbox"
                checked={!!mod.situational}
                onChange={(e) => update(mod.id, { situational: e.target.checked })}
              />
              Ситуативний
            </label>
            <input
              type="text"
              className={`${inputClass} min-w-0 flex-1`}
              placeholder={mod.situational ? 'Коли діє — напр. «проти звірів»' : 'Примітка (необов’язково)'}
              value={mod.note ?? ''}
              onChange={(e) => update(mod.id, { note: e.target.value })}
            />
          </div>

          {mod.situational && (
            <p className="text-[0.7rem] text-text-dim">
              Сам не застосовується: гравець вмикає його перемикачем у вікні кидка,
              коли умова виконана.
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, newModifier()])}
        className="inline-flex items-center gap-1.5 self-start rounded border border-border px-2.5 py-1.5 text-xs font-semibold text-text-dim hover:bg-surface-hover hover:text-text"
      >
        <Plus size={14} /> Модифікатор
      </button>
    </div>
  );
}

// Спільний показ вузлових модифікаторів — і в редакторі дерева, і в панелі
// гравця. Ситуативні позначені окремо: вони не діють самі.
export function NodeModifierList({ modifiers = [] }) {
  if (!modifiers.length) return null;
  return (
    <ul className="space-y-1">
      {modifiers.map((mod) => (
        <li key={mod.id} className="flex flex-wrap items-center gap-1.5">
          <span className="text-text">{modifierLabel(mod)}</span>
          {mod.situational && (
            <span className="rounded-full bg-gold/10 px-1.5 text-[0.65rem] font-semibold text-gold">ситуативно</span>
          )}
          {mod.note && <span className="text-text-dim">— {mod.note}</span>}
        </li>
      ))}
    </ul>
  );
}
