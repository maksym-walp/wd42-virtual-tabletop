import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { NATURE_TYPES, RITUAL_TYPES, SPELL_KINDS, SPELL_COMPLEXITIES, formatDuration, spellLevels } from '../constants/spellbook';
import { recordView, removeView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';
import SmartTextReader from '../components/SmartTextReader';
import AuthorBadge from '../components/AuthorBadge';
import ChangeOwnerControl from '../components/ChangeOwnerControl';
import SpellTree from '../components/SpellTree';
import { useAuth } from '../context/AuthContext';

export default function SpellView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spell, setSpell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);
  const [activeLevel, setActiveLevel] = useState(0);
  const [treeNodes, setTreeNodes] = useState([]);

  useEffect(() => {
    api.get(`/api/spellbook/${id}`)
      .then(({ data }) => {
        setSpell(data.spell);
        setActiveLevel(0);
        recordView({ type: 'spell', id, name: data.spell.name, href: `/spellbook/${id}`, image_url: data.spell.image_url });
      })
      .catch(() => navigate('/spellbook', { replace: true }))
      .finally(() => setLoading(false));
    api.get(`/api/spellbook/${id}/tree`)
      .then(({ data }) => setTreeNodes(data.nodes ?? []))
      .catch(() => setTreeNodes([]));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Видалити це заклинання?')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/spellbook/${id}`);
      removeView('spell', id);
      navigate('/spellbook');
    } catch {
      setDeleting(false);
    }
  };

  const handleSetCanonical = async (isCanonical) => {
    setSettingCanonical(true);
    try {
      const { data } = await api.patch(`/api/spellbook/${id}/canonical`, { is_canonical: isCanonical });
      setSpell(data.spell);
    } finally {
      setSettingCanonical(false);
    }
  };

  const handleSetOwner = async (ownerUsername) => {
    const { data } = await api.patch(`/api/spellbook/${id}/owner`, { owner_username: ownerUsername });
    setSpell(data.spell);
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!spell) return null;

  const isAdmin = user?.role === 'admin';
  const canManageCanonical = isAdmin || user?.role === 'game_master';
  const levels = spellLevels(spell);
  // Поля рівня (механіка, описи, компоненти) — з обраного рівня; решта — зі spell.
  const level = levels[Math.min(activeLevel, levels.length - 1)];
  const ritual = RITUAL_TYPES[level.ritual];
  const kind = SPELL_KINDS[level.spell_kind];
  const complexity = SPELL_COMPLEXITIES[level.complexity];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/spellbook" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Книга заклинань
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {spell.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={spell.image_url} alt={spell.name} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Type header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-hover px-4 py-2.5">
          {(spell.nature || []).map((key) => {
            const n = NATURE_TYPES[key];
            if (!n) return null;
            return (
              <span
                key={key}
                className="rounded border border-border px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-text-dim"
              >
                {n.label}
              </span>
            );
          })}
          {kind && <span className="rounded border border-border px-1.5 py-0.5 text-xs font-semibold text-text-dim">{kind.label}</span>}
          <span className={`text-xs italic ${spell.is_canonical ? 'text-gold' : 'text-text-dim'}`}>
            {spell.is_canonical ? 'канонічне' : 'спільнота'}
          </span>
          {spell.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{spell.name}</h1>
        <AuthorBadge username={spell.owner_username} size="sm" className="px-5 pb-2" />

        {levels.length > 1 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-2 pt-1">
            {levels.map((_, i) => (
              <button
                key={i} type="button"
                onClick={() => setActiveLevel(i)}
                className={`rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                  activeLevel === i ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'
                }`}
              >
                Рівень {i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Stats grid */}
        <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3">
          {complexity && <SheetStat label="Складність" value={complexity.label} />}
          <SheetStat label="Магічна енергія" value={level.energy_cost} />
          <SheetStat label="Час виконання" value={`${level.action_time} ${level.action_time === 1 ? 'дія' : 'дії'}`} />
          {ritual && <SheetStat label="Ритуал" value={`${ritual.symbol} ${ritual.label}`} />}
          <SheetStat label="Тривалість" value={formatDuration(level.duration_value, level.duration_unit)} />
          {level.range_desc && <SheetStat label="Дальність" value={level.range_desc} />}
          {spell.parent_spell && (
            <SheetStat
              label="Потрібно вивчити"
              value={<Link to={`/spellbook/${spell.parent_spell.id}`} className="text-accent hover:underline">{spell.parent_spell.name}</Link>}
            />
          )}
          {level.lore_creator && (
            <SheetStat
              label="Творець"
              value={level.lore_creator_npc_id
                ? <Link to={`/compendium/entries/${level.lore_creator_npc_id}`} className="text-accent hover:underline">{level.lore_creator}</Link>
                : level.lore_creator}
            />
          )}
        </div>

        {level.components?.length > 0 && (
          <Section title="Компоненти">
            <ul className="flex flex-col gap-1.5">
              {level.components.map((c, i) => {
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
          </Section>
        )}

        {level.mechanical_desc && (
          <Section title="Механічний опис">
            <SmartTextReader text={level.mechanical_desc} className="text-[0.95rem] leading-relaxed text-text" />
          </Section>
        )}

        {level.narrative_desc && (
          <Section title="Наративний опис">
            <SmartTextReader text={level.narrative_desc} className="text-[0.95rem] italic leading-relaxed text-text-dim" />
          </Section>
        )}

        {/* Лише коли заклинання справді має батька чи похідних. */}
        {treeNodes.length > 1 && (
          <Section title="Дерево заклинань">
            <SpellTree nodes={treeNodes} currentId={spell.id} />
          </Section>
        )}

        {spell.prerequisite_nodes?.length > 0 && (
          <Section title="Вимоги дерева розвитку">
            <div className="flex flex-col gap-1.5">
              {spell.prerequisite_nodes.map((n) => (
                <span key={n.id} className="flex items-center gap-1.5 text-sm text-text">
                  <ReqBadge type={spell.prerequisite_logic === 'and' ? 'required' : 'optional'} />
                  {n.title}
                </span>
              ))}
            </div>
          </Section>
        )}

        {canManageCanonical && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" onClick={() => handleSetCanonical(!spell.is_canonical)} disabled={settingCanonical}>
              {settingCanonical ? 'Позначення...' : spell.is_canonical ? 'Зняти позначку «канонічне»' : 'Зробити канонічним'}
            </Button>
          </div>
        )}

        {isAdmin && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <ChangeOwnerControl onSubmit={handleSetOwner} />
          </div>
        )}

        {(spell.is_owner || isAdmin) && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/spellbook/${id}/edit`}>Редагувати</Button>
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
      <span className="text-sm font-semibold text-text">{value || '—'}</span>
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
