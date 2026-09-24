import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { buildExtensions } from './ui/tiptap/extensions';

// Read-only counterpart to SmartTextarea — same extension set (bold/italic,
// dice-roll badges, links), mounted with editable: false so no toolbar and
// no editing, but dice badges stay real, clickable RollButtons and links
// stay real <a href> tags. Renders its own block content (paragraphs, line
// breaks), so — unlike the old plain-text version — callers should not wrap
// this in a <p>; pass text-sizing classes via `className` instead.
export default function SmartTextReader({ text, className = '' }) {
  const editor = useEditor({
    extensions: buildExtensions({ editable: false }),
    content: text || '',
    editable: false,
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((text || '') !== current) editor.commands.setContent(text || '', false);
  }, [text, editor]);

  if (!text) return null;
  return <EditorContent editor={editor} className={className} />;
}
