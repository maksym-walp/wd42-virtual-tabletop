import { ENTITY_KINDS } from './entityRegistry';

// Рядок результату пошуку записів — спільний для пікера й підказки «@».
// onMouseDown preventDefault: клік не забирає фокус з редактора.
export default function EntityResultRow({ result, active = false, onPick, onHover }) {
  const def = ENTITY_KINDS[result.kind];
  const Icon = def.icon;
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(result)}
      onMouseEnter={onHover}
      className={`flex w-full items-center gap-2.5 border-b border-border/50 px-3 py-2 text-left last:border-0 ${active ? 'bg-surface-hover' : ''}`}
    >
      <Icon size={14} className="shrink-0 text-accent" aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-text">{result.name}</span>
        {result.meta && <span className="truncate text-xs text-text-dim">{result.meta}</span>}
      </span>
    </button>
  );
}
