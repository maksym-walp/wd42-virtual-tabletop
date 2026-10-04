import { Link } from 'react-router-dom';
import { STAT_BLOCK_KINDS } from '../../constants/statBlocks';
import { htmlToPreviewText } from '../../utils/richText';
import CroppedImage from '../ui/CroppedImage';

export default function StatBlockCard({ kind: kindKey, entry, ...rest }) {
  const kind = STAT_BLOCK_KINDS[kindKey];

  return (
    <Link
      {...rest}
      to={`${kind.basePath}/${entry.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      {entry.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <CroppedImage src={entry.image_url} crop={entry.image_crop} alt={entry.name} loading="lazy" />
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-border bg-surface-hover px-3.5 py-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-text-dim">
          {kind.label}
        </span>
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{entry.name}</h3>

      {!entry.image_url && entry.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{htmlToPreviewText(entry.description)}</p>
      )}
    </Link>
  );
}
