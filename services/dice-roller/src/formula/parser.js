const { FormulaError } = require('./errors');

const MIN_SIDES = 2;
const MAX_SIDES = 1000;
const MAX_COUNT_PER_GROUP = 100;

function validateDice(count, sides) {
  if (sides < MIN_SIDES) {
    throw new FormulaError(`Кубик має мати щонайменше ${MIN_SIDES} граней (отримано d${sides})`);
  }
  if (sides > MAX_SIDES) {
    throw new FormulaError(`Кубик занадто великий (максимум d${MAX_SIDES})`);
  }
  if (count < 1) {
    throw new FormulaError('Кількість кубиків має бути щонайменше 1');
  }
  if (count > MAX_COUNT_PER_GROUP) {
    throw new FormulaError(`Забагато кубиків в одній групі (максимум ${MAX_COUNT_PER_GROUP})`);
  }
}

// Formula      := Signed ( ('+' | '-') Signed )*
// Signed       := ('-')? Term
// Term         := WrappedGroup | DiceGroup | Integer
// DiceGroup    := Integer 'd' Integer        (N can be > 1)
// WrappedGroup := ('adv'|'dis'|'wadv'|'wdis') '(' DiceGroup ')'
function parseTerm(tokens, pos) {
  const tok = tokens[pos];
  if (!tok) throw new FormulaError('Неочікуваний кінець формули');

  if (tok.type === 'mod') {
    const mode = tok.value;
    let next = pos + 1;
    if (tokens[next]?.type !== '(') {
      throw new FormulaError(`Очікувалась "(" після "${mode}"`);
    }
    next += 1;
    const diceTok = tokens[next];
    if (diceTok?.type !== 'dice') {
      throw new FormulaError(`Всередині ${mode}(...) очікується запис виду NdM`);
    }
    next += 1;
    if (tokens[next]?.type !== ')') {
      throw new FormulaError(`Очікувалась ")" після ${mode}(${diceTok.count}d${diceTok.sides})`);
    }
    next += 1;
    validateDice(diceTok.count, diceTok.sides);
    return {
      node: { kind: 'wrapped', mode, count: diceTok.count, sides: diceTok.sides },
      nextPos: next,
    };
  }

  if (tok.type === 'dice') {
    validateDice(tok.count, tok.sides);
    return { node: { kind: 'dice', count: tok.count, sides: tok.sides }, nextPos: pos + 1 };
  }

  if (tok.type === 'int') {
    return { node: { kind: 'modifier', value: tok.value }, nextPos: pos + 1 };
  }

  throw new FormulaError('Неочікуваний символ у формулі');
}

function parse(tokens) {
  if (tokens.length === 0) throw new FormulaError('Формула не може бути порожньою');

  const terms = [];
  let pos = 0;
  let sign = 1;

  if (tokens[pos]?.type === '+') {
    pos += 1;
  } else if (tokens[pos]?.type === '-') {
    sign = -1;
    pos += 1;
  }

  while (true) {
    const { node, nextPos } = parseTerm(tokens, pos);
    terms.push({ sign, node });
    pos = nextPos;

    if (pos >= tokens.length) break;

    const opTok = tokens[pos];
    if (opTok.type === '+') {
      sign = 1;
    } else if (opTok.type === '-') {
      sign = -1;
    } else {
      throw new FormulaError('Очікувався "+" або "-" між доданками формули');
    }
    pos += 1;
  }

  return terms;
}

module.exports = { parse };
