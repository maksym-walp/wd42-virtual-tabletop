import { useEffect, useState, useRef, useCallback } from 'react';
import { Eye, EyeOff, Trash2, Plus, Minus, Upload, User, Heart, Tag, FileText, Footprints, Dices } from 'lucide-react';
import campaignApi from '../api/campaigns';
import characterApi from '../api/characterSheet';
import compendiumApi from '../api/compendium';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import { computeMaxHp, computePassiveDefense } from '../utils/characterCombatStats';
import { modifierDie } from '../constants/characterSheet';
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

const POLL_INTERVAL_MS = 3500;

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
  { key: 'notes', label: 'Примітки', Icon: Tag },
  { key: 'description', label: 'Опис', Icon: FileText, gmOnly: true },
];

export default function CombatTab({ campaignId, isGm, characters }) {
  const [scene, setScene] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => (
    campaignApi.getCombat(campaignId)
      .then((data) => { setScene(data.scene); setCombatants(data.combatants); })
      .catch(() => setError('Не вдалось завантажити бойову сцену'))
  ), [campaignId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // Без WS/SSE-інфраструктури хід і раунд майстра доходять до гравців
  // періодичним опитуванням, поки вкладка відкрита й активна.
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

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 font-display text-lg text-text">Раунд {scene.round_number}</p>
          {isGm && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleNextTurn} disabled={busy || notActed.length === 0}>
                Наступний хід &gt;
              </Button>
              <Button size="sm" onClick={handleNextRound} disabled={busy}>
                Наступний раунд &gt;&gt;
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
      />

      <SceneImage campaignId={campaignId} scene={scene} isGm={isGm} onChanged={load} />
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

function CombatantsTable({ notActed, acted, isGm, campaignId, onChanged, myCharacterIds }) {
  if (notActed.length === 0 && acted.length === 0) {
    return (
      <EmptyState title="У бою ще немає комбатантів">
        {isGm ? 'Додайте гравців або NPC вище.' : 'Майстер ще не додав комбатантів.'}
      </EmptyState>
    );
  }

  const colCount = isGm ? 8 : 6;

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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CombatantRow({ combatant, isGm, isMine, campaignId, onChanged, dimmed }) {
  const rowRef = useRef(null);
  const [local, setLocal] = useState(combatant);
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

  // Ухилення кидається повною формулою навички: 1d20 + кубик-модифікатор
  // (якщо значення навички це дає), а не заглушкою. NPC не мають навичок у
  // цій системі — для них лишається голий 1d20.
  const rollEvasion = async () => {
    try {
      let formula = '1d20';
      if (combatant.character_id) {
        const { skills } = await characterApi.getSheet(combatant.character_id);
        const evasion = skills.find((s) => s.skill_key === 'evasion');
        const die = modifierDie(evasion?.value ?? 1);
        formula = die === '—' ? '1d20' : `1d20+1${die}`;
      }
      const result = await rollDice(formula);
      await handleDiceResult('active_defense', result);
    } catch {
      // помилка кидка або завантаження навички — нічого не зберігаємо
    }
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

  // Гравці ніколи не бачать колонку "Опис" — вона суто для GM. Для NPC
  // (де решта чисел і так затерті на фронті) її текст замість цього
  // показується в одній об'єднаній клітинці, щоб не малювати ряд "—".
  if (!isGm) {
    if (isNpc) {
      return (
        <tr ref={rowRef} className={rowClass}>
          <td className={cellClass}>{combatant.name}</td>
          <td className={cellClass} colSpan={5}>{combatant.description || '—'}</td>
        </tr>
      );
    }

    return (
      <tr ref={rowRef} className={rowClass}>
        <td className={cellClass}><span className="text-text">{combatant.name}</span></td>
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
                onChange={(v) => setLocal((p) => ({ ...p, initiative: v }))}
                onBlur={() => commit('initiative')}
              />
            ) : (
              <span className="text-text">{combatant.initiative ?? '—'}</span>
            )}
            {canRoll && (
              <RollButton
                formula="1d6"
                showWidget={false}
                title="Кинути кубик спритності (заглушка: 1d6 — навички ще не підключені)"
                onResult={(roll) => handleDiceResult('initiative', roll)}
              />
            )}
          </div>
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
              onChange={(v) => setLocal((p) => ({ ...p, initiative: v }))}
              onBlur={() => commit('initiative')}
            />
          ) : (
            <span className="text-text">{combatant.initiative ?? '—'}</span>
          )}
          {canRoll && (
            <RollButton
              formula="1d6"
              showWidget={false}
              title="Кинути кубик спритності (заглушка: 1d6 — навички ще не підключені)"
              onResult={(roll) => handleDiceResult('initiative', roll)}
            />
          )}
        </div>
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

// Autocomplete over the compendium (NPCs + Bestiary together) + a quantity —
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
    compendiumApi.listEntries().then(setEntries).catch(() => {});
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
