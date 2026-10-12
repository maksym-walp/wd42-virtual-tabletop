import { DEFAULT_ACCENT, useTheme } from '../context/ThemeContext';
import Button from './ui/Button';

export default function AccentPicker() {
  const { theme, accent, setAccent } = useTheme();

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          value={accent || DEFAULT_ACCENT}
          onChange={(e) => setAccent(e.target.value.toLowerCase())}
          aria-label="Акцентний колір"
          className="h-11 w-16 cursor-pointer rounded-lg border border-border bg-bg p-1"
        />
        <span className="text-sm text-text-muted">{(accent || DEFAULT_ACCENT).toUpperCase()}</span>
        {accent && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setAccent(null)}>Стандартний</Button>
        )}
      </div>
      <p className="mt-2 text-xs text-text-dim">
        {theme === 'dark'
          ? 'Надто темні кольори автоматично світлішають, щоб текст лишався читабельним.'
          : 'Колір акценту застосовується лише в темній темі.'}
      </p>
    </div>
  );
}
