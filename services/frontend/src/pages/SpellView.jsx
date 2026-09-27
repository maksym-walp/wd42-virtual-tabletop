import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { NATURE_TYPES, RITUAL_TYPES, SPELL_KINDS, SPELL_COMPLEXITIES, formatDuration, spellForms } from '../constants/spellbook';
import { recordView, removeView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';
import SmartTextReader from '../components/SmartTextReader';
import AuthorBadge from '../components/AuthorBadge';
import ChangeOwnerControl from '../components/ChangeOwnerControl';
import { useAuth } from '../context/AuthContext';
import ShareButton from '../components/ShareButton';

export default function SpellView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spell, setSpell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [settingCanonical, setSettingCanonical] = useState(false);
  const [activeForm, setActiveForm] = useState('main');

  useEffect(() => {
    api.get(`/api/spellbook/${id}`)
      .then(({ data }) => {
        setSpell(data.spell);
        setActiveForm('main');
        recordView({ type: 'spell', id, name: data.spell.name, href: `/spellbook/${id}`, image_url: data.spell.image_url });
      })
      .catch(() => navigate('/spellbook', { replace: true }))
      .finally(() => setLoading(false));
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
  const forms = spellForms(spell);
  // Поля форми (механіка, описи, компоненти) — з обраної форми; решта — зі spell.
  const shown = forms.find((f) => f.key === activeForm) ?? forms.find((f) => f.key === 'main');
  const ritual = RITUAL_TYPES[shown.ritual];
  const kind = SPELL_KINDS[shown.spell_kind];
  const complexity = SPELL_COMPLEXITIES[shown.complexity];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/spellbook" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Книга заклинань
      </Link>

      {/* Десктоп: ліворуч — лор (назва, автор, природа, традиції, форми,
          наративний опис), праворуч — уся механіка. На мобільному — одна
          колонка в тому ж порядку. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-4 lg:self-start">
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
            <span className={`text-xs italic ${spell.is_canonical ? 'text-gold' : 'text-text-dim'}`}>
              {spell.is_canonical ? 'канонічне' : 'спільнота'}
            </span>
            {spell.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
            <h1 className="font-display text-3xl text-accent">{spell.name}</h1>
            <ShareButton className="mt-1" />
          </div>
          <AuthorBadge username={spell.owner_username} size="sm" className="px-5 pb-2" />

          {shown.lore_creator && (
            <p className="px-5 pb-2 text-sm text-text-dim">
              Творець:{' '}
              {shown.lore_creator_npc_id
                ? <Link to={`/compendium/entries/${shown.lore_creator_npc_id}`} className="text-accent hover:underline">{shown.lore_creator}</Link>
                : <span className="text-text">{shown.lore_creator}</span>}
            </p>
          )}

          {spell.traditions?.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Традиції:</span>
              {spell.traditions.map((t) => (
                <Link
                  key={t.id}
                  to={`/spellbook/traditions/${t.id}`}
                  className="rounded border border-border px-2 py-0.5 text-xs font-semibold text-accent hover:bg-surface-hover"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          {forms.length > 1 && (
            <Section title="Форми">
              <div className="flex flex-wrap gap-1.5">
                {forms.map((f) => (
                  <button
                    key={f.key} type="button"
                    onClick={() => setActiveForm(f.key)}
                    className={`rounded border px-3 py-1 text-xs font-semibold transition-colors ${
                      shown.key === f.key ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </Section>
          )}

          {shown.narrative_desc && (
            <Section title="Наративний опис">
              <SmartTextReader text={shown.narrative_desc} className="text-[0.95rem] italic leading-relaxed text-text-dim" />
            </Section>
          )}
        </div>

        <div className="self-start overflow-hidden rounded-lg border border-border bg-surface">
          {forms.length > 1 && (
            <div className="border-b border-border bg-surface-hover px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-text-dim">
              {shown.label}
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px border-b border-border bg-border sm:grid-cols-3">
            {complexity && <SheetStat label="Складність" value={complexity.label} />}
            {kind && <SheetStat label="Вид" value={kind.label} />}
            <SheetStat label="Магічна енергія" value={shown.energy_cost} />
            <SheetStat label="Час виконання" value={`${shown.action_time} ${shown.action_time === 1 ? 'дія' : 'дії'}`} />
            {ritual && <SheetStat label="Ритуал" value={`${ritual.symbol} ${ritual.label}`} />}
            <SheetStat label="Тривалість" value={formatDuration(shown.duration_value, shown.duration_unit)} />
            {shown.range_desc && <SheetStat label="Дальність" value={shown.range_desc} />}
          </div>

          {shown.components?.length > 0 && (
            <Section title="Компоненти">
              <ul className="flex flex-col gap-1.5">
                {shown.components.map((c, i) => {
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

          {shown.mechanical_desc && (
            <Section title="Механічний опис">
              <SmartTextReader text={shown.mechanical_desc} className="text-[0.95rem] leading-relaxed text-text" />
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
