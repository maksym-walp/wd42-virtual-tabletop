// Background image behind the skill-tree canvas (editor and character-sheet
// viewer). Pinned to the canvas rather than the tree, so it never reveals bare
// edges while panning; the scrim keeps nodes and edges readable on busy art.
// Both layers sit under the <svg>, which must be positioned (`relative`).
export default function SkillTreeBackdrop({ url }) {
  if (!url) return null;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${JSON.stringify(url)})` }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-bg/55" />
    </>
  );
}
