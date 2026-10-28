import { useState } from 'react';
import { Info, Link2 } from 'lucide-react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { CHARACTERISTICS } from '../../constants/characterSheet';
import { effectChips, chipClass } from '../../utils/effectChips';

// Три стани персонажа (Втома, Хвороба, Травма): рівні 1–5 квадратами і
// лічильник «понад межу» до 9 (6-й рівень — непритомність). Тексти ефектів
// рівнів — condition_levels з character-sheet; що саме діє зараз — блок
// effects листа. Будь-яку зміну сервер нормалізує (блок Втоми 5, падіння,
// Травма 5), тож onChange — асинхронний запис, а стан береться з відповіді.

const MAX_LEVEL = 5;
const MAX_DATA_LEVEL = 9;
const UNCONSCIOUS_LEVEL = 6;

const SKILL_GROUPS = CHARACTERISTICS.map((ch) => ({ key: ch.key, label: ch.label, skills: ch.skills }));

export default function ConditionsSection({ conditions = [], effects, conditionsConfig, conditionLevels = {}, editable, onChange }) {
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(null);
  const [traumaEditor, setTraumaEditor] = useState(false);

  const levelOf = (type) => conditions.find((c) => c.type === type)?.level ?? 0;
  const conditionLabels = Object.fromEntries(conditionsConfig.map((c) => [c.key, c.label]));
  const trauma = conditions.find((c) => c.type === 'trauma');

  const write = async (next) => {
    setBusy(true);
    try { await onChange(next); } finally { setBusy(false); }
  };

  const setLevel = (type, level) => {
    if (level >= UNCONSCIOUS_LEVEL && levelOf(type) < level) {
      const text = level === UNCONSCIOUS_LEVEL
        ? `${UNCONSCIOUS_LEVEL}-й рівень робить персонажа непритомним. Продовжити?`
        : 'Кожен рівень понад 6-й зсуває шкалу смерті на −1 (на −3 персонаж помирає). Продовжити?';
      if (!window.confirm(text)) return;
    }
    const rest = conditions.filter((c) => c.type !== type);
    const prev = conditions.find((c) => c.type === type);
    write(level > 0 ? [...rest, { ...prev, type, level }] : rest);
  };

  const chips = effectChips(effects, { conditionLabels });

  return (
    <div>
      {conditionsConfig.map((cond) => {
        const level = levelOf(cond.key);
        const texts = (conditionLevels[cond.key] ?? []).filter((l) => l.level <= Math.min(level, MAX_LEVEL));
        return (
          <div key={cond.key} className="border-b border-bg py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-sm text-text-muted">{cond.label}</span>
                {(cond.description || conditionLevels[cond.key]) && (
                  <button type="button" onClick={() => setInfo(cond)} aria-label={`Що таке «${cond.label}»`} title="Опис стану"
                    className="rounded p-1 text-text-dim hover:bg-surface-hover hover:text-accent">
                    <Info size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {editable && (
                  <button type="button" aria-label={`Зменшити «${cond.label}»`}
                    className="flex h-7 w-7 items-center justify-center rounded border border-border bg-surface-hover text-text disabled:opacity-40"
                    onClick={() => setLevel(cond.key, level - 1)} disabled={busy || level === 0}>−</button>
                )}
                <div className="flex gap-[3px]" aria-label={`Рівень ${level}`}>
                  {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                    <button key={i} type="button" disabled={!editable || busy}
                      onClick={() => setLevel(cond.key, level === i + 1 ? i : i + 1)}
                      title={`Рівень ${i + 1}`}
                      className={`h-4 w-4 rounded-sm border-[1.5px] ${i < level ? 'border-danger bg-danger/70' : 'border-border bg-bg'} enabled:cursor-pointer`} />
                  ))}
                </div>
                {level > MAX_LEVEL && (
                  <span className="rounded bg-danger/15 px-1 text-xs font-bold text-danger" title="Понад межу: 6-й рівень — непритомність">
                    +{level - MAX_LEVEL}
                  </span>
                )}
                {editable && (
                  <button type="button" aria-label={`Збільшити «${cond.label}»`}
                    title={level >= MAX_LEVEL ? 'Понад межу: 6-й рівень — непритомність' : undefined}
                    className={`flex h-7 w-7 items-center justify-center rounded border bg-surface-hover text-text disabled:opacity-40 ${level >= MAX_LEVEL ? 'border-danger/50' : 'border-border'}`}
                    onClick={() => setLevel(cond.key, level + 1)} disabled={busy || level >= MAX_DATA_LEVEL}>+</button>
                )}
              </div>
            </div>
            {texts.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5 pl-1 text-xs text-text-dim">
                {texts.map((t) => <li key={t.level}><b className="text-danger">{t.level}.</b> {t.text}</li>)}
                {level >= UNCONSCIOUS_LEVEL && conditionLevels.beyond && <li><b className="text-danger">6+.</b> {conditionLevels.beyond.text}</li>}
              </ul>
            )}
            {cond.key === 'trauma' && level > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-text-dim">
                <Link2 size={12} />
                <span>Повʼязані навички: {trauma?.skill_keys?.length ? trauma.skill_keys.map(skillLabel).join(', ') : 'не обрано'}</span>
                {editable && (
                  <button type="button" className="text-accent hover:underline" onClick={() => setTraumaEditor(true)}>змінити</button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {chips.map((chip) => <span key={chip.key} className={chipClass(chip.tone)}>{chip.text}</span>)}
        </div>
      )}

      {info && (
        <Sheet open onClose={() => setInfo(null)} title={info.label}>
          {info.description && <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-text">{info.description}</p>}
          <ol className="flex flex-col gap-1 text-sm text-text">
            {(conditionLevels[info.key] ?? []).map((l) => <li key={l.level}><b>{l.level}.</b> {l.text}</li>)}
          </ol>
          {conditionLevels.beyond && <p className="mt-3 text-xs text-text-dim">{conditionLevels.beyond.text}. Ефекти нижчих рівнів діють і на вищих.</p>}
        </Sheet>
      )}

      {traumaEditor && (
        <TraumaSkillsEditor
          selected={trauma?.skill_keys ?? []}
          onClose={() => setTraumaEditor(false)}
          onSave={async (keys) => {
            await write(conditions.map((c) => (c.type === 'trauma' ? { ...c, skill_keys: keys } : c)));
            setTraumaEditor(false);
          }}
        />
      )}
    </div>
  );
}

function skillLabel(key) {
  for (const group of SKILL_GROUPS) {
    const skill = group.skills.find((s) => s.key === key);
    if (skill) return skill.label;
  }
  return key;
}

function TraumaSkillsEditor({ selected, onClose, onSave }) {
  const [keys, setKeys] = useState(selected);
  const [saving, setSaving] = useState(false);
  const toggle = (key) => setKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <Sheet open onClose={onClose} title="Навички пошкодженої частини тіла">
      <p className="mb-3 text-xs text-text-dim">
        З 2-го рівня Травми ці навички кидають кубик-модифікатор на ранг нижчий, з 4-го — недоступні.
      </p>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SKILL_GROUPS.map((group) => (
          <fieldset key={group.key}>
            <legend className="mb-1 text-xs font-bold uppercase tracking-wide text-gold">{group.label}</legend>
            {group.skills.map((s) => (
              <label key={s.key} className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-text">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={keys.includes(s.key)} onChange={() => toggle(s.key)} />
                {s.label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <Button disabled={saving} onClick={async () => { setSaving(true); try { await onSave(keys); } finally { setSaving(false); } }}>
        Зберегти
      </Button>
    </Sheet>
  );
}
