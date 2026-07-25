import { ExternalLink } from 'lucide-react';
import RollButton from './RollButton';

const TAG_RE = /(\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]+\))/g;
const DICE_RE = /^\[\[([^\]]+)\]\]$/;
const LINK_RE = /^\[([^\]]*)\]\(([^)]+)\)$/;
const SAFE_URL_RE = /^(https?:\/\/|\/)/i;

function DiceTag({ formula }) {
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

// Renders plain text, plus `[[formula]]` as clickable dice-roll badges and
// `[Text](URL)` as target="_blank" links. Raw text is user-authored and
// persisted to the DB, so URLs are checked against an allow-list before
// being rendered as a real href — anything else (e.g. javascript:) falls
// back to inert plain text.
export default function SmartTextReader({ text }) {
  if (!text) return null;

  const parts = text.split(TAG_RE);

  return parts.map((part, i) => {
    const diceMatch = part.match(DICE_RE);
    if (diceMatch) return <DiceTag key={i} formula={diceMatch[1]} />;

    const linkMatch = part.match(LINK_RE);
    if (linkMatch) {
      const [, linkText, url] = linkMatch;
      if (SAFE_URL_RE.test(url)) {
        return (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-0.5 inline-flex items-center gap-1 rounded border border-accent/60 px-1.5 py-0.5 align-middle text-xs font-semibold text-accent underline decoration-accent/50 underline-offset-2 hover:bg-accent/10"
          >
            <ExternalLink size={12} />
            {linkText || url}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    }

    return <span key={i}>{part}</span>;
  });
}
