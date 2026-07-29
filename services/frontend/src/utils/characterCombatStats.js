import { CHARACTERISTICS, PHYSIQUE_HEALTH, skillsToCharLevel } from '../constants/characterSheet';

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
  const activeDice = (character.health_dice_values ?? []).slice(0, maxDiceCount - totalCondLevel);
  return activeDice.reduce((sum, v) => sum + v, 0);
}

// Пасивний захист = захист ОДЯГНЕНОГО обладунку (лише один може бути
// is_equipped) + ручний модифікатор.
export function computePassiveDefense(equipment, defenseBonus = 0) {
  const armorDefense = (equipment ?? []).reduce((sum, e) => (
    e.item?.type === 'armor' && e.is_equipped ? sum + (e.item.defense_value || 0) : sum
  ), 0);
  return armorDefense + (defenseBonus ?? 0);
}
