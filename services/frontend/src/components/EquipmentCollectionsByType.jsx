import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import DiceFormulaText from './DiceFormulaText';

// Equipment's Колекції tab groups collections by which type-table their
// items belong to (see EquipmentCatalog.jsx / /equipment/weapon|armor|items|
// artifacts) — but a collection isn't restricted to one type (a "starter kit"
// can hold a sword AND armor AND a rope, see equipment/collection.model.js),
// so a collection only lands in a pure type row when every item it holds is
// that one type. Anything spanning more than one type (or with no items yet)
// falls into "Комбіновані" instead of silently vanishing from every row —
// pinned first since it's the most common case in practice (most collections
// aren't type-pure) and shouldn't require scrolling past every row to reach.
const SECTIONS = [
  { key: 'mixed', label: 'Комбіновані' },
  { key: 'weapon', label: 'Зброя' },
  { key: 'armor', label: 'Обладунок' },
  { key: 'item', label: 'Предмет' },
  { key: 'artifact', label: 'Артефакти' },
];

function classify(collections) {
  const buckets = { weapon: [], armor: [], item: [], artifact: [], mixed: [] };
  for (const c of collections) {
    const types = new Set((c.items || []).map((i) => i.type));
    const [only] = types;
    const bucket = types.size === 1 && buckets[only] ? only : 'mixed';
    buckets[bucket].push(c);
  }
  return buckets;
}

export default function EquipmentCollectionsByType({ collections, basePath }) {
  const buckets = classify(collections);
  return (
    <div className="flex flex-col gap-5">
      {SECTIONS.map(({ key, label }) => (
        <CollectionsScrollRow key={key} label={label} collections={buckets[key]} basePath={basePath} />
      ))}
    </div>
  );
}

function CollectionsScrollRow({ label, collections, basePath }) {
  const [open, setOpen] = useState(true);
  if (collections.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-text-dim hover:text-accent"
      >
        <ChevronDown size={15} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        {label}
        <span className="font-normal normal-case text-text-dim">({collections.length})</span>
      </button>

      {open && (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`${basePath}/collections/${c.id}`}
              className="block w-64 shrink-0 overflow-hidden rounded-lg border border-border bg-surface"
              style={{ borderLeft: '4px solid var(--color-accent)' }}
            >
              {c.image_url && (
                <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
                  <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="flex items-center gap-1.5 border-b border-border px-3.5 py-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">
                  {(c.items || []).length} предметів
                </span>
              </div>
              <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{c.name}</h3>
              {!c.image_url && c.description && (
                <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">
                  <DiceFormulaText text={c.description} />
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
