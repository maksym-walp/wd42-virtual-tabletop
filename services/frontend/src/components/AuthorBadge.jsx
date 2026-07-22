import { Link } from 'react-router-dom';

// Shows who owns a catalog record, mirroring the "Власник" line on character
// sheets/cards. `variant="inline"` renders plain "@username" text for use
// inside cards that are themselves wrapped in a <Link> (nesting an <a> inside
// an <a> is invalid); the default "link" variant renders a clickable link to
// the profile, for standalone detail pages.
export default function AuthorBadge({ username, variant = 'link', size = 'xs', className = '' }) {
  if (!username) return null;
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-xs';

  if (variant === 'inline') {
    return <p className={`${sizeClass} italic text-text-dim ${className}`}>@{username}</p>;
  }

  return (
    <p className={`${sizeClass} italic text-text-dim ${className}`}>
      Автор: <Link to={`/profile/${username}`} className="text-accent hover:underline">{username}</Link>
    </p>
  );
}
