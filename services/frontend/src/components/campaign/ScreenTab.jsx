import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Sparkles, Shield, Skull, Lock, Dices, Plus } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import characterApi from '../../api/characterSheet';
import useDebounce from '../../hooks/useDebounce';
import Card from '../ui/Card';
import Button from '../ui/Button';
import SmartTextarea from '../ui/SmartTextarea';
import useBoard from './useBoard';
import BoardGrid from './BoardGrid';
import useCharacterConfig from '../../hooks/useCharacterConfig';
import {
  computeMaxHp, computeMaxMagic, computePassiveDefense,
} from '../../utils/characterCombatStats';
import {
  ARCHETYPES, CHARACTERISTICS, skillsToCharLevel,
} from '../../constants/characterSheet';
import { raceLabel } from '../../utils/characterRace';
import { effectChips, chipClass } from '../../utils/effectChips';
import { useAuth } from '../../context/AuthContext';
import ActivityTimerPanel from './ActivityTimerPanel';
import { RestResultModal } from '../character/RestControls';

// Зміни з листа персонажа йдуть повз campaigns-сервіс (окрім ХП, яке він
// синхронізує сам), тож статблоки ще й зрідка перечитуються.
const STATBLOCK_POLL_MS = 30000;

// Скільки досвіду майстер видає всім одним натисканням.
const EXPERIENCE_STEPS = [1, 2, 5];

const CHARACTERISTIC_ABBR = {
  agility: 'Спр', physique: 'Тіл', intellect: 'Інт', wisdom: 'Мдр', charisma: 'Хар',
};

// ================================================================
// Ширма: лише для майстра/адміна. Статблоки персонажів гравців,
// картки підготовки (НІПи, бестіарій, ...) і приватні нотатки.
// ================================================================

export default function ScreenTab({ campaign, characters, onChange, screenVersion, charactersVersion }) {
  const board = useBoard(campaign.id, 'screen');
  const { reload } = board;

  useEffect(() => { if (screenVersion) reload(); }, [screenVersion, reload]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_20rem]">
      <section className="min-w-0">
        <PlayerStatblocks campaignId={campaign.id} characters={characters} version={charactersVersion} />
      </section>
      <section className="min-w-0">
        <BoardGrid
          board={board}
          zone="screen"
          manager
          campaignId={campaign.id}
          title="Картки за ширмою"
          emptyTitle="За ширмою порожньо"
          emptyHint="Підготуйте НІПів, істот, заклинання чи сюжетні картки — і покладіть на Стіл, коли настане час."
          columns="sm:grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2"
        />
      </section>
      <section className="min-w-0 lg:col-span-2 xl:col-span-1">
        <div className="xl:sticky xl:top-4">
          <GmNotes campaign={campaign} onChange={onChange} />
        </div>
      </section>
    </div>
  );
}

function GmNotes({ campaign, onChange }) {
  const [notes, setNotes] = useState(campaign.gm_notes ?? '');
  const [saving, setSaving] = useState(false);

  const save = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateGmNotes(campaign.id, value);
      onChange((prev) => ({ ...prev, gm_notes: updated.gm_notes }));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 font-display text-lg text-text">Нотатки майстра</h3>
        {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
      </div>
      <SmartTextarea
        rows={14}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); save(e.target.value); }}
        placeholder="Сюжетні лінії, таємниці, плани на наступну сесію..."
      />
    </Card>
  );
}

function PlayerStatblocks({ campaignId, characters, version }) {
  const { user } = useAuth();
  const { conditions: conditionsConfig } = useCharacterConfig();
  const conditionLabels = Object.fromEntries(conditionsConfig.map((cond) => [cond.key, cond.label]));
  const [sheets, setSheets] = useState({});
  const [errors, setErrors] = useState({});
  // Відпочинок, який натиснув гравець, — показуємо майстрові модалкою.
  // lastRestSeen: id персонажа → at останнього відомого відпочинку.
  const lastRestSeen = useRef(null);
  const [incomingRest, setIncomingRest] = useState(null);

  const ids = characters.map((c) => c.character_id).join(',');

  const load = useCallback(async () => {
    const list = ids ? ids.split(',') : [];
    const results = await Promise.allSettled(list.map((id) => characterApi.getSheet(id)));
    const nextSheets = {};
    const nextErrors = {};
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') nextSheets[list[i]] = r.value;
      else nextErrors[list[i]] = true;
    });
    setSheets(nextSheets);
    setErrors(nextErrors);

    const firstLoad = lastRestSeen.current === null;
    const seen = lastRestSeen.current ?? {};
    for (const [characterId, sheet] of Object.entries(nextSheets)) {
      const rest = sheet.character.last_rest;
      if (!rest?.at || seen[characterId] === rest.at) continue;
      seen[characterId] = rest.at;
      if (!firstLoad && rest.by?.user_id !== user?.id) setIncomingRest({ rest, name: sheet.character.name });
    }
    lastRestSeen.current = seen;
  }, [ids, user?.id]);

  useEffect(() => { load(); }, [load, version]);

  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const timer = setInterval(tick, STATBLOCK_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  // Ігрове натхнення: inspiration_used=false — персонаж його має. Оновлюємо
  // оптимістично; якщо збереження не вдалось — перечитуємо лист.
  const setInspiration = async (characterId, held) => {
    const used = !held;
    setSheets((prev) => {
      const sheet = prev[characterId];
      return sheet ? { ...prev, [characterId]: { ...sheet, character: { ...sheet.character, inspiration_used: used } } } : prev;
    });
    try {
      await characterApi.update(characterId, { inspiration_used: used });
    } catch {
      load();
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="m-0 font-display text-lg text-text">Персонажі</h3>
        {characters.length > 0 && <ExperienceGrant campaignId={campaignId} />}
      </div>
      {characters.length > 0 && (
        <ActivityTimerPanel campaignId={campaignId} characters={characters} sheets={sheets}
          labels={conditionLabels} onChanged={load} />
      )}
      {incomingRest && (
        <RestResultModal result={incomingRest.rest} characterName={incomingRest.name} labels={conditionLabels}
          onClose={() => setIncomingRest(null)} />
      )}
      {characters.length === 0 ? (
        <p className="text-sm text-text-dim">До кампанії ще не приєднано жодного персонажа.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {characters.map((ch) => (
            <Statblock
              key={ch.character_id}
              entry={ch}
              sheet={sheets[ch.character_id]}
              failed={errors[ch.character_id]}
              onInspirationChange={(held) => setInspiration(ch.character_id, held)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Видача досвіду всім персонажам кампанії. Нові значення підтягнуться
// real-time подією 'characters', яку публікує бекенд.
function ExperienceGrant({ campaignId }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }

  const grant = async (amount) => {
    setBusy(true);
    setStatus(null);
    try {
      const { updated } = await campaignApi.grantExperience(campaignId, amount);
      setStatus({ ok: true, text: `+${amount} досвіду · персонажів: ${updated}` });
    } catch (err) {
      setStatus({ ok: false, text: err.response?.data?.message || 'Помилка при видачі досвіду' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2" title="Видати досвід усім персонажам">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Досвід</span>
      {EXPERIENCE_STEPS.map((amount) => (
        <Button key={amount} variant="ghost" size="sm" disabled={busy} onClick={() => grant(amount)}>
          +{amount}
        </Button>
      ))}
      {status && (
        <span role="status" className={`text-xs ${status.ok ? 'text-sage' : 'text-danger'}`}>{status.text}</span>
      )}
    </div>
  );
}

// Правий верхній кут картки: «+» видає ігрове натхнення, а видане показане
// кубиком за харизмою персонажа (повторне натискання забирає його).
function InspirationControl({ held, die, onChange }) {
  if (!held) {
    return (
      <button type="button" onClick={() => onChange(true)}
        title="Видати ігрове натхнення" aria-label="Видати ігрове натхнення"
        className="inline-flex shrink-0 items-center gap-0.5 rounded-md border border-dashed border-border px-1.5 py-1 text-text-dim hover:border-gold/60 hover:text-gold">
        <Dices size={14} /><Plus size={12} />
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onChange(false)}
      title={`Ігрове натхнення (${die === '—' ? 'без кубика' : die}) — натисніть, щоб забрати`}
      aria-label="Забрати ігрове натхнення"
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gold/60 bg-gold/10 px-1.5 py-1 text-xs font-bold text-gold hover:bg-gold/20">
      <Dices size={14} />{die}
    </button>
  );
}

function Meter({ icon: Icon, label, value, max, extra, tone }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1 text-text-dim"><Icon size={12} /> {label}</span>
        <span className="font-semibold text-text">
          {value} / {max}{extra ? <span className="text-text-dim"> {extra}</span> : null}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-bg">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Statblock({ entry, sheet, failed, onInspirationChange }) {
  const { conditions: conditionsConfig } = useCharacterConfig();
  const conditionLabels = Object.fromEntries(conditionsConfig.map((cond) => [cond.key, cond.label]));
  const charisma = CHARACTERISTICS.find((ch) => ch.key === 'charisma');
  const skillLevels = Object.fromEntries((sheet?.skills ?? []).map((s) => [s.skill_key, s.value]));
  const inspirationDie = charisma?.effect(
    skillsToCharLevel(charisma.skills.map((s) => skillLevels[s.key] ?? 1)),
  ) ?? '—';
  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <Link to={`/characters/${entry.character_id}`} className="font-display text-lg leading-tight text-accent hover:underline">
          {entry.character_name}
        </Link>
        <p className="text-xs text-text-dim">
          {ARCHETYPES[entry.archetype]?.label ?? entry.archetype} · {raceLabel(entry)} · {entry.owner_username}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {entry.is_private && <Lock size={14} className="text-text-dim" aria-label="Приватний персонаж" />}
        {sheet && (
          <InspirationControl held={!sheet.character.inspiration_used} die={inspirationDie} onChange={onInspirationChange} />
        )}
      </div>
    </div>
  );

  if (!sheet) {
    return (
      <Card className="p-4">
        {header}
        <p className="mt-3 text-sm text-text-dim">{failed ? 'Не вдалось завантажити лист персонажа.' : 'Завантаження...'}</p>
      </Card>
    );
  }

  const { character: c, skills, equipment, effects } = sheet;
  const maxHp = computeMaxHp(c, skills);
  const maxMagic = computeMaxMagic(c, skills, effects);
  const defense = computePassiveDefense(equipment, c.defense_bonus, effects?.passive_defense_factor);
  const chips = effectChips(effects, { conditionLabels });
  const skillMap = Object.fromEntries((skills ?? []).map((s) => [s.skill_key, s.value]));
  const conditions = (c.conditions ?? []).filter((cond) => cond.level > 0);

  return (
    <Card className="flex flex-col gap-3 p-4">
      {header}

      <div className="flex flex-col gap-2">
        <Meter icon={Heart} label="Здоровʼя" value={c.current_hp} max={maxHp}
          extra={c.temp_hp ? `+${c.temp_hp}` : null} tone="bg-danger" />
        <Meter icon={Sparkles} label="Магія" value={c.current_magic} max={maxMagic} tone="bg-accent" />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-dim">
        <span className="inline-flex items-center gap-1"><Shield size={12} /> Захист <b className="text-text">{defense}</b></span>
        <span>Досвід <b className="text-text">{c.experience_points}</b></span>
        {c.death_scale != null && c.death_scale !== 0 && (
          <span className="inline-flex items-center gap-1 text-danger">
            <Skull size={12} /> Шкала смерті {c.death_scale > 0 ? `+${c.death_scale}` : c.death_scale}
          </span>
        )}
      </div>

      <div className="grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
        {CHARACTERISTICS.map((ch) => (
          <div key={ch.key} className="bg-surface px-1 py-1.5">
            <p className="truncate text-[0.6rem] font-semibold uppercase tracking-wide text-text-dim" title={ch.label}>
              {CHARACTERISTIC_ABBR[ch.key] ?? ch.label.slice(0, 3)}
            </p>
            <p className="text-sm font-semibold text-text">
              {skillsToCharLevel(ch.skills.map((s) => skillMap[s.key] ?? 1))}
            </p>
          </div>
        ))}
      </div>

      {conditions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {conditions.map((cond) => (
            <span key={cond.type} className="rounded border border-danger/40 px-1.5 py-0.5 text-xs text-danger">
              {conditionLabels[cond.type] ?? cond.type} {cond.level}
            </span>
          ))}
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => <span key={chip.key} className={chipClass(chip.tone)}>{chip.text}</span>)}
        </div>
      )}
    </Card>
  );
}
