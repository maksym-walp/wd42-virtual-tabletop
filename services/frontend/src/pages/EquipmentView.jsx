import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { EQUIPMENT_TYPES, WEAPON_TYPES, WEAPON_GRIPS, ARMOR_WEIGHTS, RARITIES } from '../constants/equipment';
import Button from '../components/ui/Button';

export default function EquipmentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/api/equipment/${id}`)
      .then(({ data }) => setItem(data.item))
      .catch(() => navigate('/equipment', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цей предмет?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/equipment/${id}`);
      navigate('/equipment');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!item) return null;

  const type = EQUIPMENT_TYPES[item.type] || EQUIPMENT_TYPES.item;
  const rarity = RARITIES[item.rarity];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/equipment" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Спорядження
      </Link>

      <div
        className="overflow-hidden rounded-lg border border-border bg-surface"
        style={{ borderTop: `3px solid ${type.color}` }}
      >
        {item.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5" style={{ background: type.bg }}>
          <span
            className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: type.color, borderColor: type.color }}
          >
            {type.label}
          </span>
          {rarity && (
            <span className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: rarity.color, borderColor: rarity.color }}>
              {rarity.label}
            </span>
          )}
          {item.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-1 pt-4 font-display text-3xl text-accent">{item.name}</h1>
        {item.creator && <p className="px-5 pb-2 text-sm italic text-text-dim">Творець: {item.creator}</p>}

        <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3">
          {item.damage_die && <SheetStat label="Кубик шкоди" value={item.damage_die} accent={type.color} />}
          {item.weapon_type && <SheetStat label="Тип зброї" value={WEAPON_TYPES[item.weapon_type]?.label} accent={type.color} />}
          {item.weapon_grip && <SheetStat label="Особливості" value={WEAPON_GRIPS[item.weapon_grip]?.label} accent={type.color} />}
          {item.defense_value != null && <SheetStat label="Пасивний захист" value={item.defense_value} accent={type.color} />}
          {item.armor_weight && <SheetStat label="Вага" value={ARMOR_WEIGHTS[item.armor_weight]?.label} accent={type.color} />}
          {item.price != null && <SheetStat label="Середня ціна" value={item.price} accent={type.color} />}
        </div>

        {item.description && (
          <Section title="Опис">
            <p className="text-[0.95rem] leading-relaxed text-text">{item.description}</p>
          </Section>
        )}

        {item.is_owner && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/equipment/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SheetStat({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: accent + 'aa' }}>
        {label}
      </span>
      <span className="text-sm font-semibold text-text">{value ?? '—'}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="border-t border-border">
      <div className="bg-bg px-5 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="px-5 py-3.5">{children}</div>
    </div>
  );
}
