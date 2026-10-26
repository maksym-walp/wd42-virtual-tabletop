// Розкладка стрічки подій (вкладка «Події» хронології) по рядках CSS-сітки.
//
// Стрічка не лінійна в днях (між подіями століття — рядок лишається рядком), а
// впорядкована: кожна відмітка часу (початок або кінець події) — окремий рядок,
// події з однаковою відміткою ділять рядок. Тривала подія розтягується від
// рядка свого початку до рядка кінця й тому «накриває» все, що сталося за цей
// час.
//
// У широкому макеті 4 колонки — по дві з кожного боку осі (зліва направо: 1, 2
// | вісь | 3, 4), і кожен вид події має свою:
//   1 — повторювані,  2 — тривалі,  3 — без тривалості й повторень,
//   4 — події не з основного календаря.
// Подія за замовчуванням займає ширину обох колонок свого боку; якщо в цей час
// сусідня колонка зайнята, вона стискається до своєї. Якщо власна колонка
// зайнята (дві тривалі події водночас), подія переходить у найближчу вільну.
// У вузькому — одна колонка й без розтягування (як звичайний список).
//
// items — у порядку подачі: { id, start, end, labelStart, labelEnd, recurring,
// foreign }, де start — ключ на світовій осі (Infinity — без дати), end — ключ
// кінця або null, label* — підпис року, під яким стоїть відмітка. desc — стрічка
// «нові → давні»: тоді тривала подія починається (зверху) з кінця й тягнеться до
// початку.
//
// Повертає { labelRows: [{ row, label }], placements: Map(id → { col, colStart,
// colEnd, side, first, last, cardStart, cardEnd, span, displaced }) } — номери
// рядків 1-базні; колонки 1–4 (colStart..colEnd включно); last/cardEnd —
// виключно (рядок після останнього); first/last — рядки відміток початку/кінця
// на осі (за напрямком стрічки), cardStart/cardEnd — де стоїть картка. Якщо
// вільної колонки в рядку немає, картка зсувається нижче (displaced), а
// відмітки на осі лишаються на своїх місцях.

// Колонки за близькістю до «своєї» (перша — власна).
const FALLBACK = { 1: [1, 2, 3, 4], 2: [2, 1, 3, 4], 3: [3, 4, 2, 1], 4: [4, 3, 2, 1] };
const MATE = { 1: 2, 2: 1, 3: 4, 4: 3 };

export function layoutTimeline(items, { desc = false, wide = true } = {}) {
  const cols = wide ? [1, 2, 3, 4] : [1];

  const entries = items.map((it, order) => {
    const span = wide && Number.isFinite(it.start) && it.end != null && it.end > it.start;
    return {
      it,
      order,
      span,
      first: desc && span ? it.end : it.start,
      last: span ? (desc ? it.start : it.end) : null,
      labelFirst: desc && span ? it.labelEnd : it.labelStart,
      labelLast: desc ? it.labelStart : it.labelEnd,
    };
  });

  // У порядку появи на стрічці; без дати — в кінці в порядку подачі.
  const dated = entries.filter((e) => Number.isFinite(e.first));
  const undated = entries.filter((e) => !Number.isFinite(e.first));
  dated.sort((a, b) => (desc ? b.first - a.first : a.first - b.first) || a.order - b.order);

  let row = 0;
  let prevLabel = null;
  const labelRows = [];
  const labelRow = (label) => {
    if (label === prevLabel) return;
    prevLabel = label;
    labelRows.push({ row: ++row, label });
  };

  if (wide) {
    // Відмітки з однаковим ключем ділять рядок.
    const labelOfKey = new Map();
    for (const e of dated) if (!labelOfKey.has(e.first)) labelOfKey.set(e.first, e.labelFirst);
    for (const e of dated) if (e.last != null && !labelOfKey.has(e.last)) labelOfKey.set(e.last, e.labelLast);
    const keys = [...labelOfKey.keys()].sort((a, b) => (desc ? b - a : a - b));
    const rowOf = new Map();
    for (const key of keys) {
      labelRow(labelOfKey.get(key));
      rowOf.set(key, ++row);
    }
    for (const e of dated) {
      e.firstRow = rowOf.get(e.first);
      e.lastRow = e.last != null ? rowOf.get(e.last) : null;
    }
  } else {
    for (const e of dated) {
      labelRow(e.labelFirst);
      e.firstRow = ++row;
    }
  }
  if (undated.length) {
    labelRow('Без дати');
    for (const e of undated) e.firstRow = ++row;
  }

  const ordered = [...dated, ...undated];
  const colLast = Object.fromEntries(cols.map((c) => [c, 0])); // останній зайнятий рядок
  const placements = new Map();

  for (const e of ordered) {
    const trueEnd = e.span ? e.lastRow : e.firstRow + 1;
    // Власна колонка за видом події (у вузькому макеті — єдина).
    const own = !wide ? 1 : e.it.foreign ? 4 : e.it.recurring ? 1 : e.span ? 2 : 3;
    const order = wide ? FALLBACK[own] : [1];
    let start = e.firstRow;
    let free = order.filter((c) => colLast[c] < start);
    if (!free.length) {
      start = Math.min(...cols.map((c) => colLast[c])) + 1;
      free = order.filter((c) => colLast[c] < start);
    }
    const col = free[0];
    const cardEnd = Math.max(trueEnd, start + 1);
    colLast[col] = cardEnd - 1;
    placements.set(e.it.id, {
      col, colStart: col, colEnd: col,
      side: wide && col > 2 ? 'right' : 'left',
      first: e.firstRow,
      last: e.span ? e.lastRow : null,
      cardStart: start,
      cardEnd,
      span: e.span,
      displaced: start !== e.firstRow,
    });
  }

  // Ширина двох колонок: подія займає й сусідню колонку свого боку, якщо в її
  // рядках там нічого немає.
  if (wide) {
    const all = [...placements.values()];
    for (const p of all) {
      const mate = MATE[p.col];
      const clash = all.some((q) => q !== p && q.col === mate && q.cardStart < p.cardEnd && p.cardStart < q.cardEnd);
      if (!clash) {
        p.colStart = Math.min(p.col, mate);
        p.colEnd = Math.max(p.col, mate);
      }
    }
  }

  return { labelRows, placements, rowCount: row };
}
