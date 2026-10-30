import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreePine, ChevronDown } from 'lucide-react';
import characterApi from '../api/characterSheet';
import equipmentApi from '../api/equipment';
import traditionsApi from '../api/traditions';
import abilitiesApi from '../api/abilities';
import { createCollectionsApi } from '../api/collections';
import DevelopmentTree from '../components/DevelopmentTree';
import { CATALOG_TYPES } from '../constants/artifacts';
import {
  ARCHETYPES, CHARACTERISTICS, ARCHETYPE_COLORS as ARCHETYPE_COLORS_LIGHT, ARCHETYPE_COLORS_DARK,
  PHYSIQUE_HEALTH, skillsToCharLevel, rollHealthDice, CURRENCIES,
} from '../constants/characterSheet';
import { useTheme } from '../context/ThemeContext';
import Card from '../components/ui/Card';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import IntInput from '../components/ui/IntInput';
import RollButton from '../components/RollButton';
import useCharacterConfig from '../hooks/useCharacterConfig';
import { htmlToPreviewText } from '../utils/richText';

const BASE_BUDGET = 42;
const ALL_SKILL_KEYS = CHARACTERISTICS.flatMap((c) => c.skills.map((s) => s.key));
const INITIAL_MONEY = Object.fromEntries(
  CURRENCIES.flatMap((c) => [[c.high.key, 0], [c.low.key, 0]])
);

// Раса (з конфігу адміна) може давати бонус або штраф (bonus_value зі знаком, типово +1)
// до 4 навичок однієї характеристики (bonus_characteristic) і/або додаткові очки
// пулу (bonus_budget).
function raceSkillBonusFor(race) {
  const char = CHARACTERISTICS.find((c) => c.key === race?.bonus_characteristic);
  const value = race?.bonus_value ?? 1;
  return Object.fromEntries((char?.skills ?? []).map((s) => [s.key, value]));
}
const signed = (n) => (n < 0 ? `−${-n}` : `+${n}`);
// Підвид додає свій бонус до навичок зверху на расовий — теж безкоштовно.
function peopleBonusFor(people) {
  const bonus = {};
  for (const { skill, value } of people?.skill_bonuses ?? []) bonus[skill] = (bonus[skill] || 0) + value;
  return bonus;
}
// Стартове (і мінімальне) значення кожної навички: 1 + расовий бонус + бонус підвиду,
// але не нижче 1 і не вище 12 (штраф не опускає навичку під одиницю).
function skillFloorsFor(race, people) {
  const raceBonus = raceSkillBonusFor(race);
  const bonus = peopleBonusFor(people);
  return Object.fromEntries(ALL_SKILL_KEYS.map((k) => [k, Math.max(1, Math.min(12, 1 + (raceBonus[k] || 0) + (bonus[k] || 0)))]));
}
function budgetFor(race) {
  return BASE_BUDGET + (race?.bonus_budget ?? 0);
}

// Що раса дає механічно — підпис на її картці.
function raceBonusLabel(race) {
  const parts = [];
  const char = CHARACTERISTICS.find((c) => c.key === race.bonus_characteristic);
  if (char) parts.push(`${signed(race.bonus_value ?? 1)} до навичок: ${char.label}`);
  if (race.bonus_budget) parts.push(`+${race.bonus_budget} очок до пулу`);
  return parts.join(' · ');
}

const STEPS = [
  { n: 1, label: 'Основа' },
  { n: 2, label: 'Характеристики' },
  { n: 3, label: 'Здоров\'я і чари' },
  { n: 4, label: 'Спорядження' },
  { n: 5, label: 'Дерево' },
];

// Filenames matching an archetype key (e.g. assets/archetypes/fighter.png) are picked up
// automatically — no code change needed once real illustrations are dropped into those folders.
function imagesByKey(globResult) {
  const map = {};
  for (const [path, url] of Object.entries(globResult)) {
    const key = path.match(/([^/]+)\.[a-z]+$/i)?.[1];
    if (key) map[key] = url;
  }
  return map;
}
const archetypeImages = imagesByKey(
  import.meta.glob('../assets/archetypes/*.{png,jpg,jpeg,svg}', { eager: true, import: 'default' })
);

export default function CharacterNew() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [characterId, setCharacterId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1 — basics
  const [name, setName] = useState('');
  const [archetype, setArchetype] = useState('');
  const [raceId, setRaceId] = useState('');
  const [peopleId, setPeopleId] = useState('');
  const { races } = useCharacterConfig();
  const race = races.find((r) => r.id === raceId) ?? null;
  const people = race?.peoples.find((p) => p.id === peopleId) ?? null;

  // Step 2 — skills. The pool defaults to 42 (+ race bonus) but the player may
  // set any number — homebrew tables adjust it.
  const [skills, setSkills] = useState({});
  const [skillBudget, setSkillBudget] = useState(BASE_BUDGET);
  // The racial +1 to 4 skills and the people's bonus are on top of the pool, not
  // paid out of it — only points above each skill's floor are spent.
  const skillFloors = skillFloorsFor(race, people);
  const skillRemaining = skillBudget - Object.entries(skills).reduce((s, [k, v]) => s + (v - (skillFloors[k] ?? 1)), 0);

  // Підвид належить расі — з іншою расою він недоступний.
  const chooseRace = (id) => {
    if (id === raceId) return;
    setRaceId(id);
    setPeopleId('');
  };

  // Step 5 — development tree. Starting experience defaults to 10, editable.
  const [experiencePoints, setExperiencePoints] = useState(10);
  const [treeProgress, setTreeProgress] = useState([]);
  const [treeCatalog, setTreeCatalog] = useState({
    abilities: [], abilityCollections: [], traditions: [],
  });

  // Step 3 — vitals
  const [healthDice, setHealthDice] = useState([]);

  // Step 4 — money & equipment
  const [money, setMoney] = useState(INITIAL_MONEY);
  const [equipment, setEquipment] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);

  // Weapons/armor/items and artifacts are one catalog (equipment.artifacts is
  // a 4th kind alongside them) — the starting-gear picker offers the whole union.
  useEffect(() => {
    equipmentApi.getAll().catch(() => []).then(setAllEquipment);
  }, []);

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const submitStep1 = async () => {
    if (!name.trim() || !archetype || !race) {
      setError('Заповніть імʼя, архетип та народ');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const char = await characterApi.create({ name: name.trim(), archetype, race_id: race.id, ...(people && { people_id: people.id }) });
      setCharacterId(char.id);
      setSkills(skillFloors);
      setSkillBudget(budgetFor(race));
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при створенні');
    } finally {
      setSaving(false);
    }
  };

  const submitStep2 = async () => {
    setSaving(true);
    setError('');
    try {
      // base_value snapshots the post-creation value — experience spent later
      // is measured against it (the point-buy pool is separate from experience).
      await characterApi.bulkUpdateSkills(
        characterId,
        Object.entries(skills).map(([skill_key, value]) => ({ skill_key, value, base_value: value }))
      );
      // physique may have changed — any dice rolled for a previous physique level are stale
      setHealthDice([]);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при збереженні навичок');
    } finally {
      setSaving(false);
    }
  };

  const submitStep3 = async () => {
    setSaving(true);
    setError('');
    try {
      const currentHp = healthDice.reduce((s, v) => s + v, 0);
      const currentMagic = skills.magic_sense * ARCHETYPES[archetype].magicMult;
      await characterApi.update(characterId, {
        health_dice_values: healthDice,
        current_hp: currentHp,
        current_magic: currentMagic,
      });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при збереженні стану');
    } finally {
      setSaving(false);
    }
  };

  const submitStep4 = async () => {
    setSaving(true);
    setError('');
    try {
      await characterApi.update(characterId, { money, experience_points: experiencePoints });
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при збереженні грошей');
    } finally {
      setSaving(false);
    }
  };

  // Load catalogs + current tree progress once the tree step opens.
  useEffect(() => {
    if (step !== 5 || !characterId) return;
    Promise.all([
      abilitiesApi.getAll().catch(() => []),
      createCollectionsApi('/api/abilities/collections/').getAll().catch(() => []),
      traditionsApi.getAll().catch(() => []),
      characterApi.getSheet(characterId).then((s) => s.tree || []).catch(() => []),
    ]).then(([abilities, abilityCollections, traditions, tree]) => {
      setTreeCatalog({ abilities, abilityCollections, traditions });
      setTreeProgress(tree);
    });
  }, [step, characterId]);

  const persistExperience = (v) => {
    setExperiencePoints(v);
    characterApi.update(characterId, { experience_points: v }).catch(() => {});
  };

  const unlockTreeNode = async (nodeId, via) => {
    await characterApi.unlockNode(characterId, nodeId, via).catch(() => {});
    const fresh = await characterApi.getSheet(characterId).catch(() => null);
    if (fresh) {
      setTreeProgress(fresh.tree || []);
      setExperiencePoints(fresh.character.experience_points);
    }
  };

  const finish = () => navigate(`/characters/${characterId}`);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-28 sm:px-6 md:pb-8">
      <h1 className="mb-4 font-display text-2xl text-accent">Новий персонаж</h1>
      <WizardSteps step={step} />

      <div className="flex flex-col gap-5">
        {step === 1 && (
          <Step1Basics
            name={name} setName={setName}
            archetype={archetype} setArchetype={setArchetype}
            races={races} raceId={raceId} setRace={chooseRace}
            peopleId={peopleId} setPeopleId={setPeopleId}
          />
        )}
        {step === 2 && (
          <Step2Skills
            skills={skills} setSkills={setSkills} remaining={skillRemaining}
            budget={skillBudget} setBudget={setSkillBudget} race={race}
            floors={skillFloors} people={people}
          />
        )}
        {step === 3 && (
          <Step3Vitals
            archetype={archetype}
            skills={skills}
            healthDice={healthDice}
            setHealthDice={setHealthDice}
          />
        )}
        {step === 4 && (
          <Step4Equipment
            characterId={characterId}
            money={money}
            setMoney={setMoney}
            equipment={equipment}
            setEquipment={setEquipment}
            allEquipment={allEquipment}
          />
        )}
        {step === 5 && (
          <Step5Tree
            archetype={archetype}
            treeProgress={treeProgress}
            experiencePoints={experiencePoints}
            onExperienceChange={persistExperience}
            onUnlock={unlockTreeNode}
            catalog={treeCatalog}
          />
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex justify-end gap-3">
          {step === 1 && (
            <Button variant="ghost" onClick={() => navigate('/characters')}>Скасувати</Button>
          )}
          {step > 1 && step < 5 && (
            <Button variant="ghost" onClick={goBack}>Назад</Button>
          )}

          {step === 1 && (
            <Button onClick={submitStep1} disabled={saving || !name || !archetype || !race}>
              {saving ? 'Створення...' : 'Далі'}
            </Button>
          )}
          {step === 2 && (
            <Button onClick={submitStep2} disabled={saving || skillRemaining < 0}>
              {saving ? 'Збереження...' : 'Далі'}
            </Button>
          )}
          {step === 3 && (
            <Button onClick={submitStep3} disabled={saving || healthDice.length === 0}>
              {saving ? 'Збереження...' : 'Далі'}
            </Button>
          )}
          {step === 4 && (
            <Button onClick={submitStep4} disabled={saving}>
              {saving ? 'Збереження...' : 'Далі'}
            </Button>
          )}
          {step === 5 && (
            <Button onClick={finish}>Завершити</Button>
          )}
        </div>
      </div>
    </div>
  );
}

function WizardSteps({ step }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2 text-xs">
      {STEPS.map((s) => (
        <div
          key={s.n}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${
            s.n === step
              ? 'border-accent bg-accent/10 font-semibold text-accent'
              : s.n < step
                ? 'border-sage/50 text-sage'
                : 'border-border text-text-dim'
          }`}
        >
          <span>{s.n}.</span>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Step1Basics({ name, setName, archetype, setArchetype, races, raceId, setRace, peopleId, setPeopleId }) {
  const { theme } = useTheme();
  // Неосновні раси (is_main: false) ховаються за «Інші народи»; якщо обрана саме така —
  // список лишається розгорнутим, щоб вибір не зникав з екрана.
  const mainRaces = races.filter((r) => r.is_main !== false);
  const otherRaces = races.filter((r) => r.is_main === false);
  const [showOthers, setShowOthers] = useState(false);
  const othersOpen = showOthers || otherRaces.some((r) => r.id === raceId);
  const renderRace = (r) => (
    <ChoiceCard
      key={r.id}
      selected={raceId === r.id}
      onClick={() => setRace(r.id)}
      title={r.name}
      description={htmlToPreviewText(r.description || '')}
      subtitle={raceBonusLabel(r)}
      image={r.image_url}
    >
      {raceId === r.id && r.peoples.length > 0 && (
        <PeopleSelect peoples={r.peoples} value={peopleId} onChange={setPeopleId} />
      )}
    </ChoiceCard>
  );
  const ARCHETYPE_COLORS = theme === 'dark' ? ARCHETYPE_COLORS_DARK : ARCHETYPE_COLORS_LIGHT;
  return (
    <Card>
      <h2 className="mb-5 font-display text-lg text-accent">1. Ім'я, архетип, народ</h2>

      <Field label="Імʼя персонажа" className="mb-6">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Введіть імʼя..."
          maxLength={200}
          required
        />
      </Field>

      <Field label="Архетип" className="mb-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Object.entries(ARCHETYPES).map(([key, a]) => (
            <ChoiceCard
              key={key}
              selected={archetype === key}
              onClick={() => setArchetype(key)}
              title={a.label}
              description={a.description}
              subtitle={`ПЗ: ${a.healthDie} · Магія ×${a.magicMult}`}
              image={archetypeImages[key]}
              color={ARCHETYPE_COLORS[key]?.color}
            />
          ))}
        </div>
      </Field>

      <Field label="Народ">
        {races.length === 0 ? (
          <p className="text-sm text-text-dim">Адміністратор ще не відкрив жодної раси для персонажів.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mainRaces.map(renderRace)}
            {otherRaces.length > 0 && (
              <button
                type="button"
                onClick={() => setShowOthers((v) => !v)}
                aria-expanded={othersOpen}
                className="flex min-h-24 items-center justify-center gap-2 rounded-lg border-[1.5px] border-dashed border-border bg-bg p-3 text-text-muted transition-colors hover:border-accent hover:text-accent"
              >
                <strong>Інші народи ({otherRaces.length})</strong>
                <ChevronDown size={16} className={`transition-transform ${othersOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
            {othersOpen && otherRaces.map(renderRace)}
          </div>
        )}
      </Field>
    </Card>
  );
}

// Необовʼязковий підвид (народ) — випадне меню всередині вибраної картки раси.
function PeopleSelect({ peoples, value, onChange }) {
  const chosen = peoples.find((p) => p.id === value);
  return (
    <div className="mt-1 flex flex-col gap-1.5 border-t border-border/40 pt-2" onClick={(e) => e.stopPropagation()}>
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">Підвид (необовʼязково)</span>
      <select className={`${inputClass} min-h-9 py-1.5 text-sm`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Без підвиду</option>
        {peoples.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {chosen?.description && (
        <p className="text-xs leading-snug text-text-muted">{htmlToPreviewText(chosen.description)}</p>
      )}
    </div>
  );
}

function ChoiceCard({ selected, onClick, title, subtitle, description, image, color, children }) {
  const style = selected && color
    ? { borderColor: color, backgroundColor: `${color}1a` }
    : undefined;
  const titleStyle = selected && color ? { color } : undefined;
  const titleClass = titleStyle ? '' : selected ? 'text-accent' : 'text-text';

  return (
    <div
      onClick={onClick}
      style={style}
      className={`flex cursor-pointer flex-col gap-2 rounded-lg border-[1.5px] p-3 text-left transition-colors ${
        style ? '' : selected ? 'border-accent bg-accent/10' : 'border-border bg-bg'
      }`}
    >
      <div className="flex h-24 items-center justify-center overflow-hidden rounded-md border border-border/40 bg-surface">
        {image ? (
          <img src={image} alt={title} className="h-full w-full object-cover" />
        ) : (
          <ChoicePlaceholder letter={title[0]} color={color} />
        )}
      </div>
      <strong style={titleStyle} className={titleClass}>{title}</strong>
      {description && <p className="text-xs leading-snug text-text-muted">{description}</p>}
      {subtitle && <p className="text-[0.7rem] text-text-dim">{subtitle}</p>}
      {children}
    </div>
  );
}

function ChoicePlaceholder({ letter, color }) {
  return (
    <svg viewBox="0 0 100 100" className="h-14 w-14">
      <circle cx="50" cy="50" r="46" fill="none" stroke={color || 'var(--color-border)'} strokeWidth="2" opacity="0.6" />
      <text
        x="50" y="60" textAnchor="middle" fontSize="36" fontFamily="Cinzel, serif"
        fill={color || 'var(--color-border)'} opacity="0.6"
      >
        {letter}
      </text>
    </svg>
  );
}

function Step2Skills({ skills, setSkills, remaining, budget, setBudget, race, floors, people }) {
  const floorFor = (key) => floors[key] ?? 1;

  const setSkill = (key, delta) => {
    setSkills((prev) => {
      const next = prev[key] + delta;
      if (next < floorFor(key) || next > 12) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [key]: next };
    });
  };

  const raceChar = CHARACTERISTICS.find((c) => c.key === race?.bonus_characteristic);
  const raceBonus = race?.bonus_value ?? 1;
  const skillLabels = Object.fromEntries(CHARACTERISTICS.flatMap((c) => c.skills.map((s) => [s.key, s.label])));
  const peopleBonuses = (people?.skill_bonuses ?? []).map((b) => `${signed(b.value)} ${skillLabels[b.skill]}`);

  return (
    <Card>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-accent">2. Розподіл навичок</h2>
        <div className={`font-semibold ${remaining < 0 ? 'text-danger' : remaining === 0 ? 'text-sage' : 'text-gold'}`}>
          Залишилось: <strong>{remaining}</strong> / {budget}
        </div>
      </div>
      <p className="mb-2 text-sm text-text-dim">
        {raceChar
          ? `Раса ${signed(raceBonus)} до навичок характеристики «${raceChar.label}», решта починаються з 1 (нижче 1 навичка не опускається). `
          : 'Усі навички починаються з 1. '}
        Розподіліть очки між навичками (від стартового значення до 12).
      </p>
      {peopleBonuses.length > 0 && (
        <p className="mb-2 text-sm text-text-dim">
          Підвид «{people.name}» безкоштовно змінює: {peopleBonuses.join(', ')}.
        </p>
      )}
      <p className="mb-5 text-xs text-text-dim">
        Пул очок (типово 42):
        <IntInput
          className="mx-1 w-10 border-0 border-b border-border/60 bg-transparent px-0.5 py-0 text-center text-text-muted focus:border-accent focus:outline-none"
          value={budget}
          min={0}
          onChange={(v) => setBudget(Math.max(0, v))}
        />
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHARACTERISTICS.map((char) => (
          <div key={char.key} className="rounded-lg bg-bg p-3">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-accent">{char.label}</h3>
            {char.skills.map((skill) => (
              <div key={skill.key} className="mb-2 flex items-center justify-between last:mb-0">
                <span className="text-sm text-text-muted">{skill.label}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text disabled:opacity-40"
                    onClick={() => setSkill(skill.key, -1)}
                    disabled={skills[skill.key] <= floorFor(skill.key)}
                  >−</button>
                  <span className="w-6 text-center font-semibold text-text">{skills[skill.key]}</span>
                  <button
                    type="button"
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface text-text disabled:opacity-40"
                    onClick={() => setSkill(skill.key, 1)}
                    disabled={skills[skill.key] >= 12 || remaining <= 0}
                  >+</button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

function Step3Vitals({ archetype, skills, healthDice, setHealthDice }) {
  const a = ARCHETYPES[archetype];
  const physiqueLevel = skillsToCharLevel([
    skills.strength, skills.immunity, skills.magic_sense, skills.endurance,
  ]);
  const maxDiceCount = PHYSIQUE_HEALTH[physiqueLevel] ?? 6;
  const dieSize = parseInt(a.healthDie.slice(1));
  const maxMagic = skills.magic_sense * a.magicMult;
  const currentHp = healthDice.reduce((s, v) => s + v, 0);

  const roll = () => setHealthDice(rollHealthDice(dieSize, maxDiceCount, healthDice));

  return (
    <Card>
      <h2 className="mb-5 font-display text-lg text-accent">3. Здоров'я, чари</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gold">Здоров'я</h3>
          <p className="mb-3 text-xs italic text-text-dim">Кубик здоров'я — {a.healthDie}</p>

          <div className="mb-3 grid grid-cols-[repeat(auto-fill,minmax(26px,1fr))] gap-[3px]">
            {Array.from({ length: maxDiceCount }).map((_, i) => (
              <div
                key={i}
                className={`flex h-[26px] items-center justify-center rounded border-[1.5px] text-xs font-semibold ${
                  healthDice[i] ? 'border-gold/50 bg-bg text-gold' : 'border-border bg-bg text-text-dim'
                }`}
              >
                {healthDice[i] ?? '·'}
              </div>
            ))}
          </div>

          {healthDice.length < maxDiceCount ? (
            <button
              type="button"
              className="min-h-11 w-full rounded border border-border px-3 py-1.5 text-sm text-accent"
              onClick={roll}
            >
              Кинути {maxDiceCount}{a.healthDie}
            </button>
          ) : (
            <p className="text-center text-2xl font-bold text-gold">{currentHp} ПЗ</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-gold">Чари</h3>
          <p className="mb-3 text-xs italic text-text-dim">Чуття магії × множник архетипу (×{a.magicMult})</p>
          <p className="text-center text-3xl font-bold text-gold">{maxMagic} / {maxMagic}</p>
        </div>
      </div>
    </Card>
  );
}

function Step4Equipment({ characterId, money, setMoney, equipment, setEquipment, allEquipment }) {
  const { currencies } = useCharacterConfig();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');

  const knownIds = new Set(equipment.map((e) => e.equipment_id));
  const filteredAll = allEquipment.filter((item) =>
    !knownIds.has(item.id) &&
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddItem = async (equipmentId) => {
    const item = await characterApi.addEquipment(characterId, equipmentId);
    if (item) setEquipment((prev) => [...prev, item]);
    setShowPicker(false);
  };

  const handleRemoveItem = async (equipmentId) => {
    await characterApi.removeEquipment(characterId, equipmentId);
    setEquipment((prev) => prev.filter((e) => e.equipment_id !== equipmentId));
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <h2 className="mb-5 font-display text-lg text-accent">4. Гроші</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {currencies.map((c) => (
            <div key={c.key ?? c.label} className="rounded-lg bg-bg p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{c.label}</h3>
              <div className="grid grid-cols-2 gap-3">
                {[c.high, c.low].map((denom) => (
                  <div key={denom.key}>
                    <label className="mb-1 block text-xs text-text-dim">
                      {denom.name}{denom.metal ? ` (${denom.metal})` : ''}
                    </label>
                    <div className="relative">
                      <IntInput
                        className={`${inputClass} pr-10`}
                        value={money[denom.key] ?? 0}
                        onChange={(v) => setMoney((m) => ({ ...m, [denom.key]: v }))}
                      />
                      <RollButton
                        formula="1d100"
                        title="Кинути d100"
                        showWidget={false}
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 rounded hover:bg-surface-hover"
                        onResult={(roll) => setMoney((m) => ({ ...m, [denom.key]: roll.total }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg text-accent">Бойове спорядження</h2>
          <span className="flex gap-3">
            <a href="/equipment" target="_blank" rel="noreferrer" className="text-sm text-accent">Спорядження →</a>
            <a href="/equipment/artifacts" target="_blank" rel="noreferrer" className="text-sm text-accent">Артефакти →</a>
          </span>
        </div>

        <button
          type="button"
          className="mb-5 min-h-9 rounded border border-border px-4 py-1.5 text-sm text-accent"
          onClick={() => setShowPicker(!showPicker)}
        >
          {showPicker ? '✕ Закрити' : '+ Додати предмет'}
        </button>

        {showPicker && (
          <div className="mb-5 rounded-md border border-border bg-bg p-3">
            <input
              className={`${inputClass} mb-2 text-sm`}
              placeholder="Пошук..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-[220px] overflow-y-auto">
              {filteredAll.length === 0 && <p className="my-2 text-sm text-text-dim">Немає доступних предметів</p>}
              {filteredAll.map((item) => (
                <div key={item.id} className="flex items-center justify-between border-b border-bg py-1.5 text-sm text-text-muted">
                  <span>{item.name} <em className="text-xs text-text-dim">{CATALOG_TYPES[item.type]?.label ?? item.type}</em></span>
                  <button type="button" className="min-h-9 rounded border border-border px-2.5 py-1.5 text-sm text-accent" onClick={() => handleAddItem(item.id)}>+</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {equipment.length === 0 && !showPicker && (
          <p className="text-sm text-text-dim">Спорядження ще не додано</p>
        )}

        {equipment.map((entry) => {
          const item = allEquipment.find((a) => a.id === entry.equipment_id);
          return (
            <div key={entry.equipment_id} className="mb-2 flex items-center justify-between border-b border-border/50 pb-2 last:mb-0 last:border-0">
              <div>
                <strong className="text-text">{item?.name ?? '(невідоме)'}</strong>
                <span className="ml-2 text-xs text-text-dim">
                  {item && (CATALOG_TYPES[item.type]?.label ?? item.type)}
                  {item?.damage_die ? ` · ${item.damage_die}` : ''}
                  {item?.defense_value ? ` · захист ${item.defense_value}` : ''}
                </span>
              </div>
              <button type="button" className="text-sm text-danger" onClick={() => handleRemoveItem(entry.equipment_id)}>
                Видалити
              </button>
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function Step5Tree({ archetype, treeProgress, experiencePoints, onExperienceChange, onUnlock, catalog }) {
  return (
    <Card>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
          <TreePine size={22} strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="font-display text-lg text-accent">5. Дерево розвитку архетипу</h2>
          <p className="text-sm text-text-dim">
            Витрать стартові пункти досвіду зараз або пізніше — на листі персонажа.
          </p>
        </div>
      </div>
      <DevelopmentTree
        archetype={archetype}
        tree={treeProgress}
        experiencePoints={experiencePoints}
        is_owner
        onUnlock={onUnlock}
        onExperienceChange={onExperienceChange}
        catalog={catalog}
      />
    </Card>
  );
}
