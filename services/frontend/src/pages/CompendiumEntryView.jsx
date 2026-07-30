import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import compendiumApi from '../api/compendium';
import { ENTITY_TYPES as ENTITY_TYPES_LIGHT, ENTITY_TYPES_DARK, ATTRIBUTE_LABELS } from '../constants/compendium';
import { recordView, removeView } from '../utils/recentlyViewed';
import Button from '../components/ui/Button';
import RollButton from '../components/RollButton';
import SmartTextReader from '../components/SmartTextReader';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABELS);

export default function CompendiumEntryView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const ENTITY_TYPES = theme === 'dark' ? ENTITY_TYPES_DARK : ENTITY_TYPES_LIGHT;

  const [entry, setEntry] = useState(null);
  const [species, setSpecies] = useState(null);
  const [subspecies, setSubspecies] = useState(null);
  const [equipment, setEquipment] = useState([]);
  const [spells, setSpells] = useState([]);
  const [maneuvers, setManeuvers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    compendiumApi.getEntry(id)
      .then((e) => {
        if (cancelled) return;
        setEntry(e);
        recordView({ type: 'compendium-entry', id, name: e.name, href: `/compendium/entries/${id}`, image_url: e.image_url });
        if (e.species_id) compendiumApi.getSpecies(e.species_id).then(setSpecies).catch(() => {});
        if (e.subspecies_id) compendiumApi.getSubspecies(e.subspecies_id).then(setSubspecies).catch(() => {});
        compendiumApi.listEntryEquipment(id).then(setEquipment).catch(() => {});
        compendiumApi.listEntrySpells(id).then(setSpells).catch(() => {});
        compendiumApi.listEntryManeuvers(id).then(setManeuvers).catch(() => {});
      })
      .catch(() => { if (!cancelled) navigate('/compendium', { replace: true }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // NPC health is rolled once and persisted (compendium_entries.rolled_health)
  // — this is what campaigns pulls when cloning the NPC into a combat scene.
  // Creatures keep the old behaviour: the roll button next to their health
  // formula is a plain, ephemeral RollButton (see below), nothing stored.
  const handleRollHealth = async (total) => {
    try {
      const updated = await compendiumApi.updateEntryHealth(id, total);
      setEntry(updated);
    } catch {
      // network/validation error — entry keeps showing its last known value
    }
  };

  const handleDelete = async () => {
    if (!confirm('Видалити цей запис?')) return;
    setDeleting(true);
    try {
      await compendiumApi.removeEntry(id);
      removeView('compendium-entry', id);
      navigate(entry.entity_type === 'npc' ? '/compendium' : '/compendium/bestiary');
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!entry) return null;

  const isAdmin = user?.role === 'admin';
  const type = ENTITY_TYPES[entry.entity_type] || ENTITY_TYPES.npc;
  const isNpc = entry.entity_type === 'npc';

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link
        to={isNpc ? '/compendium' : '/compendium/bestiary'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim"
      >
        <ArrowLeft size={15} /> {isNpc ? 'НІПи' : 'Бестіарій'}
      </Link>

      <div className="overflow-hidden rounded-lg border border-border bg-surface" style={{ borderTop: `3px solid ${type.color}` }}>
        {entry.image_url && (
          <div className="aspect-[16/9] w-full overflow-hidden bg-bg">
            <img src={entry.image_url} alt={entry.name} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5" style={{ background: type.bg }}>
          <span className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide" style={{ color: type.color, borderColor: type.color }}>
            {type.label}
          </span>
          {species && <Link to={`/compendium/species/${species.id}`} className="text-xs text-text-dim hover:text-accent">{species.name}</Link>}
          {subspecies && <span className="text-xs text-text-dim">· {subspecies.name}</span>}
          {entry.is_public && <span className="ml-auto text-xs italic text-text-dim">публічний</span>}
        </div>

        <h1 className="px-5 pb-2 pt-4 font-display text-3xl text-accent">{entry.name}</h1>

        <div className="my-2 grid grid-cols-2 gap-px border-y border-border bg-border sm:grid-cols-5">
          {ATTRIBUTE_KEYS.map((key) => (
            <SheetStat key={key} label={ATTRIBUTE_LABELS[key]} value={entry[key]} accent={type.color} />
          ))}
        </div>

        {entry.health && (
          <div className="flex items-center justify-between border-b border-border bg-surface px-5 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Здоров'я</span>
            {isNpc ? (
              <div className="flex items-center gap-3">
                {entry.health.rolled != null && (
                  <span className="text-sm font-semibold text-text">{entry.health.rolled}</span>
                )}
                {(entry.is_owner || isAdmin) ? (
                  <RollButton
                    formula={entry.health.formula}
                    title={`Кинути ${entry.health.formula}`}
                    onResult={(result) => handleRollHealth(result.total)}
                  >
                    {entry.health.rolled != null ? `Перекинути (${entry.health.formula})` : entry.health.formula}
                  </RollButton>
                ) : entry.health.rolled == null && (
                  <span className="text-sm italic text-text-dim">не кинуто</span>
                )}
              </div>
            ) : (
              <RollButton formula={entry.health.formula} title={`Кинути ${entry.health.formula}`}>
                {entry.health.formula}
              </RollButton>
            )}
          </div>
        )}

        <Section title="Навички">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {(entry.skills || []).map((skill) => (
              <div key={skill.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-text-dim">{skill.label}</span>
                <RollButton formula={`1${skill.dice}`} title={`Кинути ${skill.dice}`}>{skill.dice}</RollButton>
              </div>
            ))}
          </div>
        </Section>

        {isNpc ? (
          (entry.description || entry.motivation || entry.backstory || entry.faction) && (
            <Section title="Опис">
              <div className="flex flex-col gap-3">
                {entry.description && (
                  <p className="text-[0.95rem] leading-relaxed text-text"><SmartTextReader text={entry.description} /></p>
                )}
                {entry.motivation && (
                  <Subfield label="Мотивація">
                    <p className="text-[0.95rem] leading-relaxed text-text"><SmartTextReader text={entry.motivation} /></p>
                  </Subfield>
                )}
                {entry.backstory && (
                  <Subfield label="Передісторія">
                    <p className="text-[0.95rem] italic leading-relaxed text-text-dim"><SmartTextReader text={entry.backstory} /></p>
                  </Subfield>
                )}
                {entry.faction && (
                  <Subfield label="Фракція">
                    <p className="text-[0.95rem] text-text">{entry.faction}</p>
                  </Subfield>
                )}
              </div>
            </Section>
          )
        ) : (
          (entry.description || entry.history) && (
            <Section title="Опис">
              <div className="flex flex-col gap-3">
                {entry.description && (
                  <p className="text-[0.95rem] leading-relaxed text-text"><SmartTextReader text={entry.description} /></p>
                )}
                {entry.history && (
                  <Subfield label="Походження">
                    <p className="text-[0.95rem] italic leading-relaxed text-text-dim"><SmartTextReader text={entry.history} /></p>
                  </Subfield>
                )}
              </div>
            </Section>
          )
        )}

        {equipment.length > 0 && (
          <Section title="Спорядження">
            <ul className="flex flex-col gap-1.5">
              {equipment.map((e) => (
                <li key={e.equipment_id} className="text-sm text-text">
                  {e.equipment ? <Link to={`/equipment/${e.equipment.id}`} className="text-accent hover:underline">{e.equipment.name}</Link> : '(невідомо)'}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {spells.length > 0 && (
          <Section title="Заклинання">
            <ul className="flex flex-col gap-1.5">
              {spells.map((s) => (
                <li key={s.spell_id} className="text-sm text-text">
                  {s.spell ? <Link to={`/spellbook/${s.spell.id}`} className="text-accent hover:underline">{s.spell.name}</Link> : '(невідомо)'}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {maneuvers.length > 0 && (
          <Section title="Маневри">
            <ul className="flex flex-col gap-1.5">
              {maneuvers.map((m) => (
                <li key={m.maneuver_id} className="text-sm text-text">
                  {m.maneuver ? <Link to={`/maneuvers/${m.maneuver.id}`} className="text-accent hover:underline">{m.maneuver.name}</Link> : '(невідомо)'}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {(entry.is_owner || isAdmin) && (
          <div className="flex gap-3 border-t border-border px-5 py-4">
            <Button variant="ghost" to={`/compendium/entries/${id}/edit`}>Редагувати</Button>
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
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: accent + 'aa' }}>{label}</span>
      <span className="text-sm font-semibold text-text">{value ?? '—'}</span>
    </div>
  );
}

function Subfield({ label, children }) {
  return (
    <div>
      <span className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-wide text-text-dim">{label}</span>
      {children}
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
