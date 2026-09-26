import { Link } from 'react-router-dom';
import { SPELL_COMPLEXITIES } from '../constants/spellbook';

// Дерево заклинань лише для перегляду: у кожного максимум одне батьківське
// («Потрібно вивчити») і скільки завгодно похідних. nodes — плоский список
// з GET /api/spellbook/:id/tree ({ id, name, parent_spell_id, complexity,
// level_count }), корінь — вузол з parent_spell_id = null.
export default function SpellTree({ nodes, currentId }) {
  const children = new Map();
  for (const n of nodes) {
    const key = n.parent_spell_id ?? null;
    if (!children.has(key)) children.set(key, []);
    children.get(key).push(n);
  }
  const roots = children.get(null) || [];

  return (
    <ul className="flex flex-col gap-1">
      {roots.map((n) => <TreeNode key={n.id} node={n} childrenMap={children} currentId={currentId} />)}
    </ul>
  );
}

function TreeNode({ node, childrenMap, currentId }) {
  const kids = childrenMap.get(node.id) || [];
  const isCurrent = node.id === currentId;
  const meta = [
    SPELL_COMPLEXITIES[node.complexity]?.label,
    node.level_count > 1 ? `рівнів: ${node.level_count}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <li>
      <div
        className={`inline-flex flex-wrap items-baseline gap-x-2 rounded border px-2.5 py-1 text-sm ${
          isCurrent ? 'border-accent bg-accent/10 font-semibold text-accent' : 'border-border text-text'
        }`}
      >
        {isCurrent ? node.name : (
          <Link to={`/spellbook/${node.id}`} className="text-accent hover:underline">{node.name}</Link>
        )}
        {meta && <span className="text-xs font-normal text-text-dim">{meta}</span>}
      </div>
      {kids.length > 0 && (
        <ul className="ml-3 mt-1 flex flex-col gap-1 border-l border-border pl-4">
          {kids.map((k) => <TreeNode key={k.id} node={k} childrenMap={childrenMap} currentId={currentId} />)}
        </ul>
      )}
    </li>
  );
}
