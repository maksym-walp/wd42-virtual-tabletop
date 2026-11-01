// Повторення дій (розділ 4.10): друга однакова дія за хід — з перешкодою,
// третя — з подвійною. Кожен тип дії має свій архетип-виняток: бійцю не
// рахуються повторення атак, чаклуну — повторення чарування (пройдисвіт
// винятків не має).
//
// Архетип приходить у блоці персонажа з GET /api/characters/effects; у НІПа
// його немає — вони повторень не уникають.

export function repeatAttackDisadvantage(previousAttacks, archetype) {
  if (archetype === 'fighter') return null;
  if (previousAttacks >= 2) return 'wdis';
  if (previousAttacks === 1) return 'dis';
  return null;
}

export function repeatCastDisadvantage(previousCasts, archetype) {
  if (archetype === 'spellcaster') return null;
  if (previousCasts >= 2) return 'wdis';
  if (previousCasts === 1) return 'dis';
  return null;
}
