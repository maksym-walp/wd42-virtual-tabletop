import { Layers, Plus, Clock, X as XIcon } from 'lucide-react';
import { datedYears } from '../../constants/maps';

// The map's lenses as a tab strip: pick the active lens, and (owner) add a lens
// image, open a lens's chronology sheet, or delete a lens.
//   variant="tabs" — bare inline strip for the header (wide screens); the
//                    per-lens edit controls reveal on hover.
//   variant="menu" — content only, for the narrow-screen dropdown; controls
//                    stay visible (no hover on touch).
export default function LensSwitcher({
  lenses, activeLensId, isOwner, uploading,
  onSelect, onManageVersions, onRemoveLens, onAddLens,
  variant = 'menu', className = '',
}) {
  if (!lenses.length && !isOwner) return null;

  const controlsClass = variant === 'tabs'
    ? 'opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'
    : '';

  const strip = (
    <div className="flex flex-wrap items-center gap-1">
      {lenses.map((lens) => {
        const yrs = datedYears(lens.versions);
        const active = lens.id === activeLensId;
        return (
          <div
            key={lens.id}
            className={`group flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${active ? 'bg-gold/20 text-gold ring-1 ring-gold/40' : 'text-text-dim hover:bg-surface-hover hover:text-text'}`}
          >
            <button onClick={() => onSelect(lens.id)} className="whitespace-nowrap">
              {lens.name}
              {yrs.length > 1 && <span className="ml-1 font-normal opacity-70">{yrs[0]}–{yrs[yrs.length - 1]}</span>}
            </button>
            {isOwner && (
              <span className={`flex items-center gap-0.5 ${controlsClass}`}>
                <button onClick={() => onManageVersions(lens.id)} aria-label="Часова шкала шару" title="Часова шкала" className="text-text-dim hover:text-accent">
                  <Clock size={11} />
                </button>
                <button onClick={() => onRemoveLens(lens.id)} aria-label="Видалити шар" className="text-text-dim hover:text-danger">
                  <XIcon size={11} />
                </button>
              </span>
            )}
          </div>
        );
      })}
      {isOwner && (
        <button
          onClick={onAddLens}
          disabled={uploading}
          title="Додати шар"
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-xs font-semibold text-text-dim hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Plus size={12} /> Шар
        </button>
      )}
    </div>
  );

  if (variant === 'tabs') {
    return (
      <div className={`no-scrollbar pointer-events-auto flex min-w-0 items-center gap-2 overflow-x-auto ${className}`}>
        <Layers size={14} className="shrink-0 text-text-dim" />
        {strip}
      </div>
    );
  }

  return <div className={className}>{strip}</div>;
}
