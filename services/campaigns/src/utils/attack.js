// Арифметика атаки (розділ 4.4 книги правил). Чистий модуль без БД:
// кубики кидає клієнт через dice-roller (щоб гравець бачив розбивку й кидок
// потрапив у його історію), а сюди приходять уже готові числа.
//
// Наслідки для ЛИСТА персонажа (поточний максимум здоровʼя, Травма, масивна
// шкода, шкала смерті) рахує не тут, а character-sheet — у нього єдине
// джерело цих правил. Тут лише те, що лежить на комбатантові: захист,
// зношування й те, скільки шкоди пройшло крізь нього.

const toInt = (v) => Math.trunc(Number(v) || 0);
const atLeastZero = (v) => Math.max(0, toInt(v));

// Крок 1-2: влучання й зношування захисту.
//   total — результат кидка влучання (T), natural — що випало саме на d20.
// → { total_defense, hit, wear, passive_after, outcome }
function resolveHit({ total, natural, passive_defense, active_defense }) {
  const T = toInt(total);
  const passive = atLeastZero(passive_defense);
  const active = atLeastZero(active_defense);
  const total_defense = passive + active;

  const natural20 = toInt(natural) === 20;
  const natural1 = toInt(natural) === 1;

  // Натуральна 20 влучає завжди, навіть якщо захист не перебито;
  // натуральна 1 завжди промахується (4.4.1).
  let hit;
  let outcome;
  if (natural1) { hit = false; outcome = 'natural_miss'; }
  else if (natural20) { hit = true; outcome = 'natural_hit'; }
  else if (T > total_defense) { hit = true; outcome = 'hit'; }
  else if (T === total_defense) { hit = false; outcome = 'tie'; }
  else { hit = false; outcome = 'miss'; }

  // Рівно захист — промах, але пасивний захист цілі знижується на 1.
  // Влучання зношує на різницю W = T − G (4.4.2); активний захист і
  // особливі умови не зношуються.
  let wear = 0;
  if (outcome === 'tie') wear = 1;
  else if (hit) wear = atLeastZero(T - total_defense);

  return {
    total: T,
    total_defense,
    passive_before: passive,
    active_defense: active,
    natural20,
    natural1,
    hit,
    outcome,
    wear,
    passive_after: Math.max(0, passive - wear),
  };
}

// Крок 3: шкода. Порівнюється з пасивним захистом, УЖЕ зношеним на
// попередньому кроці; активний захист на поглинання не впливає (4.4.3).
function resolveDamage({ damage, passive_after }) {
  const rolled = atLeastZero(damage);
  const absorbed = Math.min(rolled, atLeastZero(passive_after));
  return { damage: rolled, absorbed, hp_damage: rolled - absorbed };
}

// Повний крок атаки одним викликом — зручно для контролера й тесту.
function resolveAttack({ total, natural, passive_defense, active_defense, damage }) {
  const hit = resolveHit({ total, natural, passive_defense, active_defense });
  const dmg = hit.hit
    ? resolveDamage({ damage, passive_after: hit.passive_after })
    : { damage: 0, absorbed: 0, hp_damage: 0 };
  return { ...hit, ...dmg };
}

module.exports = { resolveHit, resolveDamage, resolveAttack };
