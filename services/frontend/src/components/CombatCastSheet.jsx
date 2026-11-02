import { useState } from 'react';
import campaignApi from '../api/campaigns';
import { combatantProfile } from '../utils/combatantProfile';
import { buildRollFormula, mergeRollModes } from '../utils/rollProfile';
import { repeatCastDisadvantage } from '../utils/actionRepeat';
import { spellTiers, spellWithForm } from '../constants/spellbook';
import { spellAccessFor, castSkillOptionsFor } from '../utils/spellAccess';
import { useDice } from '../context/DiceContext';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';
import Sheet from './ui/Sheet';

// ================================================================
// Каст бойового заклинання (spell_kind='combat') із таблиці бою: обрати
// заклинання, за потреби — форму й навичку чарування, й одну чи декілька
// цілей, решту система робить сама. Той самий потік, що й AttackSheet:
// кубики кидаються тут (dice-roller), сервер (POST /:id/combat/cast) лише
// списує енергію й розвʼязує результат (campaigns/src/utils/attack.js,
// той самий код, що й для атаки зброєю — магічний снаряд, що потребує
// влучання, резолвиться так само, розділ 4.8.3).
//
// MVP: лише миттєві ефекти, кожна ціль — незалежний кидок (без спільного
// пулу шкоди). Заклинання з тривалим ефектом (шкода на початку раунду
// тощо) тут не автоматизуються.
// ================================================================

const tierOfKey = (k) => (k === 'main' ? 'full' : k);
const formKeyOfTier = (t) => (t === 'full' ? 'main' : t);

const TIER_LABELS = { primitive: 'Обмежена', full: 'Повноцінна', perfected: 'Довершена' };

export default function CombatCastSheet({ caster, targets, campaignId, sheet, onClose, onDone }) {
  const { roll: rollDice, rolling } = useDice();
  const [spellId, setSpellId] = useState('');
  const [tier, setTier] = useState('full');
  const [skillKey, setSkillKey] = useState('spellcasting');
  const [targetIds, setTargetIds] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const gmGranted = (row) => !!row.gm_granted;
  const accessFor = (row) => (gmGranted(row) ? { met: true, allowedForms: null } : spellAccessFor(row, sheet?.spell_access));

  const castable = (sheet?.spells ?? []).filter((row) => accessFor(row).met);
  const row = castable.find((r) => r.spell_id === spellId) ?? null;

  const tiers = row ? spellTiers(row) : [];
  const access = row ? accessFor(row) : { allowedForms: null };
  const allowedTiers = !tiers.length ? [] : (
    access.allowedForms == null ? tiers : tiers.filter((t) => access.allowedForms.map(tierOfKey).includes(t))
  );

  const form = row ? spellWithForm(row, tiers.length ? formKeyOfTier(tier) : 'main') : null;
  const skillOptions = row ? castSkillOptionsFor(row, sheet?.cast_skill_options) : ['spellcasting'];

  // Нове заклинання обрано — скидаємо форму/навичку/цілі до дефолтів.
  const selectSpell = (id) => {
    setSpellId(id);
    setResults(null);
    setError('');
    const r = castable.find((x) => x.spell_id === id);
    if (!r) return;
    const rTiers = spellTiers(r);
    const rAccess = gmGranted(r) ? { allowedForms: null } : spellAccessFor(r, sheet?.spell_access);
    const rAllowed = !rTiers.length ? [] : (
      rAccess.allowedForms == null ? rTiers : rTiers.filter((t) => rAccess.allowedForms.map(tierOfKey).includes(t))
    );
    const preferred = r.form_tier && rAllowed.includes(r.form_tier) ? r.form_tier : (rAllowed[0] ?? 'full');
    setTier(preferred);
    setSkillKey('spellcasting');
    setTargetIds([]);
  };

  const toggleTarget = (id) => setTargetIds((prev) => (
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  ));

  const canCast = !!row && targetIds.length > 0 && (tiers.length === 0 || allowedTiers.includes(tier)) && !busy && !rolling;

  const handleCast = async () => {
    setError('');
    setBusy(true);
    try {
      const notes = [];
      const factors = [];
      if (!row.mastered) { factors.push('dis'); notes.push('неосвоєне заклинання'); }
      const repeats = (caster.actions_log ?? []).filter((a) => a === 'cast').length;
      const repeatPenalty = repeatCastDisadvantage(repeats, sheet?.archetype);
      if (repeatPenalty) { factors.push(repeatPenalty); notes.push('повторення дії'); }

      const skillProfile = await combatantProfile(caster, sheet, skillKey);
      if (skillProfile?.mode && skillProfile.mode !== 'normal') factors.push(skillProfile.mode);
      const mode = mergeRollModes(factors);
      const bonus = skillProfile?.bonus ?? 0;
      const hitFormula = buildRollFormula({ die: skillProfile?.die ?? null, mode, bonus, withD20: true });

      // Кількість кубиків шкоди заклинання — власне поле заклинання
      // (damage_dice_count), не Майстерність кастера: та стосується лише
      // атак зброєю (розділ 4.4.3, міграція 122).
      const count = form.damage_dice_count ?? 1;
      const damageFormula = form.damage_die ? `${count}${form.damage_die}` : null;

      const targetPayloads = [];
      for (const targetId of targetIds) {
        const target = targets.find((t) => t.id === targetId);
        const hitRoll = await rollDice(hitFormula);
        const d20 = hitRoll?.groups?.find((g) => g.sides === 20);
        const natural = d20 ? (d20.type === 'dice' ? d20.rolls?.[0] ?? null : d20.dice?.[0]?.kept ?? null) : null;

        let dodge = null;
        if (target?.reaction_reserved) {
          const dodgeProfile = await combatantProfile(target, null, 'evasion');
          const dodgeFormula = buildRollFormula({ ...dodgeProfile, withD20: false });
          if (dodgeFormula) {
            const dodgeRoll = await rollDice(dodgeFormula);
            dodge = { total: dodgeRoll.total, formula: dodgeFormula };
          }
        }

        let damage = null;
        if (damageFormula) {
          const damageRoll = await rollDice(damageFormula);
          damage = { total: damageRoll.total, formula: damageFormula };
        }

        targetPayloads.push({
          target_id: targetId,
          hit: { total: hitRoll.total, natural, formula: hitFormula },
          dodge,
          damage,
        });
      }

      const payload = await campaignApi.combatCast(campaignId, {
        caster_id: caster.id,
        spell: {
          id: row.spell_id, name: row.name, form_key: form.form_key, form_label: form.form_label,
          skill_key: skillKey, energy_cost: form.energy_cost, damage_die: form.damage_die ?? null,
        },
        targets: targetPayloads,
      });
      setResults({ ...payload, hitFormula, damageFormula, mode, notes });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося здійснити каст');
    } finally {
      setBusy(false);
    }
  };

  const energyPreview = sheet?.current_magic != null && form
    ? `${sheet.current_magic} / ${sheet.effects?.max_magic_effective ?? '?'} ен. — після каста: ${sheet.current_magic - form.energy_cost}`
    : null;

  return (
    <Sheet open onClose={onClose} title={`Чарування: ${caster.name}`}>
      <div className="flex flex-col gap-3">
        <Field label="Заклинання">
          <select className={inputClass} value={spellId} onChange={(e) => selectSpell(e.target.value)}>
            <option value="">— оберіть заклинання —</option>
            {castable.map((r) => (
              <option key={r.spell_id} value={r.spell_id}>
                {r.name}{r.mastered === false ? ' — не освоєне' : ''}
              </option>
            ))}
          </select>
          {castable.length === 0 && (
            <p className="mt-1 text-xs text-text-dim">Жодного доступного бойового заклинання немає.</p>
          )}
        </Field>

        {row && tiers.length > 1 && (
          <Field label="Форма">
            <select className={inputClass} value={tier} onChange={(e) => setTier(e.target.value)}>
              {allowedTiers.map((t) => (
                <option key={t} value={t}>{TIER_LABELS[t] ?? t}</option>
              ))}
            </select>
          </Field>
        )}

        {row && skillOptions.length > 1 && (
          <Field label="Навичка чарування">
            <select className={inputClass} value={skillKey} onChange={(e) => setSkillKey(e.target.value)}>
              {skillOptions.map((k) => (
                <option key={k} value={k}>{k === 'spellcasting' ? 'Чарування' : k}</option>
              ))}
            </select>
          </Field>
        )}

        {row && (
          <Field label="Цілі" hint="Можна обрати декілька">
            <div className="flex flex-col gap-1">
              {targets.filter((t) => t.id !== caster.id).map((t) => (
                <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
                  <input
                    type="checkbox"
                    checked={targetIds.includes(t.id)}
                    onChange={() => toggleTarget(t.id)}
                  />
                  {t.name}{t.reaction_reserved ? ' (тримає реакцію)' : ''}
                </label>
              ))}
            </div>
          </Field>
        )}

        {row && (
          <p className="text-xs text-text-dim">
            Енергія: {form.energy_cost}{energyPreview ? ` · ${energyPreview}` : ''}
            {form.damage_die ? ` · шкода ${form.damage_dice_count > 1 ? form.damage_dice_count : ''}${form.damage_die}` : ' · без шкоди'}
          </p>
        )}

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}

        {results ? <CastResult results={results} onClose={onClose} /> : (
          <Button onClick={handleCast} disabled={!canCast}>
            {busy || rolling ? 'Кидаємо…' : 'Кастувати'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// Розбір результату каста для кожної цілі — той самий формат, що й AttackResult.
function CastResult({ results, onClose }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-text-dim">
        Витрачено енергії: {results.energy.spent} ({results.energy.magic_before} → {results.energy.magic_after})
      </p>
      {results.per_target.map((pt) => {
        const o = pt.outcome;
        return (
          <div key={pt.target_id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-bg p-3 text-sm">
            <p className="font-semibold text-text">{pt.target?.name ?? 'Ціль'}</p>
            <p className={o.hit ? 'font-semibold text-sage' : 'font-semibold text-danger'}>
              {o.natural20 && 'Натуральна 20 — '}
              {o.natural1 && 'Натуральна 1 — '}
              {o.hit ? 'Влучання' : o.outcome === 'tie' ? 'Промах урівень із захистом' : 'Промах'}
            </p>
            <p className="text-text-muted">
              Влучання {o.total} ({results.hitFormula}) проти захисту {o.total_defense}
              {pt.dodge && ` (ухилення ${pt.dodge.rolled})`}
            </p>
            {o.wear > 0 && (
              <p className="text-text-muted">Зношування −{o.wear}: пасивний захист {o.passive_before} → {o.passive_after}</p>
            )}
            {o.hit && results.damageFormula && (
              <p className="text-text-muted">
                Шкода {o.damage} ({results.damageFormula}) − поглинуто {o.absorbed} = <strong className="text-text">{o.hp_damage}</strong> ХП
              </p>
            )}
            {pt.sheet?.massive && <p className="font-semibold text-danger">Масивна шкода: ціль падає з одним провалом</p>}
            {pt.sheet?.fell && !pt.sheet?.massive && <p className="font-semibold text-danger">Ціль непритомна</p>}
            {pt.sheet?.trauma_suggested && (
              <p className="font-semibold text-gold">
                Удар від половини максимуму здоровʼя — майстер може додати рівень Травми
              </p>
            )}
          </div>
        );
      })}
      {results.notes?.length > 0 && <p className="text-xs text-text-dim">Перешкода: {results.notes.join(', ')}</p>}
      <Button variant="ghost" onClick={onClose}>Закрити</Button>
    </div>
  );
}
