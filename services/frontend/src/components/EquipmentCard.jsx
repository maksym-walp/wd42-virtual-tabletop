import { Link } from 'react-router-dom';
import { ARMOR_WEIGHTS, weaponModifierLabel } from '../constants/equipment';
import AuthorBadge from './AuthorBadge';
import { StatGrid, StatBox } from './StatGrid';

export default function EquipmentCard({ item }) {
  // Каталог показує мініатюру (400px webp) замість оригіналу — менше даних
  // на список карток; старі записи без thumbnail_url падають на оригінал.
  const thumbnail = item.thumbnail_url || item.image_url;

  return (
    <Link
      to={`/equipment/${item.id}`}
      className="block overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderLeft: '4px solid var(--color-accent)' }}
    >
      {thumbnail && (
        <div className="aspect-[4/3] w-full overflow-hidden bg-bg">
          <img src={thumbnail} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <h3 className="px-3.5 pb-1 pt-2.5 font-display text-lg text-accent">{item.name}</h3>
      <AuthorBadge username={item.owner_username} variant="inline" className="px-3.5 pb-1" />

      {(item.damage_die || item.modifier || item.defense_value != null || item.armor_weight || item.price != null) && (
        <StatGrid className="grid-cols-3">
          {item.damage_die && <StatBox label="Шкода" value={item.damage_die} />}
          {item.modifier && <StatBox label="Модифікатор" value={weaponModifierLabel(item.modifier)} />}
          {item.defense_value != null && <StatBox label="Захист" value={item.defense_value} />}
          {item.armor_weight && <StatBox label="Вага" value={ARMOR_WEIGHTS[item.armor_weight]?.label} />}
          {item.price != null && <StatBox label="Ціна" value={item.price} />}
        </StatGrid>
      )}

      {!thumbnail && item.description && (
        <p className="line-clamp-2 px-3.5 pb-3 text-sm italic leading-snug text-text-dim">{item.description}</p>
      )}
    </Link>
  );
}
