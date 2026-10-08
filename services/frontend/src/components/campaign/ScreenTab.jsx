import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Sparkles, Shield, Skull, Lock } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import characterApi from '../../api/characterSheet';
import useDebounce from '../../hooks/useDebounce';
import Card from '../ui/Card';
import SmartTextarea from '../ui/SmartTextarea';
import useBoard from './useBoard';
import BoardGrid from './BoardGrid';
import useCharacterConfig from '../../hooks/useCharacterConfig';
import {
  computeMaxHp, computeMaxMagic, computePassiveDefense,
} from '../../utils/characterCombatStats';
import {
  ARCHETYPES, RACES, CHARACTERISTICS, skillsToCharLevel,
} from '../../constants/characterSheet';

// Зміни з листа персонажа йдуть повз campaigns-сервіс (окрім ХП, яке він
// синхронізує сам), тож статблоки ще й зрідка перечитуються.
const STATBLOCK_POLL_MS = 30000;

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
        <PlayerStatblocks characters={characters} version={charactersVersion} />
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

function PlayerStatblocks({ characters, version }) {
  const [sheets, setSheets] = useState({});
  const [errors, setErrors] = useState({});

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
  }, [ids]);

  useEffect(() => { load(); }, [load, version]);

  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const timer = setInterval(tick, STATBLOCK_POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [load]);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="m-0 font-display text-lg text-text">Персонажі гравців</h3>
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
            />
          ))}
        </div>
      )}
    </div>
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

function Statblock({ entry, sheet, failed }) {
  const { conditions: conditionsConfig } = useCharacterConfig();
  const conditionLabels = Object.fromEntries(conditionsConfig.map((cond) => [cond.key, cond.label]));
  const header = (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <Link to={`/characters/${entry.character_id}`} className="font-display text-lg leading-tight text-accent hover:underline">
          {entry.character_name}
        </Link>
        <p className="text-xs text-text-dim">
          {ARCHETYPES[entry.archetype]?.label ?? entry.archetype} · {RACES[entry.race]?.label ?? entry.race} · {entry.owner_username}
        </p>
      </div>
      {entry.is_private && <Lock size={14} className="mt-1 shrink-0 text-text-dim" aria-label="Приватний персонаж" />}
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

  const { character: c, skills, equipment } = sheet;
  const maxHp = computeMaxHp(c, skills);
  const maxMagic = computeMaxMagic(c, skills);
  const defense = computePassiveDefense(equipment, c.defense_bonus);
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
    </Card>
  );
}
