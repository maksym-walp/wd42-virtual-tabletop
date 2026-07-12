const { tokenize } = require('./tokenizer');
const { parse } = require('./parser');
const { evaluate } = require('./evaluator');
const { FormulaError } = require('./errors');

const MAX_TERMS = 20;
const MAX_TOTAL_DICE = 500;
const DICE_MULTIPLIER = { adv: 2, dis: 2, wadv: 3, wdis: 3 };

function countDice(terms) {
  return terms.reduce((sum, { node }) => {
    if (node.kind === 'modifier') return sum;
    const perDie = node.kind === 'dice' ? 1 : DICE_MULTIPLIER[node.mode];
    return sum + node.count * perDie;
  }, 0);
}

function rollFormula(formulaString) {
  if (typeof formulaString !== 'string' || !formulaString.trim()) {
    throw new FormulaError('Формула не може бути порожньою');
  }

  const tokens = tokenize(formulaString);
  const terms = parse(tokens);

  if (terms.length > MAX_TERMS) {
    throw new FormulaError(`Забагато доданків у формулі (максимум ${MAX_TERMS})`);
  }
  if (countDice(terms) > MAX_TOTAL_DICE) {
    throw new FormulaError(`Забагато кубиків у формулі (максимум ${MAX_TOTAL_DICE})`);
  }

  const { groups, total } = evaluate(terms);
  return { formula: formulaString, total, groups };
}

module.exports = { rollFormula, FormulaError };
