import { Link } from 'react-router-dom';
import { EQUIPMENT_TYPES, weaponModifierLabel } from '../constants/equipment';
import AuthorBadge from './AuthorBadge';

export default function EquipmentCard({ item }) {
  const type = EQUIPMENT_TYPES[item.type] || EQUIPMENT_TYPES.item;

  return (
    <Link
      to={`/equipment/${item.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      {item.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-border bg-surface-hover px-3.5 py-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-text-dim">
          {type.label}
        </span>
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{item.name}</h3>
      <AuthorBadge username={item.owner_username} variant="inline" className="px-3.5 pb-1" />

      {(item.damage_die || item.modifier || item.defense_value != null || item.price != null) && (
        <div className="my-2 grid grid-cols-3 gap-px border-y border-border bg-border">
          {item.damage_die && <StatBox label="Шкода" value={item.damage_die} />}
          {item.modifier && <StatBox label="Модифікатор" value={weaponModifierLabel(item.modifier)} />}
          {item.defense_value != null && <StatBox label="Захист" value={item.defense_value} />}
          {item.price != null && <StatBox label="Ціна" value={item.price} />}
        </div>
      )}

      {!item.image_url && item.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{item.description}</p>
      )}
    </Link>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="flex flex-col items-center gap-0.5 bg-surface px-1.5 py-2">
      <span className="text-[0.62rem] uppercase tracking-wide text-text-dim">{label}</span>
      <span className="text-sm font-semibold text-text">{value}</span>
    </div>
  );
}
