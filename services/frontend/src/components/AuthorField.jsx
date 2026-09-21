import { Link } from 'react-router-dom';
import { inputClass } from './ui/Field';

// Лорне поле "Творець" — вільний текст АБО прив'язка до існуючого НІПа з
// бестіарію. Та сама взаємодія, що й у SpellComponentsField.jsx (набір тексту
// шукає точний збіг за назвою, некороткий збіг показує список підказок), але
// звужена до одного поля замість повторюваних рядків.
//
// props: { name, npcId, onChange, npcs, label = 'Творець', hint }
// onChange отримує ({ name, npc_id }) — викликається з новою парою на кожну зміну.
export default function AuthorField({ name, npcId, onChange, npcs = [], label = 'Творець', hint }) {
  const value = name || '';
  const trimmed = value.trim();

  const exactMatch = trimmed
    ? npcs.find((n) => n.name.toLowerCase() === trimmed.toLowerCase())
    : null;

  const suggestions = trimmed && !npcId
    ? npcs.filter((n) => n.name.toLowerCase().includes(trimmed.toLowerCase())).slice(0, 6)
    : [];

  const handleTextChange = (e) => {
    const next = e.target.value;
    const match = npcs.find((n) => n.name.toLowerCase() === next.trim().toLowerCase());
    onChange({ name: next, npc_id: match ? match.id : null });
  };

  const selectSuggestion = (npc) => {
    onChange({ name: npc.name, npc_id: npc.id });
  };

  const linkedNpc = npcId ? npcs.find((n) => n.id === npcId) : (exactMatch || null);

  return (
    <label className="flex flex-col gap-1.5">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">
          {label}
        </span>
      )}
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={handleTextChange}
        placeholder="напр. Архімаг Ельдран Сірий..."
        maxLength={200}
      />
      {suggestions.length > 0 && (
        <div className="mt-1 max-h-[140px] overflow-y-auto rounded-md border border-border bg-bg">
          {suggestions.map((n) => (
            <button
              type="button"
              key={n.id}
              onClick={() => selectSuggestion(n)}
              className="flex w-full items-center justify-between border-b border-border/50 px-3 py-1.5 text-left text-sm text-text-muted last:border-0 hover:text-accent"
            >
              {n.name}
            </button>
          ))}
        </div>
      )}
      {npcId && linkedNpc && (
        <p className="mt-1 text-xs text-sage">
          Пов&rsquo;язано з НІПом:{' '}
          <Link to={`/compendium/entries/${npcId}`} className="underline">{linkedNpc.name}</Link>
        </p>
      )}
      {hint && <span className="text-xs text-text-dim">{hint}</span>}
    </label>
  );
}
