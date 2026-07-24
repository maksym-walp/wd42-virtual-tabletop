import { Link } from 'react-router-dom';

// Generic table view paired with ViewToggle — each catalog list page supplies
// its own column defs (first column becomes the row's link to the detail page).
export default function DataTable({ items, columns, getHref, getKey }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-bg text-left text-xs uppercase tracking-wide text-text-dim">
            {columns.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-3 py-2 font-semibold">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={getKey(item)} className="border-b border-border last:border-0 hover:bg-bg">
              {columns.map((col, i) => (
                <td key={col.key} className="whitespace-nowrap px-3 py-2">
                  {i === 0 ? (
                    <Link to={getHref(item)} className="font-semibold text-accent hover:underline">
                      {col.render(item)}
                    </Link>
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
