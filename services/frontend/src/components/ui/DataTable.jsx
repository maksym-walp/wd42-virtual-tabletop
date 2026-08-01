import { Link } from 'react-router-dom';

// Generic table view paired with ViewToggle — every catalog list page (weapon/
// armor/item, artifacts, abilities, maneuvers, spells, compendium entries/
// species) shares this one component instead of hand-rolling its own <table>,
// so row hover, borders and header style read identically everywhere. Each
// page supplies its own column defs; a column opts into click-to-sort by
// providing `sortKey` — sort affordances only render when the caller also
// passes `onSort`, so tables with no server-side sort (or that sort via a
// separate control, like Spellbook's dropdown) just get plain headers.
//
// A row normally navigates to a detail page: pass `getHref` and the first
// column renders as a `<Link>`. Some lists have no detail page and instead
// open an in-place editor (e.g. LocationLibrary's Sheet) — pass `onRowClick`
// instead and the whole `<tr>` becomes clickable, with the first column
// styled to read as a link without actually being an anchor.
export default function DataTable({ items, columns, getHref, getKey, onRowClick, sort, dir, onSort }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr>
            {columns.map((col) => (
              <Th key={col.key} label={col.label} sortKey={col.sortKey} sort={sort} dir={dir} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={getKey(item)}
              className={`hover:bg-surface-hover ${onRowClick ? 'cursor-pointer' : ''}`}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col, i) => (
                <td key={col.key} className="border-b border-bg px-3 py-2 text-text-muted">
                  {i === 0 && getHref ? (
                    <Link to={getHref(item)} className="text-accent hover:underline">
                      {col.render(item)}
                    </Link>
                  ) : i === 0 && onRowClick ? (
                    <span className="font-semibold text-accent">{col.render(item)}</span>
                  ) : col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ label, sortKey, sort, dir, onSort }) {
  if (!sortKey || !onSort) {
    return (
      <th className="whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim">
        {label}
      </th>
    );
  }
  const active = sort === sortKey;
  return (
    <th
      className="cursor-pointer select-none whitespace-nowrap border-b border-border px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-text-dim hover:text-text"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-accent">{dir === 'desc' ? '↓' : '↑'}</span>}
      </span>
    </th>
  );
}
