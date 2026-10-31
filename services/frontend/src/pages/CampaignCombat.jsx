import { useEffect, useState, useRef, useCallback } from 'react';
import { Eye, EyeOff, Trash2, Plus, Minus, Upload, User, Heart, Tag, FileText, Footprints, Dices, Swords, Skull } from 'lucide-react';
import campaignApi from '../api/campaigns';
import characterApi from '../api/characterSheet';
import npcsApi from '../api/npcs';
import bestiaryApi from '../api/bestiary';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import { computeMaxHp, computePassiveDefense } from '../utils/characterCombatStats';
import { buildRollFormula, mergeRollModes } from '../utils/rollProfile';
import { combatantProfile, combatantWeapons } from '../utils/combatantProfile';
import { SKILL_TARGETS } from '../constants/nodeModifiers';
import { effectChips, chipClass } from '../utils/effectChips';
import { formatCheck } from '../components/character/RestControls';
import { useDice } from '../context/DiceContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import IntInput from '../components/ui/IntInput';
import Sheet from '../components/ui/Sheet';
import RollButton from '../components/RollButton';

// Filenames matching a column key (e.g. assets/combat-icons/health.svg) are
// picked up automatically — no code change needed once custom art is dropped
// into that folder. Falls back to the built-in Lucide/hand-drawn icon below.
function imagesByKey(globResult) {
  const map = {};
  for (const [path, url] of Object.entries(globResult)) {
    const key = path.match(/([^/]+)\.[a-z]+$/i)?.[1];
    if (key) map[key] = url;
  }
  return map;
}

const customColumnIcons = imagesByKey(
  import.meta.glob('../assets/combat-icons/*.{png,svg}', { eager: true, import: 'default' })
);

const POLL_INTERVAL_MS = 30000;

// Компактні числові поля в рядках таблиці комбатантів. Не перевикористовує
// inputClass (той зроблений під повнорозмірні форми, з py-2.5/min-h-11) —
// раніше тут дописувались "py-1 w-16" ПІСЛЯ inputClass сподіваючись
// перебити його, але Tailwind вирішує конфлікт порядком класів у
// згенерованому CSS, а не порядком у className, тож py-2.5 з inputClass
// мовчки перемагав: поле лишалось високим і майже без горизонтального
// місця під цифри, а в тісному flex-ряду ще й стискалось (без shrink-0)
// до кількох пікселів — значення реально зберігалось, просто його не було
// видно. Тому власний, самодостатній набір класів без цього конфлікту.
const compactInputClass =
  'shrink-0 rounded-lg border border-border bg-bg px-1.5 py-1 text-sm text-text ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

const EMPTY_NPC_FORM = {
  name: '', passive_defense: 0, active_defense: 0, health: 0, max_health: 0,
  temp_hp: 0, initiative: 0, notes: '', description: '',
};

// Гравці для NPC, де is_hidden === false, все одно не бачать точних чисел —
// рядок лишається (ім'я/опис для атмосфери), але цифри й нотатки затерті на
// фронті. NPC з is_hidden === true бекенд і так уже урізає до card-даних;
// тут ми просто не рендеримо такий рядок гравцю взагалі.
function filterForPlayers(combatants) {
  return combatants
    .filter((c) => c.character_id || !c.is_hidden)
    .map((c) => {
      if (c.character_id) return c;
      const { passive_defense, active_defense, health, initiative, notes, temp_hp, max_health, ...rest } = c;
      return rest;
    });
}

// "45+10/60" якщо є тимчасові ХП, інакше просто "55/60" (або "55", якщо
// максимальне ХП невідоме — типово для NPC, яким GM його не вказав).
function formatHp(health, tempHp, maxHealth) {
  if (health == null) return '—';
  const current = tempHp ? `${health}+${tempHp}` : `${health}`;
  return maxHealth != null ? `${current}/${maxHealth}` : current;
}

// "Розумне" ХП: голе число ("40") — абсолютне встановлення поточного ХП;
// "+5" — лікування (з обмеженням максимальним ХП, якщо воно відоме);
// "-5" — шкода, що спершу знімається з тимчасових ХП, а залишок — з поточних.
function applyHpInput(raw, { health, temp_hp, max_health }) {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = parseInt(trimmed, 10);
  if (Number.isNaN(n)) return null;

  const curHealth = health ?? 0;
  const curTemp = temp_hp ?? 0;
  const isDelta = trimmed[0] === '+' || trimmed[0] === '-';

  if (!isDelta) {
    const clamped = max_health != null ? Math.min(n, max_health) : n;
    return { health: Math.max(0, clamped), temp_hp: curTemp };
  }

  if (n > 0) {
    const healed = curHealth + n;
    const clamped = max_health != null ? Math.min(healed, max_health) : healed;
    return { health: Math.max(0, clamped), temp_hp: curTemp };
  }

  const damage = -n;
  const fromTemp = Math.min(curTemp, damage);
  const remaining = damage - fromTemp;
  return { health: Math.max(0, curHealth - remaining), temp_hp: curTemp - fromTemp };
}

// ================================================================
// Іконки заголовків таблиці. Lucide не має "нагрудника" чи "щита з
// ухиленою стрілою" — тому це власні SVG у тому ж стилі (24x24,
// stroke=currentColor), щоб виглядали як частина того самого набору іконок.
// ================================================================

function ChestplateIcon({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}
    >
      <path d="M12 2 8 4v3L4 9v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-4-2V4l-4-2Z" />
      <path d="M12 9v11" />
      <path d="M9 13h6" />
    </svg>
  );
}

// Щит, повз який пролітає стріла (ухилення) — на відміну від нагрудника
// (статичний захист броні), це про активне уникнення удару.
function DodgeShieldIcon({ size = 16, className = '', ...props }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} {...props}
    >
      <path d="M9 2 3 4.5v6c0 5 2.6 8 6 9.5 1-.44 1.93-.98 2.76-1.62" />
      <path d="M11 21 22 10" />
      <path d="M22 16v-6h-6" />
    </svg>
  );
}

// Сліди від кроків (порядок ходу) із маленьким "№" у кутку.
function InitiativeIcon({ size = 16, className = '', ...props }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }} {...props}>
      <Footprints size={size} />
      <span className="absolute -bottom-1 -right-1 rounded-full bg-surface-hover px-0.5 text-[8px] font-bold leading-none text-text-dim">
        №
      </span>
    </span>
  );
}

// Заголовки колонок таблиці комбатантів: іконка + title-тултип. "Опис"
// бачить лише майстер (players.description column is dropped entirely).
const COLUMN_HEADERS = [
  { key: 'name', label: "Ім'я", Icon: User },
  { key: 'passive_defense', label: 'Пасивний захист', Icon: ChestplateIcon },
  { key: 'active_defense', label: 'Ухилення', Icon: DodgeShieldIcon },
  { key: 'health', label: "Здоров'я", Icon: Heart },
  { key: 'initiative', label: 'Ініціатива', Icon: InitiativeIcon },
  { key: 'actions', label: 'Дії', Icon: Footprints },
  { key: 'notes', label: 'Примітки', Icon: Tag },
  { key: 'description', label: 'Опис', Icon: FileText, gmOnly: true },
];

export default function CombatTab({ campaignId, isGm, characters, version }) {
  const [scene, setScene] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Ефекти станів персонажів-комбатантів (GET /api/characters/effects):
  // модифікатор ініціативи, дії, реакції, героїчні дії.
  const [effectsById, setEffectsById] = useState({});
  const [endSummary, setEndSummary] = useState(null);
  // Журнал бою: кожен автоматичний кидок пояснює себе тому, кого він
  // стосується — навіть якщо кидав хтось інший за іншим екраном.
  const [log, setLog] = useState([]);

  const load = useCallback(() => (
    campaignApi.getCombat(campaignId)
      .then((data) => { setScene(data.scene); setCombatants(data.combatants); setLog(data.log ?? []); })
      .catch(() => setError('Не вдалось завантажити бойову сцену'))
  ), [campaignId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // Хід, раунд і ХП доходять миттєво через real-time подію 'combat'
  // (CampaignDetail → useCampaignEvents змінює version). Рідке опитування
  // лишається запасним шляхом на випадок розірваного стріму.
  useEffect(() => { if (version) load(); }, [version, load]);

  const characterIdsKey = [...new Set(combatants.map((c) => c.character_id).filter(Boolean))].sort().join(',');
  useEffect(() => {
    if (!characterIdsKey) { setEffectsById({}); return; }
    let alive = true;
    characterApi.getEffects(characterIdsKey.split(','))
      .then((byId) => { if (alive) setEffectsById(byId); })
      .catch(() => {});
    return () => { alive = false; };
  }, [characterIdsKey, version]);

  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  if (loading) return <p className="text-sm text-text-dim">Завантаження...</p>;

  if (!scene) {
    return isGm ? (
      <NoSceneYetGm campaignId={campaignId} onCreated={load} />
    ) : (
      <EmptyState icon="⚔" title="Бій ще не почався">
        Майстер ще не створив бойову сцену.
      </EmptyState>
    );
  }

  const visible = isGm ? combatants : filterForPlayers(combatants);
  const notActed = visible.filter((c) => !c.has_acted_this_round);
  const acted = visible.filter((c) => c.has_acted_this_round);

  // Чиї це персонажі — визначає, чи бачить гравець "розумне" поле ХП і
  // кубики ініціативи/захисту для конкретного рядка (лише для своїх).
  const myCharacterIds = new Set(characters.filter((c) => c.is_mine).map((c) => c.character_id));

  const handleNextTurn = async () => {
    setBusy(true);
    setError('');
    try {
      await campaignApi.nextTurn(campaignId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при переході до наступного ходу');
    } finally {
      setBusy(false);
    }
  };

  const handleNextRound = async () => {
    setBusy(true);
    setError('');
    try {
      await campaignApi.nextRound(campaignId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при переході до наступного раунду');
    } finally {
      setBusy(false);
    }
  };

  // Завершення бою: кожен розпочатий раунд — година таймера діяльності
  // персонажам-учасникам (повторне натискання годин не додає).
  const handleEndCombat = async () => {
    if (!window.confirm(`Завершити бій? Кожен персонаж-учасник отримає ${scene.round_number} год таймера діяльності (за розпочаті раунди).`)) return;
    setBusy(true);
    setError('');
    try {
      const summary = await campaignApi.endCombat(campaignId);
      setEndSummary(summary);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося завершити бій');
    } finally {
      setBusy(false);
    }
  };

  const handleNewScene = async () => {
    setBusy(true);
    setError('');
    try {
      await campaignApi.createCombatScene(campaignId, {});
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при створенні сцени');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteScene = async () => {
    if (!window.confirm('Видалити цю бойову сцену разом з усіма комбатантами?')) return;
    setBusy(true);
    setError('');
    try {
      await campaignApi.removeCombatScene(campaignId, scene.id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні сцени');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 font-display text-lg text-text">
            Раунд {scene.round_number}
            {scene.ended_at && <span className="ml-2 font-sans text-sm text-text-dim">· бій завершено</span>}
          </p>
          {isGm && (
            <div className="flex flex-wrap gap-2">
              {scene.ended_at ? (
                <Button size="sm" onClick={handleNewScene} disabled={busy}>Почати новий бій</Button>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={handleNextTurn} disabled={busy || notActed.length === 0}>
                    Наступний хід &gt;
                  </Button>
                  <Button size="sm" onClick={handleNextRound} disabled={busy}>
                    Наступний раунд &gt;&gt;
                  </Button>
                  <Button size="sm" variant="danger" onClick={handleEndCombat} disabled={busy}>
                    Завершити бій
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={handleDeleteScene} disabled={busy} aria-label="Видалити сцену">
                <Trash2 size={15} />
              </Button>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      {isGm && (
        <AddCombatantBar
          campaignId={campaignId}
          sceneId={scene.id}
          characters={characters}
          combatants={combatants}
          onAdded={load}
        />
      )}

      <CombatantsTable
        notActed={notActed}
        acted={acted}
        isGm={isGm}
        campaignId={campaignId}
        onChanged={load}
        myCharacterIds={myCharacterIds}
        effectsById={effectsById}
        combatants={visible}
      />

      <CombatLog entries={log} />

      {endSummary && <EndCombatSummary summary={endSummary} onClose={() => setEndSummary(null)} />}

      <SceneImage campaignId={campaignId} scene={scene} isGm={isGm} onChanged={load} />
    </div>
  );
}

// ================================================================
// Журнал бою: кожен автоматичний кидок пояснює себе — що кинули, проти
// чого порівняли і що з цього вийшло. Це єдиний спосіб для гравця, по
// якому щойно вдарили, побачити, чому в нього зникло здоровʼя: кидав
// хтось інший, за іншим екраном.
//
// Записи про прихованих комбатантів бекенд гравцям не віддає взагалі.
// ================================================================

const LOG_KIND_LABEL = {
  attack: 'Атака', dodge: 'Ухилення', initiative: 'Ініціатива',
  death_save: 'Рятівний кидок', damage: 'Шкода',
};

function CombatLog({ entries = [] }) {
  const [open, setOpen] = useState(true);
  if (!entries.length) return null;

  return (
    <Card className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="font-display text-sm text-text">Журнал бою</span>
        <span className="text-xs text-text-dim">{open ? 'згорнути' : `${entries.length} записів`}</span>
      </button>

      {open && (
        <ul className="mt-2 flex max-h-72 flex-col gap-1.5 overflow-y-auto text-sm">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-bg pb-1.5 last:border-0">
              <LogLine entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LogLine({ entry }) {
  const p = entry.payload || {};
  const actor = entry.actor_name || '—';

  if (entry.kind === 'attack') {
    const hit = p.hit || {};
    return (
      <div className="flex flex-col">
        <span className="text-text">
          <strong>{actor}</strong> атакує <strong>{entry.target_name || '—'}</strong>
          {p.weapon?.name ? ` (${p.weapon.name})` : ''}
          {': '}
          <span className={hit.hit ? 'font-semibold text-sage' : 'font-semibold text-danger'}>
            {hit.hit ? 'влучив' : 'промах'}
          </span>
        </span>
        <span className="text-xs text-text-dim">
          влучання {hit.total} проти захисту {hit.total_defense}
          {p.dodge ? ` (ухилення ${p.dodge.rolled})` : ''}
          {hit.wear > 0 ? `; захист ${hit.passive_before} → ${hit.passive_after}` : ''}
          {hit.hit ? `; шкода ${p.damage?.damage ?? 0} − ${p.damage?.absorbed ?? 0} = ${p.damage?.hp_damage ?? 0} ХП` : ''}
        </span>
        {p.sheet?.massive && <span className="text-xs font-semibold text-danger">масивна шкода — падіння з провалом</span>}
        {p.sheet?.trauma_suggested && <span className="text-xs font-semibold text-gold">можлива Травма</span>}
      </div>
    );
  }

  if (entry.kind === 'death_save') {
    return (
      <div className="flex flex-col">
        <span className="text-text">
          <strong>{actor}</strong> — рятівний кидок від смерті:{' '}
          <span className={p.success ? 'font-semibold text-sage' : 'font-semibold text-danger'}>
            {p.total} — {p.success ? 'успіх' : 'провал'}
          </span>
        </span>
        <span className="text-xs text-text-dim">
          маркер {p.death_scale}
          {p.awake ? ' — отямився' : ''}{p.dead ? ' — помер' : ''}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <span className="text-text">
        <strong>{actor}</strong> — {(LOG_KIND_LABEL[entry.kind] ?? entry.kind).toLowerCase()}: {p.total ?? '—'}
      </span>
      {p.formula && <span className="text-xs text-text-dim">{p.formula}</span>}
    </div>
  );
}

function EndCombatSummary({ summary, onClose }) {
  const applied = summary.results.filter((r) => !r.skipped);
  return (
    <Sheet open onClose={onClose} title="Бій завершено">
      {summary.already_ended ? (
        <p className="text-sm text-text-dim">Бій уже було завершено — години таймера повторно не додано.</p>
      ) : (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-text">
            Розпочатих раундів: <b>{summary.hours}</b> → по {summary.hours} год таймера діяльності.
          </p>
          {applied.length === 0 && <p className="text-text-dim">Персонажів гравців у бою не було.</p>}
          <ul className="flex flex-col gap-2">
            {applied.map((r) => (
              <li key={r.character_id}>
                <b className="text-text">{r.name}</b>: +{r.hours_added} год (разом {r.timer.hours})
                {r.fatigue_after > r.fatigue_before && <span className="text-danger"> · Втома {r.fatigue_before} → {r.fatigue_after}</span>}
                {r.checks.length > 0 && (
                  <ul className="pl-3 text-xs text-text-dim">
                    {r.checks.map((c, i) => <li key={i}>{formatCheck(c)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button className="mt-4 w-full" onClick={onClose}>Зрозуміло</Button>
    </Sheet>
  );
}

// Бейджі ефектів станів біля персонажа-комбатанта (лише бойові).
const COMBAT_CHIP_KEYS = new Set(['dead', 'unconscious', 'initiative', 'actions', 'reactions', 'heroic']);

function CombatEffectBadges({ effects }) {
  const chips = effectChips(effects).filter((chip) => COMBAT_CHIP_KEYS.has(chip.key));
  if (!chips.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {chips.map((chip) => <span key={chip.key} className={chipClass(chip.tone)}>{chip.text}</span>)}
    </div>
  );
}

function NoSceneYetGm({ campaignId, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await campaignApi.createCombatScene(campaignId, {});
      await onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при створенні сцени');
      setCreating(false);
    }
  };

  return (
    <EmptyState
      icon="⚔"
      title="Бойової сцени ще немає"
      action={<Button onClick={handleCreate} disabled={creating}>{creating ? 'Створення...' : 'Почати бій'}</Button>}
    >
      {error || 'Створіть сцену, щоб додавати комбатантів і вести облік раундів.'}
    </EmptyState>
  );
}

// ================================================================
// Таблиця комбатантів: завжди відсортована за спаданням ініціативи
// (бекенд віддає вже в такому порядку), розбита на "ще не діяли" /
// роздільник / "вже походили цього раунду".
// ================================================================

function CombatantsTable({ notActed, acted, isGm, campaignId, onChanged, myCharacterIds, effectsById = {}, combatants = [] }) {
  if (notActed.length === 0 && acted.length === 0) {
    return (
      <EmptyState title="У бою ще немає комбатантів">
        {isGm ? 'Додайте гравців або NPC вище.' : 'Майстер ще не додав комбатантів.'}
      </EmptyState>
    );
  }

  const colCount = isGm ? 9 : 7;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-hover text-left text-xs uppercase tracking-wide text-text-dim">
            {COLUMN_HEADERS.filter((col) => isGm || !col.gmOnly).map(({ key, label }) => (
              <th key={key} className="px-3 py-2 font-semibold">{label}</th>
            ))}
            {isGm && <th className="px-3 py-2 font-semibold">Дії</th>}
          </tr>
        </thead>
        <tbody>
          {notActed.map((c) => (
            <CombatantRow
              key={c.id} combatant={c} isGm={isGm} campaignId={campaignId} onChanged={onChanged}
              isMine={!!c.character_id && myCharacterIds.has(c.character_id)}
              sheet={c.character_id ? effectsById[c.character_id] : null}
              targets={combatants}
            />
          ))}
          {acted.length > 0 && (
            <tr>
              <td colSpan={colCount} className="border-y border-dashed border-border bg-surface-hover/50 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-text-dim">
                --- Наступний раунд ---
              </td>
            </tr>
          )}
          {acted.map((c) => (
            <CombatantRow
              key={c.id} combatant={c} isGm={isGm} campaignId={campaignId} onChanged={onChanged} dimmed
              isMine={!!c.character_id && myCharacterIds.has(c.character_id)}
              sheet={c.character_id ? effectsById[c.character_id] : null}
              targets={combatants}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Натуральна грань d20 у відповіді dice-roller: у простій групі це
// rolls[0], у обгорнутій (перевага/перешкода) — залишене значення.
function naturalD20(roll) {
  const d20 = roll?.groups?.find((g) => g.sides === 20);
  if (!d20) return null;
  return d20.type === 'dice' ? d20.rolls?.[0] ?? null : d20.dice?.[0]?.kept ?? null;
}

// Повторення дій (4.10): друга однакова дія за хід — з перешкодою, третя —
// з подвійною. Тут ідеться саме про атаку, тож діє лише виняток бійця
// (чаклунів виняток стосується чарування, а пройдисвіту винятків немає).
// Архетип приходить у блоці персонажа з GET /api/characters/effects;
// у НІПа його немає — вони повторень не уникають.
function repeatAttackDisadvantage(previousAttacks, archetype) {
  if (archetype === 'fighter') return null;
  if (previousAttacks >= 2) return 'wdis';
  if (previousAttacks === 1) return 'dis';
  return null;
}

// ================================================================
// Атака просто з таблиці: обрати зброю й ціль, решту система робить сама.
//
// Кубики кидаються тут, через dice-roller, щоб гравець бачив розбивку і
// кидок потрапив у його історію. Порівняння з захистом, зношування й
// поглинання рахує бекенд (campaigns/src/utils/attack.js), наслідки для
// листа персонажа — character-sheet. Сюди повертається повний розбір, який
// і показується гравцеві.
// ================================================================

function AttackSheet({ attacker, targets, campaignId, sheet, effects, onClose, onDone }) {
  const { roll: rollDice, rolling } = useDice();
  const [weapons, setWeapons] = useState([]);
  const [weaponId, setWeaponId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [skillKey, setSkillKey] = useState('');
  const [chosen, setChosen] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    combatantWeapons(attacker, sheet)
      .then((list) => { if (!alive) return; setWeapons(list); setWeaponId(list[0]?.equipment_id ?? ''); })
      .catch(() => {});
    return () => { alive = false; };
  }, [attacker, sheet]);

  const weapon = weapons.find((w) => w.equipment_id === weaponId) ?? null;
  // «Універсальна» зброя (і та, якій модифікатор не проставили) лишає вибір
  // навички гравцеві — як і вузол, що дозволяє бити вищою з двох навичок.
  const needsSkillChoice = !weapon || !weapon.modifier || weapon.modifier === 'universal';
  const usedSkill = needsSkillChoice ? skillKey : weapon.modifier;

  const attackProfile = sheet?.roll_profiles?.attack ?? null;
  const situational = attackProfile?.situational ?? [];

  const canAttack = !!targetId && (!needsSkillChoice || !!skillKey) && !busy && !rolling;

  const handleAttack = async () => {
    setError('');
    setBusy(true);
    try {
      const target = targets.find((t) => t.id === targetId);

      // Режим влучання: профіль дерева й станів + перешкода за неосвоєну
      // зброю (4.2) + перешкода за повторення тієї самої дії (4.10).
      const factors = [];
      const notes = [];
      if (attackProfile?.mode && attackProfile.mode !== 'normal') factors.push(attackProfile.mode);
      if (weapon && weapon.mastered === false) { factors.push('dis'); notes.push('неосвоєна зброя'); }
      const repeats = (attacker.actions_log ?? []).filter((a) => a === 'attack').length;
      const repeatPenalty = repeatAttackDisadvantage(repeats, sheet?.archetype);
      if (repeatPenalty) { factors.push(repeatPenalty); notes.push('повторення дії'); }
      for (const mod of chosen) factors.push(mod.mode);

      const skillProfile = usedSkill ? await combatantProfile(attacker, sheet, usedSkill) : null;
      if (skillProfile?.mode && skillProfile.mode !== 'normal') factors.push(skillProfile.mode);

      const mode = mergeRollModes(factors);
      const bonus = (attackProfile?.bonus ?? 0) + (skillProfile?.bonus ?? 0)
        + chosen.filter((m) => m.mode === 'bonus').reduce((sum, m) => sum + m.value, 0);

      const hitFormula = buildRollFormula({ die: skillProfile?.die ?? null, mode, bonus, withD20: true });
      const hitRoll = await rollDice(hitFormula);
      const natural = naturalD20(hitRoll);

      // Ціль тримала реакцію — кидаємо за неї ухилення (лише кубик, 4.5.1).
      let dodge = null;
      if (target?.reaction_reserved) {
        const dodgeProfile = await combatantProfile(target, null, 'evasion');
        const dodgeFormula = buildRollFormula({ ...dodgeProfile, withD20: false });
        if (dodgeFormula) {
          const dodgeRoll = await rollDice(dodgeFormula);
          dodge = { total: dodgeRoll.total, formula: dodgeFormula };
        }
      }

      // Шкода: M кубиків зброї, де M — Майстерність із дерева (4.4.3).
      const count = sheet?.roll_profiles?.damage_dice?.count ?? 1;
      const die = weapon?.damage_die ?? attacker.damage_die ?? 'd4';
      const damageFormula = `${count}${die}`;
      const damageRoll = await rollDice(damageFormula);

      const payload = await campaignApi.combatAttack(campaignId, {
        attacker_id: attacker.id,
        target_id: targetId,
        hit: { total: hitRoll.total, natural, formula: hitFormula },
        dodge,
        damage: { total: damageRoll.total, formula: damageFormula },
        weapon: {
          name: weapon?.name ?? 'Імпровізована зброя',
          damage_die: die,
          skill_key: usedSkill ?? null,
          notes,
        },
      });
      setResult({ ...payload, hitFormula, damageFormula, mode, notes });
      onDone();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося здійснити атаку');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={`Атака: ${attacker.name}`}>
      <div className="flex flex-col gap-3">
        <Field label="Зброя">
          <select className={inputClass} value={weaponId} onChange={(e) => setWeaponId(e.target.value)}>
            {weapons.length === 0 && <option value="">Без зброї (d4)</option>}
            {weapons.map((w) => (
              <option key={w.equipment_id} value={w.equipment_id}>
                {w.name} ({w.damage_die ?? 'd4'}){w.mastered === false ? ' — не освоєна' : ''}
              </option>
            ))}
          </select>
        </Field>

        {needsSkillChoice && (
          <Field label="Навичка влучання">
            <select className={inputClass} value={skillKey} onChange={(e) => setSkillKey(e.target.value)}>
              <option value="">— оберіть навичку —</option>
              {SKILL_TARGETS.map((t) => (
                <option key={t.key} value={t.key}>{t.group} · {t.label}</option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Ціль">
          <select className={inputClass} value={targetId} onChange={(e) => setTargetId(e.target.value)}>
            <option value="">— оберіть ціль —</option>
            {targets.filter((t) => t.id !== attacker.id).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.reaction_reserved ? ' (тримає реакцію)' : ''}
              </option>
            ))}
          </select>
        </Field>

        {situational.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Ситуативне</span>
            {situational.map((mod) => (
              <label key={mod.id} className="flex cursor-pointer items-start gap-2 text-sm text-text">
                <input
                  type="checkbox" className="mt-0.5"
                  checked={chosen.some((m) => m.id === mod.id)}
                  onChange={() => setChosen((prev) => (
                    prev.some((m) => m.id === mod.id) ? prev.filter((m) => m.id !== mod.id) : [...prev, mod]
                  ))}
                />
                <span>
                  <span className="font-semibold">{mod.source}</span>
                  {mod.note && <span className="text-text-dim"> — {mod.note}</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}

        {result ? <AttackResult result={result} onClose={onClose} /> : (
          <Button onClick={handleAttack} disabled={!canAttack}>
            {busy || rolling ? 'Кидаємо…' : 'Атакувати'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

// Повний розбір атаки для того, хто її здійснив: що випало, з чим
// порівнювалось і що з цього вийшло.
function AttackResult({ result, onClose }) {
  const o = result.outcome;
  const sheet = result.sheet;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3 text-sm">
      <p className={o.hit ? 'font-semibold text-sage' : 'font-semibold text-danger'}>
        {o.natural20 && 'Натуральна 20 — '}
        {o.natural1 && 'Натуральна 1 — '}
        {o.hit ? 'Влучання' : o.outcome === 'tie' ? 'Промах урівень із захистом' : 'Промах'}
      </p>
      <p className="text-text-muted">
        Влучання {o.total} ({result.hitFormula}) проти захисту {o.total_defense}
        {result.dodge && ` (ухилення ${result.dodge.rolled})`}
      </p>
      {o.wear > 0 && (
        <p className="text-text-muted">Зношування −{o.wear}: пасивний захист {o.passive_before} → {o.passive_after}</p>
      )}
      {o.hit && (
        <p className="text-text-muted">
          Шкода {o.damage} ({result.damageFormula}) − поглинуто {o.absorbed} = <strong className="text-text">{o.hp_damage}</strong> ХП
        </p>
      )}
      {sheet?.massive && <p className="font-semibold text-danger">Масивна шкода: ціль падає з одним провалом</p>}
      {sheet?.fell && !sheet?.massive && <p className="font-semibold text-danger">Ціль непритомна</p>}
      {sheet?.trauma_suggested && (
        <p className="font-semibold text-gold">
          Удар від половини максимуму здоровʼя — майстер може додати рівень Травми
        </p>
      )}
      {result.notes?.length > 0 && <p className="text-xs text-text-dim">Перешкода: {result.notes.join(', ')}</p>}
      <Button variant="ghost" onClick={onClose}>Закрити</Button>
    </div>
  );
}

// ================================================================
// Трекер дій: три кружечки (менше — якщо Втома забрала дії, 5.2.1) плюс
// позначка залишеної на реакцію дії. Клік по кружечку ставить саме стільки
// витрачених дій; клік по вже останньому витраченому — знімає його.
// Залишена реакція — це ще й «буде ухилятися»: перша вхідна атака кине
// кубик Ухилення сама (4.5.1).
// ================================================================

function ActionTracker({ used, total, reserved, reactionsDisabled, canEdit, onSet, onToggleReaction }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: total }).map((_, i) => {
          const spent = i < used;
          return (
            <button
              key={i}
              type="button"
              disabled={!canEdit}
              aria-label={`${i + 1} дія з ${total}`}
              title={spent ? 'Витрачена дія' : 'Вільна дія'}
              onClick={() => onSet(spent && i === used - 1 ? i : i + 1)}
              className={`h-3.5 w-3.5 rounded-full border-[1.5px] transition-colors ${
                spent ? 'border-danger bg-danger' : 'border-text-dim bg-transparent'
              } ${canEdit ? 'cursor-pointer hover:border-accent' : 'cursor-default'}`}
            />
          );
        })}
      </div>
      <button
        type="button"
        disabled={!canEdit || reactionsDisabled}
        onClick={onToggleReaction}
        title={reactionsDisabled
          ? 'Втома 3: реакція недоступна'
          : 'Лишити дію на реакцію — тоді ухилення кинеться автоматично при атаці'}
        className={`rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold transition-colors ${
          reserved ? 'border-sage bg-sage/15 text-sage' : 'border-border text-text-dim'
        } ${canEdit && !reactionsDisabled ? 'hover:bg-surface-hover' : 'cursor-default opacity-60'}`}
      >
        ↩
      </button>
    </div>
  );
}

// Комірка «Дії»: трекер трьох дій і кнопки, що з них випливають — атака
// (витрачає дію) і рятівний кидок від смерті для непритомного персонажа.
function ActionsCell({ row }) {
  return (
    <div className="flex items-center gap-1.5">
      <ActionTracker
        used={row.used} total={row.total}
        reserved={row.reserved}
        reactionsDisabled={row.reactionsDisabled}
        canEdit={row.canEdit}
        onSet={row.onSet}
        onToggleReaction={row.onToggleReaction}
      />
      {row.canRoll && !row.isUnconscious && (
        <button
          type="button" onClick={row.onAttack}
          title="Атакувати: обрати зброю й ціль, решту система зробить сама"
          className="inline-flex items-center justify-center text-accent hover:text-text"
        >
          <Swords size={14} />
        </button>
      )}
      {row.canRoll && row.isCharacter && row.isUnconscious && (
        <button
          type="button" onClick={row.onDeathSave} disabled={row.rolling}
          title="Рятівний кидок від смерті (d12, 7+ — успіх)"
          className="inline-flex items-center justify-center text-danger disabled:opacity-50"
        >
          <Skull size={14} />
        </button>
      )}
      {row.attackSheet}
    </div>
  );
}


function CombatantRow({ combatant, isGm, isMine, campaignId, onChanged, dimmed, sheet, targets = [] }) {
  const rowRef = useRef(null);
  const effects = sheet?.effects ?? null;
  const [local, setLocal] = useState(combatant);
  const [attackOpen, setAttackOpen] = useState(false);
  // null — не в режимі редагування: поле показує реальне поточне ХП з `local`.
  // Рядок (навіть порожній) — чернетка вводу: користувач саме зараз друкує.
  const [hpDraft, setHpDraft] = useState(null);
  const { roll: rollDice, rolling: diceRolling } = useDice();

  // Опитування оновлює `combatant` кожні ~3.5с; якщо хтось саме зараз
  // редагує поле в цьому рядку — не затираємо введене свіжими даними з сервера.
  useEffect(() => {
    if (rowRef.current && rowRef.current.contains(document.activeElement)) return;
    setLocal(combatant);
  }, [combatant]);

  const isPlayerLinked = !!combatant.character_id;
  const isNpc = !isPlayerLinked;
  const canEditFully = isGm; // усі поля, крім ХП/кидків — лише майстер
  const canEditHp = isGm || isMine; // гравець редагує ХП тільки свого персонажа
  const canRoll = isGm || isMine; // кубики ініціативи/захисту — свій персонаж або GM
  // Непритомність — з обчислених ефектів листа (шкала смерті −2…+2).
  const isUnconscious = !!effects?.unconscious;
  const rowClass = `border-b border-border last:border-0 ${dimmed ? 'opacity-60' : ''}`;
  const cellClass = 'px-3 py-2 align-top';

  const commit = async (key) => {
    if (local[key] === combatant[key]) return;
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, { [key]: local[key] });
      onChanged();
    } catch {
      setLocal(combatant);
    }
  };

  // Розумне ХП: рахуємо нове (health, temp_hp) із заданого вводу відносно
  // `local` (щоб швидкі послідовні +1/-1 клацання рахувались одне від
  // одного, а не від застарілого `combatant` до наступного опитування),
  // одразу показуємо результат (оптимістично) і зберігаємо — якщо це
  // персонаж гравця, тим самим запитом синхронізуємо і його лист.
  const applyAndSyncHp = async (rawInput) => {
    const next = applyHpInput(rawInput, local);
    if (!next) return;
    setLocal((p) => ({ ...p, ...next }));
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, next);
      if (combatant.character_id) {
        await characterApi.update(combatant.character_id, { current_hp: next.health, temp_hp: next.temp_hp }).catch(() => {});
      }
      onChanged();
    } catch {
      setLocal(combatant);
    }
  };

  const commitHp = () => {
    const raw = hpDraft;
    setHpDraft(null);
    if (raw == null) return;
    applyAndSyncHp(raw);
  };

  // Кнопки +/- біля ХП: змінюють по одному, не змушуючи перенабирати текст.
  const stepHp = (delta) => applyAndSyncHp(delta > 0 ? '+1' : '-1');

  // Ухилення в бою — це реакція: кидається ЛИШЕ кубик-модифікатор навички,
  // без d20 (4.5.1), а результат стає активним захистом. Кубик бере або
  // лист персонажа (roll_profiles, уже з урахуванням станів і дерева), або
  // стат-блок НІПа. Запис у журнал — щоб ціль бачила, звідки взявся захист.
  const rollEvasion = async () => {
    try {
      const profile = await combatantProfile(combatant, sheet, 'evasion');
      if (profile.disabled) return;
      // Втома 1 робить реакції складнішими (5.2.1) — і ухилення теж.
      const mode = effects?.reactions === 'dis'
        ? mergeRollModes([profile.mode ?? 'normal', 'dis'])
        : (profile.mode ?? 'normal');
      const formula = buildRollFormula({ ...profile, mode, withD20: false }) ?? '1d20';
      const result = await rollDice(formula);
      await handleDiceResult('active_defense', result);
      await logEntry('dodge', { formula, total: result.total, active_defense: result.total });
    } catch {
      // помилка кидка або завантаження навички — нічого не зберігаємо
    }
  };

  // Ініціатива: кубик за рівнем Спритності (4.1), а не заглушка. Втома
  // зсуває її числом — воно вже всередині профілю.
  const rollInitiative = async () => {
    try {
      const profile = await combatantProfile(combatant, sheet, 'initiative');
      const formula = buildRollFormula({ ...profile, withD20: profile.die ? false : true }) ?? '1d4';
      const result = await rollDice(formula);
      await handleDiceResult('initiative', result);
      await logEntry('initiative', { formula, total: result.total });
    } catch {
      // нічого не зберігаємо — наступне опитування підтягне стан
    }
  };

  // Рятівний кидок від смерті (5.3.2): d12 кидає клієнт, зсув маркера
  // шкали смерті робить лист персонажа.
  const rollDeathSave = async () => {
    try {
      const result = await rollDice('1d12');
      const { result: saved } = await characterApi.deathSave(combatant.character_id, result.total);
      await logEntry('death_save', {
        formula: '1d12', total: result.total, success: saved.success,
        death_scale: saved.death_scale, awake: saved.awake, dead: saved.dead,
      });
      onChanged();
    } catch (err) {
      window.alert(err.response?.data?.message || 'Не вдалося кинути рятівний кидок');
    }
  };

  // Кидок, що нікого не атакує, але має лишитися видимим іншим гравцям.
  const logEntry = (kind, payload) => campaignApi
    .addCombatLogEntry(campaignId, { combatant_id: combatant.id, kind, payload })
    .catch(() => {});

  // Трекер дій: скільки з трьох дій витрачено. Втома зменшує ліміт
  // (5.2.1) — беремо його з обчислених ефектів листа.
  const actionsTotal = effects?.actions_per_turn ?? 3;
  const actionsUsed = Math.min(local.actions_used ?? 0, actionsTotal);

  const setActions = async (used) => {
    setLocal((p) => ({ ...p, actions_used: used }));
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, {
        actions_used: used,
        // Журнал повторень має сенс лише поки дії рахуються: скидання
        // лічильника вручну скидає і його.
        ...(used === 0 ? { actions_log: [] } : {}),
      });
      onChanged();
    } catch { /* наступне опитування підтягне стан */ }
  };

  // Усе, що потрібно комірці «Дії»: трекер, атака й рятівний кидок.
  const actionsCell = {
    used: actionsUsed, total: actionsTotal,
    reserved: !!local.reaction_reserved,
    reactionsDisabled: effects?.reactions === 'none',
    canEdit: canEditHp, canRoll, rolling: diceRolling,
    isCharacter: !!combatant.character_id, isUnconscious,
    onSet: setActions, onToggleReaction: () => toggleReaction(),
    onAttack: () => setAttackOpen(true), onDeathSave: rollDeathSave,
    // Панель атаки живе в цій же комірці — так вона є в обох варіантах
    // рядка (ГМ і гравця), не дублюючи розмітку.
    attackSheet: attackOpen ? (
      <AttackSheet
        attacker={local}
        targets={targets}
        campaignId={campaignId}
        sheet={sheet}
        effects={effects}
        onClose={() => setAttackOpen(false)}
        onDone={onChanged}
      />
    ) : null,
  };

  const toggleReaction = async () => {
    const next = !local.reaction_reserved;
    setLocal((p) => ({ ...p, reaction_reserved: next }));
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, { reaction_reserved: next });
      onChanged();
    } catch { /* наступне опитування підтягне стан */ }
  };

  const handleDiceResult = async (field, roll) => {
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, { [field]: roll.total });
      onChanged();
    } catch {
      // наступне опитування підтягне справжній стан
    }
  };

  const toggleHidden = async () => {
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, { is_hidden: !combatant.is_hidden });
      onChanged();
    } catch {
      // наступне опитування підтягне справжній стан
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Прибрати "${combatant.name}" з бою?`)) return;
    try {
      await campaignApi.removeCombatant(campaignId, combatant.id);
      onChanged();
    } catch {
      // залишаємо рядок — GM побачить, що видалення не пройшло, і спробує ще раз
    }
  };

  const hpDisplay = formatHp(local.health, local.temp_hp, local.max_health);
  // Втома знижує ініціативу: трекер сам кидає її — віднімаємо одразу у
  // формулі; при ручному вводі лише підказка.
  const initiativeModifier = effects?.initiative_modifier ?? 0;
  const initiativeHint = initiativeModifier ? `${initiativeModifier} до ініціативи (Втома) — враховано в кидку` : undefined;

  // Гравці ніколи не бачать колонку "Опис" — вона суто для GM. Для NPC
  // (де решта чисел і так затерті на фронті) її текст замість цього
  // показується в одній об'єднаній клітинці, щоб не малювати ряд "—".
  if (!isGm) {
    if (isNpc) {
      return (
        <tr ref={rowRef} className={rowClass}>
          <td className={cellClass}>{combatant.name}</td>
          <td className={cellClass} colSpan={6}>{combatant.description || '—'}</td>
        </tr>
      );
    }

    return (
      <tr ref={rowRef} className={rowClass}>
        <td className={cellClass}>
          <span className="text-text">{combatant.name}</span>
          <CombatEffectBadges effects={effects} />
        </td>
        <td className={cellClass}>
          {isMine ? (
            <IntInput
              className={`${compactInputClass} w-14 text-center`}
              value={local.passive_defense}
              onChange={(v) => setLocal((p) => ({ ...p, passive_defense: v }))}
              onBlur={() => commit('passive_defense')}
            />
          ) : (
            <span className="text-text">{combatant.passive_defense ?? '—'}</span>
          )}
        </td>
        <td className={cellClass}>
          <div className="flex items-center gap-1">
            {isMine ? (
              <IntInput
                className={`${compactInputClass} w-14 text-center`}
                value={local.active_defense}
                onChange={(v) => setLocal((p) => ({ ...p, active_defense: v }))}
                onBlur={() => commit('active_defense')}
              />
            ) : (
              <span className="text-text">{combatant.active_defense ?? '—'}</span>
            )}
            {canRoll && (
              <button
                type="button"
                onClick={rollEvasion}
                disabled={diceRolling}
                title="Кинути ухилення (1d20 + модифікатор навички)"
                className="inline-flex items-center justify-center gap-1 text-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Dices size={14} />
              </button>
            )}
          </div>
        </td>
        <td className={cellClass}>
          {canEditHp ? (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => stepHp(-1)} aria-label="-1 ХП" className="p-1 text-text-dim hover:text-danger">
                <Minus size={14} />
              </button>
              <input
                className={`${compactInputClass} w-14 text-center`}
                value={hpDraft ?? (local.health ?? '')}
                onFocus={() => setHpDraft('')}
                onChange={(e) => setHpDraft(e.target.value)}
                onBlur={commitHp}
                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              />
              <button type="button" onClick={() => stepHp(1)} aria-label="+1 ХП" className="p-1 text-text-dim hover:text-sage">
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <span className="text-text">{hpDisplay}</span>
          )}
        </td>
        <td className={cellClass}>
          <div className="flex items-center gap-1">
            {isMine ? (
              <IntInput
                className={`${compactInputClass} w-14 text-center`}
                value={local.initiative}
                title={initiativeHint}
                onChange={(v) => setLocal((p) => ({ ...p, initiative: v }))}
                onBlur={() => commit('initiative')}
              />
            ) : (
              <span className="text-text">{combatant.initiative ?? '—'}</span>
            )}
            {canRoll && (
              <button
                type="button" onClick={rollInitiative} disabled={diceRolling}
                title="Кинути ініціативу (кубик за рівнем Спритності)"
                className="inline-flex items-center justify-center text-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Dices size={14} />
              </button>
            )}
          </div>
        </td>
        <td className={cellClass}>
          <ActionsCell row={actionsCell} />
        </td>
        <td className={cellClass}>
          {isMine ? (
            <input
              className={`${compactInputClass} min-w-[130px] flex-1`}
              value={local.notes ?? ''}
              onChange={(e) => setLocal((p) => ({ ...p, notes: e.target.value }))}
              onBlur={() => commit('notes')}
            />
          ) : (
            <span className="text-text">{combatant.notes || '—'}</span>
          )}
        </td>
      </tr>
    );
  }

  return (
    <tr ref={rowRef} className={rowClass}>
      <td className={cellClass}>
        {canEditFully && isNpc ? (
          <input
            className={`${compactInputClass} min-w-[110px]`}
            value={local.name}
            onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
            onBlur={() => commit('name')}
          />
        ) : (
          <span className="text-text">{combatant.name}</span>
        )}
        <CombatEffectBadges effects={effects} />
      </td>
      <td className={cellClass}>
        {canEditFully && isNpc ? (
          <IntInput
            className={`${compactInputClass} w-14 text-center`}
            value={local.passive_defense}
            onChange={(v) => setLocal((p) => ({ ...p, passive_defense: v }))}
            onBlur={() => commit('passive_defense')}
          />
        ) : (
          <span className="text-text">{combatant.passive_defense ?? '—'}</span>
        )}
      </td>
      <td className={cellClass}>
        <div className="flex items-center gap-1">
          {canEditFully ? (
            <IntInput
              className={`${compactInputClass} w-14 text-center`}
              value={local.active_defense}
              onChange={(v) => setLocal((p) => ({ ...p, active_defense: v }))}
              onBlur={() => commit('active_defense')}
            />
          ) : (
            <span className="text-text">{combatant.active_defense ?? '—'}</span>
          )}
          {canRoll && (
            <button
              type="button"
              onClick={rollEvasion}
              disabled={diceRolling}
              title="Кинути ухилення (1d20 + модифікатор навички)"
              className="inline-flex items-center justify-center gap-1 text-accent cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Dices size={14} />
            </button>
          )}
        </div>
      </td>
      <td className={cellClass}>
        {canEditHp ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => stepHp(-1)} aria-label="-1 ХП" className="p-1 text-text-dim hover:text-danger">
              <Minus size={14} />
            </button>
            <input
              className={`${compactInputClass} w-14 text-center`}
              value={hpDraft ?? (local.health ?? '')}
              onFocus={() => setHpDraft('')}
              onChange={(e) => setHpDraft(e.target.value)}
              onBlur={commitHp}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
            />
            <button type="button" onClick={() => stepHp(1)} aria-label="+1 ХП" className="p-1 text-text-dim hover:text-sage">
              <Plus size={14} />
            </button>
            <span className="text-text-dim">/</span>
            <IntInput
              className={`${compactInputClass} w-12 text-center`}
              value={local.max_health}
              onChange={(v) => setLocal((p) => ({ ...p, max_health: v }))}
              onBlur={() => commit('max_health')}
            />
          </div>
        ) : (
          <span className="text-text">{hpDisplay}</span>
        )}
      </td>
      <td className={cellClass}>
        <div className="flex items-center gap-1">
          {canEditFully ? (
            <IntInput
              className={`${compactInputClass} w-14 text-center`}
              value={local.initiative}
              title={initiativeHint}
              onChange={(v) => setLocal((p) => ({ ...p, initiative: v }))}
              onBlur={() => commit('initiative')}
            />
          ) : (
            <span className="text-text">{combatant.initiative ?? '—'}</span>
          )}
          {canRoll && (
            <button
              type="button" onClick={rollInitiative} disabled={diceRolling}
              title="Кинути ініціативу (кубик за рівнем Спритності)"
              className="inline-flex items-center justify-center text-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Dices size={14} />
            </button>
          )}
        </div>
      </td>
      <td className={cellClass}>
        <ActionsCell row={actionsCell} />
      </td>
      <td className={cellClass}>
        {canEditFully ? (
          <input
            className={`${compactInputClass} min-w-[130px] flex-1`}
            value={local.notes ?? ''}
            onChange={(e) => setLocal((p) => ({ ...p, notes: e.target.value }))}
            onBlur={() => commit('notes')}
          />
        ) : (
          <span className="text-text">{combatant.notes || '—'}</span>
        )}
      </td>
      <td className={cellClass}>
        {canEditFully ? (
          <input
            className={`${compactInputClass} min-w-[130px] flex-1`}
            value={local.description ?? ''}
            onChange={(e) => setLocal((p) => ({ ...p, description: e.target.value }))}
            onBlur={() => commit('description')}
          />
        ) : (
          <span className="text-text">{combatant.description || '—'}</span>
        )}
      </td>
      {isGm && (
        <td className={`${cellClass} whitespace-nowrap`}>
          <div className="flex items-center gap-1">
            {isNpc && (
              <button
                type="button"
                onClick={toggleHidden}
                aria-label={combatant.is_hidden ? 'Показати гравцям' : 'Приховати від гравців'}
                className="p-1 text-text-dim hover:text-accent"
              >
                {combatant.is_hidden ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            )}
            <button type="button" onClick={handleRemove} aria-label="Прибрати з бою" className="p-1 text-text-dim hover:text-danger">
              <Trash2 size={15} />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ================================================================
// Додавання комбатантів: гравець із кампанії (ім'я/пасивний захист/
// здоров'я підтягуються з листа персонажа й лишаються readonly у таблиці)
// або кастомний NPC (усі поля вручну).
// ================================================================

function AddCombatantBar({ campaignId, sceneId, characters, combatants, onAdded }) {
  const [mode, setMode] = useState(null); // null | 'player' | 'npc'

  const attachedCharacterIds = new Set(combatants.map((c) => c.character_id).filter(Boolean));
  const availableCharacters = characters.filter((c) => !attachedCharacterIds.has(c.character_id));

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" onClick={() => setMode('player')}>
        <Plus size={14} /> Додати гравця
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setMode('npc')}>
        <Plus size={14} /> Додати NPC
      </Button>

      <AddPlayerSheet
        open={mode === 'player'}
        campaignId={campaignId}
        sceneId={sceneId}
        characters={availableCharacters}
        onClose={() => setMode(null)}
        onAdded={() => { setMode(null); onAdded(); }}
      />
      <AddNpcSheet
        open={mode === 'npc'}
        campaignId={campaignId}
        sceneId={sceneId}
        onClose={() => setMode(null)}
        onAdded={() => { setMode(null); onAdded(); }}
      />
    </div>
  );
}

function AddPlayerSheet({ open, campaignId, sceneId, characters, onClose, onAdded }) {
  const [characterId, setCharacterId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setCharacterId(''); setError(''); }
  }, [open]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!characterId) return;
    setSaving(true);
    setError('');
    try {
      const { character, equipment, skills } = await characterApi.getSheet(characterId);

      await campaignApi.addCombatant(campaignId, sceneId, {
        character_id: characterId,
        name: character.name,
        passive_defense: computePassiveDefense(equipment, character.defense_bonus),
        health: character.current_hp,
        max_health: computeMaxHp(character, skills),
        temp_hp: character.temp_hp ?? 0,
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати персонажа в бій');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Додати гравця з кампанії">
      <div className="flex flex-col gap-4">
        {characters.length === 0 ? (
          <p className="text-sm text-text-dim">Усі персонажі кампанії вже в бою.</p>
        ) : (
          <Field label="Персонаж">
            <select className={inputClass} value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
              <option value="">Оберіть персонажа…</option>
              {characters.map((c) => (
                <option key={c.character_id} value={c.character_id}>
                  {c.character_name} ({c.owner_username})
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={handleAdd} disabled={!characterId || saving}>
          {saving ? 'Додавання...' : 'Додати в бій'}
        </Button>
      </div>
    </Sheet>
  );
}

function AddNpcSheet({ open, campaignId, sceneId, onClose, onAdded }) {
  const [subMode, setSubMode] = useState('compendium'); // 'manual' | 'compendium'
  const [form, setForm] = useState(EMPTY_NPC_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setSubMode('compendium'); setForm(EMPTY_NPC_FORM); setError(''); }
  }, [open]);

  if (!open) return null;

  const setText = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setInt = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const handleAdd = async () => {
    if (!form.name.trim()) { setError('Вкажіть імʼя'); return; }
    setSaving(true);
    setError('');
    try {
      await campaignApi.addCombatant(campaignId, sceneId, { ...form, name: form.name.trim() });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати NPC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новий NPC">
      <div className="flex flex-col gap-4">
        <div className="inline-flex self-start overflow-hidden rounded-lg border border-border">
          <button
            type="button" onClick={() => setSubMode('manual')}
            className={`min-h-9 px-4 text-sm font-semibold ${subMode === 'manual' ? 'bg-accent text-bg' : 'bg-surface text-text-dim'}`}
          >
            Вручну
          </button>
          <button
            type="button" onClick={() => setSubMode('compendium')}
            className={`min-h-9 border-l border-border px-4 text-sm font-semibold ${subMode === 'compendium' ? 'bg-accent text-bg' : 'bg-surface text-text-dim'}`}
          >
            З НІПів та істот
          </button>
        </div>

        {subMode === 'compendium' ? (
          <CompendiumNpcFields campaignId={campaignId} sceneId={sceneId} onAdded={onAdded} />
        ) : (
          <>
            <Field label="Імʼя">
              <input className={inputClass} value={form.name} onChange={setText('name')} maxLength={200} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Пасивний захист">
                <IntInput className={inputClass} value={form.passive_defense} onChange={setInt('passive_defense')} />
              </Field>
              <Field label="Ухилення">
                <IntInput className={inputClass} value={form.active_defense} onChange={setInt('active_defense')} />
              </Field>
              <Field label="Здоров'я">
                <IntInput className={inputClass} value={form.health} onChange={setInt('health')} />
              </Field>
              <Field label="Максимальне здоров'я">
                <IntInput className={inputClass} value={form.max_health} onChange={setInt('max_health')} />
              </Field>
              <Field label="Тимчасові ХП">
                <IntInput className={inputClass} value={form.temp_hp} onChange={setInt('temp_hp')} />
              </Field>
              <Field label="Ініціатива">
                <IntInput className={inputClass} value={form.initiative} onChange={setInt('initiative')} />
              </Field>
            </div>
            <Field label="Примітки">
              <input className={inputClass} value={form.notes} onChange={setText('notes')} />
            </Field>
            <Field label="Опис">
              <textarea className={`${inputClass} resize-y`} rows={3} value={form.description} onChange={setText('description')} />
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button onClick={handleAdd} disabled={saving}>{saving ? 'Додавання...' : 'Додати в бій'}</Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

// Autocomplete over NPCs + Bestiary together (two services, one list) + a quantity —
// stats aren't entered here: the backend computes each clone's starting
// health/active_defense/initiative from the entry's attributes.
function CompendiumNpcFields({ campaignId, sceneId, onAdded }) {
  const [entries, setEntries] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // compendium_entry_id accepts either kind — NPC and creature ids never
    // collide (they shared one table before the split).
    Promise.all([npcsApi.list().catch(() => []), bestiaryApi.list().catch(() => [])])
      .then(([npcs, creatures]) => setEntries([
        ...npcs.map((n) => ({ ...n, entity_type: 'npc' })),
        ...creatures.map((c) => ({ ...c, entity_type: 'creature' })),
      ].sort((a, b) => a.name.localeCompare(b.name))));
  }, []);

  const filtered = search.trim() && !selected
    ? entries.filter((e) => e.name?.toLowerCase().includes(search.toLowerCase())).slice(0, 20)
    : [];

  const handleSelect = (entry) => {
    setSelected(entry);
    setSearch(entry.name);
  };

  const handleAdd = async () => {
    if (!selected) { setError('Оберіть НІПа чи істоту'); return; }
    setSaving(true);
    setError('');
    try {
      await campaignApi.addCombatantsFromCompendium(campaignId, sceneId, {
        compendium_entry_id: selected.id, quantity,
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Field label="Пошук НІПів та істот">
        <input
          className={inputClass}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
          placeholder="Імʼя НІПа чи істоти..."
        />
        {filtered.length > 0 && (
          <div className="mt-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-border bg-surface">
            {filtered.map((entry) => (
              <button
                key={entry.id} type="button"
                onClick={() => handleSelect(entry)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-hover"
              >
                <span className="text-text">{entry.name}</span>
                <span className="text-xs text-text-dim">{entry.entity_type === 'npc' ? 'НІП' : 'Істота'}</span>
              </button>
            ))}
          </div>
        )}
      </Field>

      {selected && (
        <Field label="Кількість" hint="Кожен клон отримає власне здоровʼя/захист/ініціативу, розраховані з атрибутів.">
          <IntInput className={inputClass} value={quantity} min={1} onChange={setQuantity} />
        </Field>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}
      <Button onClick={handleAdd} disabled={!selected || saving}>
        {saving ? 'Додавання...' : quantity > 1 ? `Додати ${quantity} у бій` : 'Додати в бій'}
      </Button>
    </>
  );
}

// ================================================================
// Фон бойової сцени: завантаження через media-service, показ під таблицею.
// ================================================================

function SceneImage({ campaignId, scene, isGm, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  if (!isGm && !scene.image_url) return null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий — максимум 10 МБ'); return; }

    setError('');
    setUploading(true);
    try {
      const url = await mediaApi.upload(file, { entityType: 'combat-scene', entityId: scene.id });
      await campaignApi.updateCombatScene(campaignId, scene.id, { image_url: url });
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 font-display text-base text-text">Карта сцени</h3>
        {isGm && (
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} /> {uploading ? 'Завантаження...' : 'Завантажити'}
          </Button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {scene.image_url ? (
        <img src={scene.image_url} alt="" className="max-h-[420px] w-full rounded-lg border border-border object-contain" />
      ) : (
        <p className="text-sm text-text-dim">Зображення сцени ще не завантажено.</p>
      )}

      {isGm && (
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFile} />
      )}
    </Card>
  );
}
