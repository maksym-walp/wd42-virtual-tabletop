import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { ChangeOwnerForm } from './ChangeOwnerControl';

// Shows who owns a catalog record, mirroring the "Власник" line on character
// sheets/cards. `variant="inline"` renders plain "@username" text for use
// inside cards that are themselves wrapped in a <Link> (nesting an <a> inside
// an <a> is invalid); the default "link" variant renders a clickable link to
// the profile, for standalone detail pages. `onChangeOwner` (admin only —
// the caller decides) adds a pencil next to the name that opens an inline
// "new owner username" form.
export default function AuthorBadge({ username, variant = 'link', size = 'xs', className = '', onChangeOwner }) {
  const [editing, setEditing] = useState(false);
  if (!username && !onChangeOwner) return null;
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-xs';

  if (variant === 'inline') {
    return <p className={`${sizeClass} italic text-text-dim ${className}`}>@{username}</p>;
  }

  return (
    <div className={className}>
      <p className={`flex items-center gap-1.5 ${sizeClass} italic text-text-dim`}>
        <span>
          Автор:{' '}
          {username
            ? <Link to={`/profile/${username}`} className="text-accent hover:underline">{username}</Link>
            : '—'}
        </span>
        {onChangeOwner && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label="Змінити власника"
            title="Змінити власника"
            className="rounded p-0.5 not-italic text-text-dim hover:text-accent"
          >
            <Pencil size={13} />
          </button>
        )}
      </p>
      {editing && (
        <div className="mt-2">
          <ChangeOwnerForm onSubmit={onChangeOwner} onClose={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}
