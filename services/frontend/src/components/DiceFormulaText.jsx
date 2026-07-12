import { Dices } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDice } from '../context/DiceContext';

const FORMULA_RE = /(\[\[[^\]]+\]\])/g;

function DiceFormulaButton({ formula }) {
  const { user } = useAuth();
  const { rollAndShow, rolling } = useDice();

  // Public/unauthenticated views (e.g. a shared character sheet) render the
  // formula as plain text — rolling requires an authed request and the
  // widget itself isn't mounted without a user.
  if (!user) {
    return <span className="font-semibold">{formula}</span>;
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        rollAndShow(formula);
      }}
      disabled={rolling}
      className="mx-0.5 inline-flex items-center gap-1 rounded border border-accent/60 px-1.5 py-0.5 text-xs font-semibold text-accent align-middle"
    >
      <Dices size={12} /> {formula}
    </button>
  );
}

// Renders plain text, except for `[[formula]]` substrings which become
// clickable dice-roll buttons (e.g. spell descriptions like
// "наносить [[4d6]] шкоди"). Scoped strictly to this one delimiter — not a
// general markdown renderer.
export default function DiceFormulaText({ text }) {
  if (!text) return null;

  const parts = text.split(FORMULA_RE);

  return parts.map((part, i) => {
    const match = part.match(/^\[\[([^\]]+)\]\]$/);
    return match ? <DiceFormulaButton key={i} formula={match[1]} /> : <span key={i}>{part}</span>;
  });
}
