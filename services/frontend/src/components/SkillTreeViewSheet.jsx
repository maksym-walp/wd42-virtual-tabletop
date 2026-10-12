import { useEffect, useRef, useState } from 'react';
import Sheet from './ui/Sheet';
import ImageUploadField from './ui/ImageUploadField';

const LAYOUT_OPTIONS = [
  { key: 'tree', label: 'Дерево' },
  { key: 'star', label: 'Зірка' },
];

const SAVABLE_URL = /^(\/|https?:\/\/\S)/;
const URL_SAVE_DELAY_MS = 600; // a pasted link arrives keystroke by keystroke — don't PUT each one

// GM-only: layout and background of the active skill-tree tab. `settings` is
// that tab's current { layout, background_url }; `onChange(patch)` persists it.
export default function SkillTreeViewSheet({ open, onClose, tabLabel, settings, onChange }) {
  const [background, setBackground] = useState(settings.background_url || '');
  const saveTimerRef = useRef(null);

  // Re-sync when the sheet is reopened or the tab changes.
  useEffect(() => { setBackground(settings.background_url || ''); }, [open, settings.background_url]);
  useEffect(() => () => clearTimeout(saveTimerRef.current), []);

  const handleBackground = (url) => {
    setBackground(url);
    clearTimeout(saveTimerRef.current);
    if (url !== '' && !SAVABLE_URL.test(url)) return; // half-typed link
    saveTimerRef.current = setTimeout(() => onChange({ background_url: url || null }), url ? URL_SAVE_DELAY_MS : 0);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Вигляд: ${tabLabel}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Розкладка</span>
          <div className="flex gap-1.5">
            {LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => settings.layout !== opt.key && onChange({ layout: opt.key })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm transition-colors ${
                  settings.layout === opt.key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-text-dim">
            «Зірка»: корінь у центрі, гілки розходяться променями. Порядок гілок змінюється перетягуванням вузлів.
          </p>
        </div>

        <ImageUploadField
          label="Фонове зображення"
          entityType="skill-tree-background"
          value={background}
          onChange={handleBackground}
        />
      </div>
    </Sheet>
  );
}
