// Filenames matching a die type (e.g. assets/dice/d20.svg) are picked up
// automatically — no code change needed once real illustrations are dropped
// into that folder.
function imagesByKey(globResult) {
  const map = {};
  for (const [path, url] of Object.entries(globResult)) {
    const key = path.match(/([^/]+)\.[a-z]+$/i)?.[1];
    if (key) map[key] = url;
  }
  return map;
}

const dieImages = imagesByKey(
  import.meta.glob('../assets/dice/*.{png,svg}', { eager: true, import: 'default' })
);

export default function DieFace({ sides, value, dimmed = false }) {
  const src = dieImages[`d${sides}`];

  return (
    <div className={`relative h-11 w-11 shrink-0 ${dimmed ? 'opacity-40' : ''}`}>
      {src ? (
        <img src={src} alt={`d${sides}`} className="h-full w-full object-contain" />
      ) : (
        <div className="h-full w-full rounded-lg border border-dashed border-border bg-surface" />
      )}
      <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-text">
        {value}
      </span>
    </div>
  );
}
