import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, Upload, Copy, FileUp, ClipboardPaste, Check } from 'lucide-react';
import Button from './ui/Button';
import Sheet from './ui/Sheet';
import { inputClass } from './ui/Field';
import { parseJsonWithComments } from '../utils/jsonWithComments';

// Пара кнопок для каталогів: onExport — коли її передали, консюмер сам
// робить запит і завантаження файлу. Import відкриває меню з трьох шляхів
// заповнити той самий onImport(parsedJson): скопіювати шаблон-документацію
// (onTemplate), завантажити .json файл, або вставити JSON текстом.
// Без onExport/onImport кнопки лишаються видимими, але неактивними — саме
// так компонент і стоїть у каталогах, де бекенд ще не підключено.
export default function ExportImportActions({ onExport, onImport, onTemplate, className = '' }) {
  const fileInputRef = useRef(null);
  const menuButtonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuRect, setMenuRect] = useState(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const updateRect = () => {
      const r = menuButtonRef.current?.getBoundingClientRect();
      if (r) setMenuRect({ top: r.bottom + 6, right: window.innerWidth - r.right });
    };
    updateRect();
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => {
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [menuOpen]);

  const handleCopyTemplate = async () => {
    setMenuOpen(false);
    try {
      await navigator.clipboard.writeText(onTemplate());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      alert('Не вдалося скопіювати шаблон');
    }
  };

  const handleUploadClick = () => {
    setMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // дозволяє повторно обрати той самий файл
    if (!file) return;

    let data;
    try {
      data = parseJsonWithComments(await file.text());
    } catch {
      alert('Файл не є коректним JSON');
      return;
    }
    onImport(data);
  };

  const handleOpenPaste = () => {
    setMenuOpen(false);
    setPasteText('');
    setPasteError('');
    setPasteOpen(true);
  };

  const handleConfirmPaste = () => {
    let data;
    try {
      data = parseJsonWithComments(pasteText);
    } catch {
      setPasteError('Текст не є коректним JSON');
      return;
    }
    setPasteOpen(false);
    onImport(data);
  };

  return (
    <div className={`inline-flex shrink-0 items-center gap-1.5 ${className}`}>
      {copied && <span className="text-xs font-semibold text-sage">Скопійовано</span>}

      <Button
        type="button" variant="ghost" size="icon"
        onClick={onExport} disabled={!onExport}
        aria-label="Експорт" title="Експорт у JSON"
      >
        <Download size={16} />
      </Button>

      <Button
        ref={menuButtonRef}
        type="button" variant="ghost" size="icon"
        onClick={() => setMenuOpen((o) => !o)} disabled={!onImport}
        aria-label="Імпорт" aria-expanded={menuOpen} title="Імпорт з JSON"
      >
        <Upload size={16} />
      </Button>

      {menuOpen && menuRect && createPortal(
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div
            className="fixed z-40 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-xl"
            style={{ top: menuRect.top, right: menuRect.right }}
          >
            <MenuItem icon={Copy} label="Скопіювати шаблон" onClick={handleCopyTemplate} disabled={!onTemplate} />
            <MenuItem icon={FileUp} label="Завантажити JSON файл" onClick={handleUploadClick} />
            <MenuItem icon={ClipboardPaste} label="Вставити код" onClick={handleOpenPaste} />
          </div>
        </>,
        document.body
      )}

      <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileChange} />

      <Sheet open={pasteOpen} onClose={() => setPasteOpen(false)} title="Вставити JSON для імпорту">
        <textarea
          className={`${inputClass} font-mono text-xs`}
          rows={12}
          value={pasteText}
          onChange={(e) => { setPasteText(e.target.value); setPasteError(''); }}
          placeholder="Встав сюди JSON-масив..."
          autoFocus
        />
        {pasteError && <p className="mt-2 text-sm text-danger">{pasteError}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setPasteOpen(false)}>Скасувати</Button>
          <Button type="button" onClick={handleConfirmPaste} disabled={!pasteText.trim()}>Імпортувати</Button>
        </div>
      </Sheet>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 border-b border-border/50 px-3.5 py-2.5 text-left text-sm text-text last:border-b-0 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon size={15} className="shrink-0 text-text-dim" />
      {label}
    </button>
  );
}
