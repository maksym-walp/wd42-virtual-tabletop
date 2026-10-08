// Операції з гаманцем персонажа (money — плоский обʼєкт { ключ номіналу: к-сть }).
// currencies — пари з конфігу: { convertible, rate, high: { key }, low: { key } }.
// Повертає { ok: true, money } з НОВИМ обʼєктом або { ok: false, error }.

function findPair(currencies, denomKey) {
  for (const pair of currencies) {
    if (pair.high.key === denomKey) return { pair, side: 'high' };
    if (pair.low.key === denomKey) return { pair, side: 'low' };
  }
  return null;
}

const count = (money, key) => Math.max(0, Math.floor(Number(money?.[key]) || 0));

function add(money, denomKey, amount) {
  return { ok: true, money: { ...money, [denomKey]: count(money, denomKey) + amount } };
}

// Списання з автоматичним розміном у межах конвертованої пари: достатність
// рахується по всій парі в молодших одиницях. Спершу витрачаються монети
// обраного номіналу; нестачу молодших покриває розмін найменшої потрібної
// кількості старших, а нестачу старших — молодші за курсом.
function subtract(money, currencies, denomKey, amount) {
  const found = findPair(currencies, denomKey);
  const own = count(money, denomKey);

  if (!found || !found.pair.convertible) {
    if (own < amount) return { ok: false, error: 'Недостатньо коштів' };
    return { ok: true, money: { ...money, [denomKey]: own - amount } };
  }

  const { pair, side } = found;
  const rate = pair.rate;
  const high = count(money, pair.high.key);
  const low = count(money, pair.low.key);
  const costInLow = side === 'high' ? amount * rate : amount;
  if (high * rate + low < costInLow) return { ok: false, error: 'Недостатньо коштів' };

  let nextHigh = high;
  let nextLow = low;
  if (side === 'low') {
    if (low >= amount) {
      nextLow = low - amount;
    } else {
      const breakHigh = Math.ceil((amount - low) / rate);
      nextHigh = high - breakHigh;
      nextLow = low + breakHigh * rate - amount;
    }
  } else if (high >= amount) {
    nextHigh = high - amount;
  } else {
    nextHigh = 0;
    nextLow = low - (amount - high) * rate;
  }
  return { ok: true, money: { ...money, [pair.high.key]: nextHigh, [pair.low.key]: nextLow } };
}

// Обмін усередині конвертованої пари: amount — кількість монет, які
// віддаються з номіналу fromKey.
function exchange(money, currencies, fromKey, amount) {
  const found = findPair(currencies, fromKey);
  if (!found || !found.pair.convertible) return { ok: false, error: 'Цей номінал не обмінюється' };
  const { pair, side } = found;
  const rate = pair.rate;
  const have = count(money, fromKey);
  if (have < amount) return { ok: false, error: 'Недостатньо коштів' };

  if (side === 'high') {
    return {
      ok: true,
      money: { ...money, [pair.high.key]: have - amount, [pair.low.key]: count(money, pair.low.key) + amount * rate },
    };
  }
  if (amount % rate !== 0) {
    return { ok: false, error: `Обмінюється лише кратно ${rate} (${rate} ${pair.low.name} = 1 ${pair.high.name})` };
  }
  return {
    ok: true,
    money: { ...money, [pair.low.key]: have - amount, [pair.high.key]: count(money, pair.high.key) + amount / rate },
  };
}

// op: { type: 'add' | 'subtract' | 'exchange', denom, amount }
export function applyMoneyOperation(money, op, currencies) {
  const amount = Number(op.amount);
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Вкажіть ціле число більше нуля' };
  if (!op.denom) return { ok: false, error: 'Оберіть валюту' };

  if (op.type === 'add') return add(money ?? {}, op.denom, amount);
  if (op.type === 'subtract') return subtract(money ?? {}, currencies, op.denom, amount);
  if (op.type === 'exchange') return exchange(money ?? {}, currencies, op.denom, amount);
  return { ok: false, error: 'Невідома операція' };
}

// Інший номінал пари — куди піде обмін.
export function counterpart(currencies, denomKey) {
  const found = findPair(currencies, denomKey);
  if (!found) return null;
  return found.side === 'high' ? found.pair.low : found.pair.high;
}
