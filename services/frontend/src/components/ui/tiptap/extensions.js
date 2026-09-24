import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import DiceRollNode from './DiceRollNode';

// Only "https?://" and root-relative "/..." links render as real, clickable
// <a href>s — anything else (javascript:, data:, ...) is rejected by the
// Link mark itself and falls back to plain text. Same allow-list the old
// SmartTextReader used.
export const SAFE_URL_RE = /^(https?:\/\/|\/)/i;

// Shared extension set for both the editable SmartTextarea and the
// read-only SmartTextReader — keeping them identical is what makes the
// "no dangerouslySetInnerHTML anywhere" security story hold: whatever HTML
// is loaded (ours or POSTed directly to an API), only nodes/marks declared
// here ever become part of the live DOM.
export function buildExtensions({ editable, placeholder }) {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      code: false,
      horizontalRule: false,
      strike: false,
    }),
    Link.configure({
      openOnClick: !editable,
      autolink: false,
      protocols: ['http', 'https'],
      validate: (href) => SAFE_URL_RE.test(href),
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
    }),
    DiceRollNode,
    Placeholder.configure({ placeholder: placeholder || '' }),
  ];
}
