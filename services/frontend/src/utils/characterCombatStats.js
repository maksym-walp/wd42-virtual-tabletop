import { ARCHETYPES, CHARACTERISTICS, PHYSIQUE_HEALTH, skillsToCharLevel } from '../constants/characterSheet';

// Максимальне ХП = сума "активних" кубиків здоров'я (перші maxDiceCount -
// totalCondLevel із набутих кубиків), де maxDiceCount залежить від рівня
// Тілобудови. Той самий розрахунок, що на сторінці персонажа
// (CharacterSheet.jsx), винесений сюди для Бойової сцени — щоб не
// дублювати формулу під час підтягування статів гравця в трекер.
export function computeMaxHp(character, skills) {
  const skillMap = Object.fromEntries((skills ?? []).map((s) => [s.skill_key, s]));
  const physique = CHARACTERISTICS.find((ch) => ch.key === 'physique');
  const physiqueLevel = skillsToCharLevel(physique.skills.map((s) => skillMap[s.key]?.value ?? 1));
  const maxDiceCount = PHYSIQUE_HEALTH[physiqueLevel] ?? 6;
  const totalCondLevel = (character.conditions ?? []).reduce((sum, cond) => sum + (cond.level || 0), 0);
  const activeDice = (character.health_dice_values ?? []).slice(0, Math.max(0, maxDiceCount - totalCondLevel));
  return activeDice.reduce((sum, v) => sum + v, 0);
}

// Пасивний захист = захист ОДЯГНЕНОГО обладунку (лише один може бути
// is_equipped) + ручний модифікатор; factor — effects.passive_defense_factor
// (Травма 3+: половина, угору).
export function computePassiveDefense(equipment, defenseBonus = 0, factor = 1) {
  const armorDefense = (equipment ?? []).reduce((sum, e) => (
    e.item?.type === 'armor' && e.is_equipped ? sum + (e.item.defense_value || 0) : sum
  ), 0);
  return Math.ceil((armorDefense + (defenseBonus ?? 0)) * (factor ?? 1));
}

// Максимальна магічна енергія = Чуття магії × множник архетипу — той самий
// розрахунок, що на сторінці персонажа (CharacterSheet.jsx), для Ширми майстра.
// Якщо є блок effects листа — його ефективний максимум (Хвороба ≥3 — половина).
export function computeMaxMagic(character, skills, effects) {
  if (effects?.max_magic_effective != null) return effects.max_magic_effective;
  const magicSense = (skills ?? []).find((s) => s.skill_key === 'magic_sense')?.value ?? 1;
  return magicSense * (ARCHETYPES[character.archetype]?.magicMult ?? 0);
}
