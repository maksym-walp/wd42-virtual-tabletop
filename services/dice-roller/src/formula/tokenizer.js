const { FormulaError } = require('./errors');

const KEYWORD_RE = /^(wadv|wdis|adv|dis)\b/i;
const DICE_RE = /^(\d+)d(\d+)/i;
const INT_RE = /^(\d+)/;

// Tokenizes a dice formula like "2d20+1d8+adv(1d10)-5" into a flat token
// stream. Scans left to right so an unrecognized character can be reported
// with its exact position rather than failing silently.
function tokenize(formula) {
  const tokens = [];
  let i = 0;
  const n = formula.length;

  while (i < n) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === '(' || ch === ')' || ch === '+' || ch === '-') {
      tokens.push({ type: ch });
      i += 1;
      continue;
    }

    const rest = formula.slice(i);

    const kwMatch = KEYWORD_RE.exec(rest);
    if (kwMatch) {
      tokens.push({ type: 'mod', value: kwMatch[1].toLowerCase() });
      i += kwMatch[1].length;
      continue;
    }

    const diceMatch = DICE_RE.exec(rest);
    if (diceMatch) {
      tokens.push({
        type: 'dice',
        count: parseInt(diceMatch[1], 10),
        sides: parseInt(diceMatch[2], 10),
      });
      i += diceMatch[0].length;
      continue;
    }

    const intMatch = INT_RE.exec(rest);
    if (intMatch) {
      tokens.push({ type: 'int', value: parseInt(intMatch[1], 10) });
      i += intMatch[0].length;
      continue;
    }

    throw new FormulaError(`Невідомий символ у формулі: "${ch}"`);
  }

  return tokens;
}

module.exports = { tokenize };
