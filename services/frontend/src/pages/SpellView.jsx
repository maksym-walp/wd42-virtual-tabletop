import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import api from '../api/client';
import { MAGIC_TYPES, RITUAL_TYPES, SPELL_KINDS, formatDuration } from '../constants/spellbook';
import { recordView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import ReqBadge from '../components/ui/ReqBadge';
import DiceFormulaText from '../components/DiceFormulaText';

export default function SpellView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [spell, setSpell] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.get(`/api/spellbook/${id}`)
      .then(({ data }) => {
        setSpell(data.spell);
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
      navigate('/spellbook');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!spell) return null;

  const type = MAGIC_TYPES[spell.magic_type];
  const ritual = RITUAL_TYPES[spell.ritual];
  const kind = SPELL_KINDS[spell.spell_kind];
  const componentLabels = (spell.components || []).filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/spellbook" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Книга заклинань
      </Link>

      <div
        className="overflow-hidden rounded-lg border border-border bg-surface"
        style={{ borderTop: `3px solid ${type.color}` }}
      >
        {spell.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={spell.image_url} alt={spell.name} className="h-full w-full object-cover" />
          </div>
        )}

        {/* Type header */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5" style={{ background: type.bg }}>
          <span
            className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ color: type.color, borderColor: type.color }}
          >
            {type.label}
          </span>
          {kind && <span className="rounded border border-border px-1.5 py-0.5 text-xs font-semibold text-text-dim">{kind.label}</span>}
          {spell.is_public && <span className="text-xs italic text-text-dim">публічне</span>}
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{spell.name}</h1>

        {/* Stats grid */}
        <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-3">
          <SheetStat label="Магічна енергія" value={spell.energy_cost} accent={type.color} />
          <SheetStat label="Час виконання" value={`${spell.action_time} ${spell.action_time === 1 ? 'дія' : 'дії'}`} accent={type.color} />
          <SheetStat label="Ритуал" value={`${ritual.symbol} ${ritual.label}`} accent={type.color} />
          <SheetStat label="Тривалість" value={formatDuration(spell.duration_value, spell.duration_unit)} accent={type.color} />
          {spell.range_desc && <SheetStat label="Дальність" value={spell.range_desc} accent={type.color} />}
          {componentLabels && <SheetStat label="Компоненти" value={componentLabels} accent={type.color} />}
        </div>

        {spell.mechanical_desc && (
          <Section title="Механічний опис">
            <p className="text-[0.95rem] leading-relaxed text-text">
              <DiceFormulaText text={spell.mechanical_desc} />
            </p>
          </Section>
        )}

        {spell.narrative_desc && (
          <Section title="Наративний опис">
            <p className="text-[0.95rem] italic leading-relaxed text-text-dim">
              <DiceFormulaText text={spell.narrative_desc} />
            </p>
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

        {spell.is_owner && (
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

function SheetStat({ label, value, accent }) {
  return (
    <div className="flex flex-col gap-0.5 bg-surface px-3 py-2">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: accent + 'aa' }}>
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
