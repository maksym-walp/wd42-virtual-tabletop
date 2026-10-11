import { Link } from 'react-router-dom';

// Список компонентів заклинання/вміння: [{ item_id, name, quantity, unit }];
// компонент, привʼязаний до спорядження, веде на його сторінку.
export default function ComponentsList({ components }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {components.map((c, i) => {
        const label = [c.name, c.quantity ? `×${c.quantity}` : null, c.unit || null].filter(Boolean).join(' ');
        return (
          <li key={i} className="text-sm text-text">
            {c.item_id ? (
              <Link to={`/equipment/${c.item_id}`} className="text-accent hover:underline">{label}</Link>
            ) : label}
          </li>
        );
      })}
    </ul>
  );
}
