import { Link } from 'react-router-dom';

// Lets a catalog item's own create/edit form pick which of the user's own
// collections (for that domain) it belongs to — the counterpart to adding
// items from inside a collection's own view. `collections` is pre-filtered
// to is_owner by the caller, since only the collection owner can add items.
export default function CollectionMembershipPicker({ collections, basePath, value, onChange }) {
  const toggle = (id) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  if (collections.length === 0) {
    return (
      <p className="text-sm text-text-dim">
        У вас ще немає колекцій.{' '}
        <Link to={`${basePath}/collections/new`} className="text-accent">Створити колекцію</Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {collections.map((c) => (
        <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={value.includes(c.id)}
            onChange={() => toggle(c.id)}
            className="h-5 w-5 accent-accent"
          />
          {c.name}
        </label>
      ))}
    </div>
  );
}
