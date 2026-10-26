// Розкладка стрічки подій (вкладка «Події» хронології) по рядках CSS-сітки.
//
// Стрічка не лінійна в днях (між подіями століття — рядок лишається рядком), а
// впорядкована: кожна відмітка часу (початок або кінець події) — окремий рядок,
// події з однаковою відміткою ділять рядок. Тривала подія розтягується від
// рядка свого початку до рядка кінця й тому «накриває» все, що сталося за цей
// час. Щоб події, які відбуваються одночасно, не накладались, у широкому макеті
// є 4 доріжки — по дві з кожного боку осі (L1/R1 ближчі до неї, L2/R2 дальші).
// У вузькому — одна доріжка й без розтягування (як звичайний список).
//
// items — у порядку подачі: { id, start, end, labelStart, labelEnd }, де start —
// ключ на світовій осі (Infinity — без дати), end — ключ кінця або null,
// label* — підпис року, під яким стоїть відмітка. desc — стрічка «нові → давні»:
// тоді тривала подія починається (зверху) з кінця й тягнеться до початку.
//
// Повертає { labelRows: [{ row, label }], placements: Map(id → { lane, side,
// first, last, cardStart, cardEnd, span, displaced }) } — номери рядків
// 1-базні; last/cardEnd — виключно (рядок після останнього); first/last — рядки
// відміток початку/кінця на осі (за напрямком стрічки), cardStart/cardEnd — де
// стоїть картка. Якщо вільної доріжки в рядку немає, картка зсувається нижче
// (displaced), а відмітки на осі лишаються на своїх місцях.

const LANES_WIDE = ['L1', 'R1', 'L2', 'R2'];
const LANES_NARROW = ['L1'];

export function layoutTimeline(items, { desc = false, wide = true } = {}) {
  const lanes = wide ? LANES_WIDE : LANES_NARROW;

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
  const laneLast = Object.fromEntries(lanes.map((l) => [l, 0])); // останній зайнятий рядок
  let lastSide = 'R'; // перша картка піде ліворуч
  const placements = new Map();

  for (const e of ordered) {
    const trueEnd = e.span ? e.lastRow : e.firstRow + 1;
    let start = e.firstRow;
    let free = lanes.filter((l) => laneLast[l] < start);
    if (!free.length) {
      start = Math.min(...lanes.map((l) => laneLast[l])) + 1;
      free = lanes.filter((l) => laneLast[l] < start);
    }
    const inner = free.filter((l) => l.endsWith('1'));
    const pool = inner.length ? inner : free;
    const opposite = lastSide === 'L' ? 'R' : 'L';
    const lane = pool.find((l) => l[0] === opposite) || pool[0];
    lastSide = lane[0];

    const cardEnd = Math.max(trueEnd, start + 1);
    laneLast[lane] = cardEnd - 1;
    placements.set(e.it.id, {
      lane,
      side: lane[0] === 'L' ? 'left' : 'right',
      first: e.firstRow,
      last: e.span ? e.lastRow : null,
      cardStart: start,
      cardEnd,
      span: e.span,
      displaced: start !== e.firstRow,
    });
  }

  return { labelRows, placements, rowCount: row };
}
