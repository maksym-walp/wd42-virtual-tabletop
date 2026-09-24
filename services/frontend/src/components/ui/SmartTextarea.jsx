import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Bold, Italic, Dices, Link2 } from 'lucide-react';
import Field, { inputClass } from './Field';
import Button from './Button';
import Sheet from './Sheet';
import { buildExtensions } from './tiptap/extensions';

const labelClass = 'text-xs font-semibold uppercase tracking-wide text-text-dim';
const hintClass = 'text-xs text-text-dim';

function ToolbarButton({ active, onClick, title, children }) {
  return (
    <Button type="button" variant={active ? 'primary' : 'ghost'} size="sm" onClick={onClick} title={title}>
      {children}
    </Button>
  );
}

// Rich-text field with a toolbar for bold/italic, `[[formula]]`-style
// dice-roll badges and links — the editable half of the pair, paired with
// SmartTextReader which renders the same HTML read-only. Both share the
// exact extension set (see ./tiptap/extensions) so nothing renders here
// that wouldn't also render in the reader.
export default function SmartTextarea({
  label, hint, className = '', value, onChange, rows = 4, placeholder,
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceFormula, setDiceFormula] = useState('');

  const emit = (html) => onChange({ target: { value: html } });

  const editor = useEditor({
    extensions: buildExtensions({ editable: true, placeholder }),
    content: value || '',
    onUpdate: ({ editor: ed }) => emit(ed.getHTML()),
    editorProps: {
      attributes: {
        class: `${inputClass} resize-y overflow-auto [&_p]:m-0`,
        style: `min-height: ${Math.max(rows, 2) * 1.6}rem`,
      },
    },
  });

  // Keep the editor in sync when `value` changes from outside (e.g. the
  // record finishes loading after this field already mounted with '').
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) editor.commands.setContent(value || '', false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  const handleOpenLink = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    setLinkText(editor.state.doc.textBetween(from, to, ' '));
    setLinkUrl('');
    setLinkOpen(true);
  };

  const handleConfirmLink = () => {
    const text = linkText || linkUrl;
    editor.chain().focus().insertContent({
      type: 'text',
      text,
      marks: [{ type: 'link', attrs: { href: linkUrl } }],
    }).run();
    setLinkOpen(false);
  };

  const handleOpenDice = () => {
    setDiceFormula('');
    setDiceOpen(true);
  };

  const handleConfirmDice = () => {
    editor.chain().focus().insertDiceRoll(diceFormula).run();
    setDiceOpen(false);
  };

  return (
    <>
      {/* Not a <Field>/<label>: it would wrap the toolbar buttons and the
          editor together, and clicking the caption would forward the click
          to the first toolbar button instead of focusing the editor. Plain
          <div> replicates Field's look without that. */}
      <div className={`flex flex-col gap-1.5 ${className}`}>
        {label && <span className={labelClass}>{label}</span>}
        <div className="flex flex-wrap gap-2">
          <ToolbarButton active={editor?.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Жирний">
            <Bold size={14} />
          </ToolbarButton>
          <ToolbarButton active={editor?.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Курсив">
            <Italic size={14} />
          </ToolbarButton>
          <ToolbarButton onClick={handleOpenDice} title="Кидок кубика">
            <Dices size={14} /> Кубик
          </ToolbarButton>
          <ToolbarButton onClick={handleOpenLink} title="Посилання">
            <Link2 size={14} /> Посилання
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} />
        {hint && <span className={hintClass}>{hint}</span>}
      </div>

      <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} title="Вставити посилання">
        <div className="flex flex-col gap-4">
          <Field label="Текст для відображення">
            <input
              type="text"
              className={inputClass}
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="напр. Вогняна куля"
            />
          </Field>
          <Field label="URL">
            <input
              type="text"
              className={inputClass}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>Скасувати</Button>
            <Button type="button" variant="primary" onClick={handleConfirmLink} disabled={!linkUrl}>
              Додати
            </Button>
          </div>
        </div>
      </Sheet>

      <Sheet open={diceOpen} onClose={() => setDiceOpen(false)} title="Вставити кидок кубика">
        <div className="flex flex-col gap-4">
          <Field label="Формула" hint="напр. 2d6+3">
            <input
              autoFocus
              type="text"
              className={inputClass}
              value={diceFormula}
              onChange={(e) => setDiceFormula(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && diceFormula && handleConfirmDice()}
              placeholder="2d6+3"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setDiceOpen(false)}>Скасувати</Button>
            <Button type="button" variant="primary" onClick={handleConfirmDice} disabled={!diceFormula}>
              Додати
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
