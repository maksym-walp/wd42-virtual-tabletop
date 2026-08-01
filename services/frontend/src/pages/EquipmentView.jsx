import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { EQUIPMENT_TYPES, EQUIPMENT_ENDPOINTS, EQUIPMENT_TYPE_PATHS, WEAPON_TYPES, WEAPON_GRIPS, weaponModifierLabel, ARMOR_WEIGHTS } from '../constants/equipment';
import { recordView, removeView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import SmartTextReader from '../components/SmartTextReader';
import AuthorBadge from '../components/AuthorBadge';
import { useAuth } from '../context/AuthContext';

export default function EquipmentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);

  // Читаємо зі спільного зрізу по всіх чотирьох таблицях: у посиланні лише
  // голий id, вид наперед невідомий — він приходить у відповіді як `type`, і
  // вже за ним ідуть подальші записи.
  useEffect(() => {
    api.get(`/api/equipment/${id}`)
      .then(({ data }) => {
        // Артефакти мають власну View/Form-пару (інші поля — creator/rarity
        // замість зброї/обладунку), тож будь-яке пряме посилання на
        // /equipment/:id артефакта (старе закладка тощо) переадресовуємо туди.
        if (data.item.type === 'artifact') {
          navigate(`/equipment/artifacts/${id}`, { replace: true });
          return;
        }
        setItem(data.item);
        recordView({ type: 'equipment', id, name: data.item.name, href: `/equipment/${id}`, image_url: data.item.image_url });
      })
      .catch(() => navigate('/equipment', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити цей предмет?')) return;
    setDeleting(true);
    try {
      await api.delete(`${EQUIPMENT_ENDPOINTS[item.type]}/${id}`);
      removeView('equipment', id);
      navigate(`/equipment/${EQUIPMENT_TYPE_PATHS[item.type]}`);
    } catch {
      setDeleting(false);
    }
  };

  const handleMarkCanonical = async () => {
    setSettingCanonical(true);
    try {
      const { data } = await api.patch(`${EQUIPMENT_ENDPOINTS[item.type]}/${id}/canonical`, { is_canonical: true });
      setItem(data.item);
    } finally {
      setSettingCanonical(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!item) return null;

  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';
  const type = EQUIPMENT_TYPES[item.type] || EQUIPMENT_TYPES.item;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={`/equipment/${EQUIPMENT_TYPE_PATHS[item.type]}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {type.label}
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {item.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-hover px-4 py-2.5">
          <span className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-text-dim">
            {type.label}
          </span>
          {item.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-1 pt-4 font-display text-3xl text-accent">{item.name}</h1>
        <AuthorBadge username={item.owner_username} size="sm" className="px-5 pb-2" />

        <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3">
          {item.damage_die && <SheetStat label="Кубик шкоди" value={item.damage_die} />}
          {item.modifier && <SheetStat label="Модифікатор" value={weaponModifierLabel(item.modifier)} />}
          {item.weapon_type && <SheetStat label="Тип зброї" value={WEAPON_TYPES[item.weapon_type]?.label} />}
          {item.weapon_grip && <SheetStat label="Особливості" value={WEAPON_GRIPS[item.weapon_grip]?.label} />}
          {item.defense_value != null && <SheetStat label="Пасивний захист" value={item.defense_value} />}
          {item.armor_weight && <SheetStat label="Вага" value={ARMOR_WEIGHTS[item.armor_weight]?.label} />}
          {item.price != null && <SheetStat label="Орієнтовна вартість" value={item.price} />}
        </div>

        {item.description && (
          <Section title="Опис">
            <p className="text-[0.95rem] leading-relaxed text-text"><SmartTextReader text={item.description} /></p>
          </Section>
        )}

        {item.used_in_spells?.length > 0 && (
          <Section title="Використовується у">
            <div className="flex flex-col gap-1.5">
              {item.used_in_spells.map((s) => (
                <Link key={s.id} to={`/spellbook/${s.id}`} className="text-sm text-accent hover:underline">
                  {s.name}
                </Link>
              ))}
            </div>
          </Section>
        )}

        {canManageCanonical && !item.is_canonical && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={handleMarkCanonical} disabled={settingCanonical}>
              {settingCanonical ? 'Позначення...' : 'Зробити канонічним'}
            </Button>
          </div>
        )}

        {(item.is_owner || isAdmin) && (
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

function SheetStat({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">
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
