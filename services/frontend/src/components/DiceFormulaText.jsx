import RollButton from './RollButton';

const FORMULA_RE = /(\[\[[^\]]+\]\])/g;

function DiceFormulaButton({ formula }) {
  return (
    <RollButton
      formula={formula}
      size={12}
      className="mx-0.5 rounded border border-accent/60 px-1.5 py-0.5 text-xs font-semibold align-middle"
    >
      {formula}
    </RollButton>
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
