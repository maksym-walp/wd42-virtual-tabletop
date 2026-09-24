// Plain-text extraction for card/list preview blurbs — description/notes
// fields now hold SmartTextarea's HTML, so a raw `{field}` interpolation in
// a line-clamped card would show literal tags instead of a blurb. The dice
// node renders its formula as visible fallback content (see DiceRollNode),
// so textContent already reads naturally (e.g. "...deals 2d6 fire damage").
export function htmlToPreviewText(html, maxLen) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  if (!maxLen || text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trimEnd()}…`;
}
