import { Link } from 'react-router-dom';
import { EQUIPMENT_TYPES } from '../constants/equipment';
import CanonBadge from './CanonBadge';

export default function EquipmentCard({ item }) {
  const type = EQUIPMENT_TYPES[item.type] || EQUIPMENT_TYPES.item;

  return (
    <Link
      to={`/equipment/${item.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: `4px solid ${type.color}` }}
    >
      {item.image_url && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div
        className="flex items-center gap-2 border-b px-3.5 py-2"
        style={{ background: type.bg, borderBottomColor: type.color + '44' }}
      >
        <span
          className="rounded border px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide"
          style={{ color: type.color, borderColor: type.color + '66' }}
        >
          {type.label}
        </span>
        {item.is_canonical && <CanonBadge className="ml-auto" />}
        {item.is_public && <span className={`text-[0.65rem] italic text-text-dim ${item.is_canonical ? '' : 'ml-auto'}`}>публічне</span>}
        {!item.is_owner && <span className={`text-[0.65rem] italic text-text-dim ${item.is_canonical || item.is_public ? '' : 'ml-auto'}`}>чуже</span>}
      </div>

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{item.name}</h3>

      {(item.damage_die || item.defense_value != null || item.price != null) && (
        <div className="my-2 grid grid-cols-3 gap-px border-y border-border bg-border">
          {item.damage_die && <StatBox label="Шкода" value={item.damage_die} />}
          {item.defense_value != null && <StatBox label="Захист" value={item.defense_value} />}
          {item.price != null && <StatBox label="Ціна" value={item.price} />}
        </div>
      )}

      {item.description && (
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
