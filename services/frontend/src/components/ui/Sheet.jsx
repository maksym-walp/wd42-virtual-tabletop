import { X } from 'lucide-react';

// Bottom sheet on mobile, centered dialog on wider screens. Shared by
// Spellbook's mobile filter panel and SkillTree's node-detail panel.
export default function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl sm:border sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg text-text">{title}</h2>}
          <button
            onClick={onClose}
            aria-label="Закрити"
            className="ml-auto rounded-full p-2 text-text-dim hover:bg-surface-hover"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
