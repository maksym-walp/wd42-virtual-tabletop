import { useState } from 'react';
import { inputClass } from './ui/Field';

// value: { prerequisite_node_ids: string[], prerequisite_logic: 'and' | 'or' }
export default function NodePrerequisitePicker({ nodes, value, onChange }) {
  const [search, setSearch] = useState('');

  const selectedIds = value.prerequisite_node_ids || [];
  const selectedNodes = selectedIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean);

  const available = nodes.filter(
    (n) => !selectedIds.includes(n.id) && n.title?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleNode = (nodeId) => {
    onChange({
      ...value,
      prerequisite_node_ids: selectedIds.includes(nodeId)
        ? selectedIds.filter((id) => id !== nodeId)
        : [...selectedIds, nodeId],
    });
  };

  const setLogic = (logic) => onChange({ ...value, prerequisite_logic: logic });

  return (
    <div className="flex flex-col gap-3">
      {selectedNodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedNodes.map((n) => (
            <span
              key={n.id}
              className="flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-text"
            >
              {n.title}
              <button type="button" onClick={() => toggleNode(n.id)} className="text-text-dim hover:text-danger">
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {selectedNodes.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-dim">Умова:</span>
          <button
            type="button"
            onClick={() => setLogic('or')}
            className={`rounded px-2 py-1 ${value.prerequisite_logic === 'or' ? 'bg-accent/15 text-accent' : 'text-text-dim'}`}
          >
            АБО — достатньо одного
          </button>
          <button
            type="button"
            onClick={() => setLogic('and')}
            className={`rounded px-2 py-1 ${value.prerequisite_logic === 'and' ? 'bg-sage/15 text-sage' : 'text-text-dim'}`}
          >
            І — потрібні всі
          </button>
        </div>
      )}

      <input
        type="text"
        className={`${inputClass} text-sm`}
        placeholder="Пошук вузла дерева розвитку..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="max-h-[180px] overflow-y-auto rounded-md border border-border bg-bg">
        {available.length === 0 && (
          <p className="px-3 py-2 text-sm text-text-dim">Немає доступних вузлів</p>
        )}
        {available.map((n) => (
          <button
            type="button"
            key={n.id}
            onClick={() => toggleNode(n.id)}
            className="flex w-full items-center justify-between border-b border-border/50 px-3 py-2 text-left text-sm text-text-muted last:border-0 hover:text-accent"
          >
            <span>{n.title}</span>
            <span className="text-accent">+</span>
          </button>
        ))}
      </div>
    </div>
  );
}
