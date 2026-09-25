import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { ARCHETYPES, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK } from '../constants/characterSheet';
import { formatDuration } from '../constants/abilities';
import { recordView, removeView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';
import AuthorBadge from '../components/AuthorBadge';
import ChangeOwnerControl from '../components/ChangeOwnerControl';
import SmartTextReader from '../components/SmartTextReader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AbilityView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;
  const [ability, setAbility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);

  useEffect(() => {
    api.get(`/api/abilities/${id}`)
      .then(({ data }) => {
        setAbility(data.ability);
        recordView({ type: 'ability', id, name: data.ability.name, href: `/abilities/${id}`, image_url: data.ability.image_url });
      })
      .catch(() => navigate('/abilities', { replace: true }))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити це вміння?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/abilities/${id}`);
      removeView('ability', id);
      navigate('/abilities');
    } catch {
      setDeleting(false);
    }
  };

  const handleSetCanonical = async (isCanonical) => {
    setSettingCanonical(true);
    try {
      const { data } = await api.patch(`/api/abilities/${id}/canonical`, { is_canonical: isCanonical });
      setAbility(data.ability);
    } finally {
      setSettingCanonical(false);
    }
  };

  const handleSetOwner = async (ownerUsername) => {
    const { data } = await api.patch(`/api/abilities/${id}/owner`, { owner_username: ownerUsername });
    setAbility(data.ability);
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!ability) return null;

  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/abilities" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Вміння
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: '3px solid var(--color-gold)' }}>
        {ability.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={ability.image_url} alt={ability.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          {(ability.archetypes ?? []).map((a) => (
            <span
              key={a}
              className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
              style={{ borderColor: ARCHETYPE_COLORS[a]?.color, color: ARCHETYPE_COLORS[a]?.color }}
            >
              {ARCHETYPES[a]?.label ?? a}
            </span>
          ))}
          {ability.is_maneuver && (
            <span className="rounded border border-gold/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-gold">
              Маневр · {formatDuration(ability.duration_value, ability.duration_unit)}
            </span>
          )}
          <span className={`text-xs italic ${ability.is_canonical ? 'text-gold' : 'text-text-dim'}`}>
            {ability.is_canonical ? 'канонічне' : 'спільнота'}
          </span>
          {ability.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{ability.name}</h1>
        <AuthorBadge username={ability.owner_username} size="sm" className="px-5 pb-2" />

        {ability.mechanical_desc && (
          <Section title="Механічний опис">
            <SmartTextReader text={ability.mechanical_desc} className="text-[0.95rem] leading-relaxed text-text" />
          </Section>
        )}

        {ability.narrative_desc && (
          <Section title="Наративний опис">
            <SmartTextReader text={ability.narrative_desc} className="text-[0.95rem] italic leading-relaxed text-text-dim" />
          </Section>
        )}

        {ability.lore_creator && (
          <Section title="Творець">
            <p className="text-[0.95rem] text-text">
              {ability.lore_creator_npc_id
                ? <Link to={`/compendium/entries/${ability.lore_creator_npc_id}`} className="text-accent hover:underline">{ability.lore_creator}</Link>
                : ability.lore_creator}
            </p>
          </Section>
        )}

        {ability.prerequisite_nodes?.length > 0 && (
          <Section title="Вимоги дерева розвитку">
            <div className="flex flex-col gap-1.5">
              {ability.prerequisite_nodes.map((n) => (
                <span key={n.id} className="flex items-center gap-1.5 text-sm text-text">
                  <ReqBadge type={ability.prerequisite_logic === 'and' ? 'required' : 'optional'} />
                  {n.title}
                </span>
              ))}
            </div>
          </Section>
        )}

        {canManageCanonical && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={() => handleSetCanonical(!ability.is_canonical)} disabled={settingCanonical}>
              {settingCanonical ? 'Позначення...' : ability.is_canonical ? 'Зняти позначку «канонічне»' : 'Зробити канонічним'}
            </Button>
          </div>
        )}

        {isAdmin && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <ChangeOwnerControl onSubmit={handleSetOwner} />
          </div>
        )}

        {(ability.is_owner || isAdmin) && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/abilities/${id}/edit`}>Редагувати</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Видалення...' : 'Видалити'}
            </Button>
          </div>
        )}
      </div>
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
