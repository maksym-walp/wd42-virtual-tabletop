import { useState } from 'react';
import { CHARACTERISTICS, SKILL_PROGRESS_MARKS } from '../constants/characterSheet';
import Sheet from './ui/Sheet';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';

// Opened from the "ПУНКТИ ДОСВІДУ" banner on the character sheet. Content
// differs by viewer role (mutually exclusive, see character.controller.js):
//  - a GM (campaign GM or admin, not the literal owner) gets budget controls
//    — set the total outright, or add +1/+5/+10.
//  - the owner/player gets a read of their remaining budget, a shortcut to
//    the skill tree, and the "spend XP to raise a skill" purchase that used
//    to live directly on the character-sheet cards — the per-skill ±1
//    stepper here doubles as the *manual* nat-1/20 path (a physically
//    rolled die), no separate UI needed for that.
export default function ExperienceMenu({
  open, onClose, is_gm,
  experienceTotal, skillExperienceSpent, treeExperienceSpent, experienceRemaining,
  skillMap,
  onSetExperience, onAddExperience, onProgressAdjust, onLevelUp, onGoToTree,
}) {
  const [maxDraft, setMaxDraft] = useState(experienceTotal);

  const saveMax = () => {
    const n = Math.max(0, parseInt(maxDraft, 10) || 0);
    onSetExperience(n);
  };

  return (
    <Sheet open={open} onClose={onClose} title="Пункти досвіду">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-dim">
          <span>Залишилось: <strong className={experienceRemaining >= 0 ? 'text-sage' : 'text-danger'}>{experienceRemaining}</strong></span>
          <span>Усього: <strong className="text-gold">{experienceTotal}</strong></span>
          <span>На навички: <strong className="text-danger">{skillExperienceSpent}</strong></span>
          <span>На дерево: <strong className="text-danger">{treeExperienceSpent}</strong></span>
        </div>

        {is_gm ? (
          <div className="flex flex-col gap-3">
            <Field label="Максимум">
              <div className="flex gap-2">
                <input
                  type="number" min={0}
                  className={inputClass}
                  value={maxDraft}
                  onChange={e => setMaxDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveMax(); }}
                />
                <Button size="md" onClick={saveMax}>Зберегти</Button>
              </div>
            </Field>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-dim">Додати:</span>
              {[1, 5, 10].map(n => (
                <Button key={n} variant="ghost" size="sm" onClick={() => onAddExperience(n)}>+{n}</Button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={onGoToTree}>Перейти в дерево розвитку</Button>

            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">Розвиток навичок</p>
              {CHARACTERISTICS.map(char => (
                <div key={char.key} className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-gold">{char.label}</p>
                  {char.skills.map(skill => (
                    <SkillSpendRow
                      key={skill.key}
                      label={skill.label}
                      skill={skillMap[skill.key] || { value: 1, progress_marks: 0 }}
                      experienceRemaining={experienceRemaining}
                      onProgressAdjust={delta => onProgressAdjust(skill.key, delta)}
                      onLevelUp={() => onLevelUp(skill.key)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function SkillSpendRow({ label, skill, experienceRemaining, onProgressAdjust, onLevelUp }) {
  const { value, progress_marks: progress = 0 } = skill;
  const canMarkDown = progress > 0;
  const canMarkUp   = progress < SKILL_PROGRESS_MARKS && experienceRemaining > 0;
  const canLevelUp  = progress === SKILL_PROGRESS_MARKS && value < 12 && experienceRemaining > 0;

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">{label}</span>
        <span className="text-sm font-bold text-text">{value}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <button
          className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${canMarkDown ? 'border border-danger/40 bg-danger/10 text-danger' : 'text-border'}`}
          onClick={() => onProgressAdjust(-1)}
          disabled={!canMarkDown}
          title="Стерти одне коло"
        >−</button>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: SKILL_PROGRESS_MARKS }).map((_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full border-[1.5px] border-gold/50 ${i < progress ? 'bg-gold' : 'bg-transparent'}`} />
          ))}
        </div>
        <button
          className={`flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${canMarkUp ? 'border border-sage/40 bg-sage/10 text-sage' : 'text-border'}`}
          onClick={() => onProgressAdjust(1)}
          disabled={!canMarkUp}
          title="Позначити одне коло"
        >+</button>
        <Button size="sm" variant={canLevelUp ? 'sage' : 'ghost'} disabled={!canLevelUp} onClick={onLevelUp}>
          Підвищити
        </Button>
      </div>
    </div>
  );
}
