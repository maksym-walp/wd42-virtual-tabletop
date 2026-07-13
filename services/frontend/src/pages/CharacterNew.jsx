import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TreePine } from 'lucide-react';
import characterApi from '../api/characterSheet';
import equipmentApi from '../api/equipment';
import { EQUIPMENT_TYPES } from '../constants/equipment';
import {
  ARCHETYPES, RACES, CHARACTERISTICS, RACE_ANCESTRY_OPTIONS, ARCHETYPE_COLORS,
  PHYSIQUE_HEALTH, skillsToCharLevel, rollHealthDice, CURRENCIES,
} from '../constants/characterSheet';
import Card from '../components/ui/Card';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import IntInput from '../components/ui/IntInput';
import RollButton from '../components/RollButton';

const BUDGET = 42;
const ALL_SKILL_KEYS = CHARACTERISTICS.flatMap((c) => c.skills.map((s) => s.key));
const INITIAL_SKILLS = Object.fromEntries(ALL_SKILL_KEYS.map((k) => [k, 1]));
const INITIAL_MONEY = Object.fromEntries(
  CURRENCIES.flatMap((c) => [[c.high.key, 0], [c.low.key, 0]])
);

const STEPS = [
  { n: 1, label: 'Основа' },
  { n: 2, label: 'Характеристики' },
  { n: 3, label: 'Здоров\'я і чари' },
  { n: 4, label: 'Спорядження' },
  { n: 5, label: 'Дерево' },
];

// Filenames matching an archetype/race key (e.g. assets/archetypes/fighter.png) are picked up
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
const raceImages = imagesByKey(
  import.meta.glob('../assets/races/*.{png,jpg,jpeg,svg}', { eager: true, import: 'default' })
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
  const [race, setRace] = useState('');
  const [raceAncestry, setRaceAncestry] = useState('');

  // Step 2 — skills
  const [skills, setSkills] = useState(INITIAL_SKILLS);
  const skillRemaining = BUDGET - Object.values(skills).reduce((s, v) => s + (v - 1), 0);

  // Step 3 — vitals
  const [healthDice, setHealthDice] = useState([]);

  // Step 4 — money & equipment
  const [money, setMoney] = useState(INITIAL_MONEY);
  const [equipment, setEquipment] = useState([]);
  const [allEquipment, setAllEquipment] = useState([]);

  useEffect(() => {
    equipmentApi.getAll().then(setAllEquipment).catch(() => {});
  }, []);

  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const submitStep1 = async () => {
    if (!name.trim() || !archetype || !race) {
      setError('Заповніть імʼя, архетип та народ');
      return;
    }
    if (race === 'sangvi' && !raceAncestry) {
      setError('Оберіть народ-пращур для Санґви');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const char = await characterApi.create({
        name: name.trim(),
        archetype,
        race,
        race_ancestry: race === 'sangvi' ? raceAncestry : undefined,
      });
      setCharacterId(char.id);
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
      await characterApi.bulkUpdateSkills(
        characterId,
        Object.entries(skills).map(([skill_key, value]) => ({ skill_key, value }))
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
      const currentMagic = skills.endurance * ARCHETYPES[archetype].magicMult;
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
      await characterApi.update(characterId, { money });
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при збереженні грошей');
    } finally {
      setSaving(false);
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
            race={race} setRace={setRace}
            raceAncestry={raceAncestry} setRaceAncestry={setRaceAncestry}
          />
        )}
        {step === 2 && (
          <Step2Skills skills={skills} setSkills={setSkills} remaining={skillRemaining} />
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
        {step === 5 && <Step5TreePlaceholder />}

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

function Step1Basics({ name, setName, archetype, setArchetype, race, setRace, raceAncestry, setRaceAncestry }) {
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(RACES).map(([key, r]) => (
            <ChoiceCard
              key={key}
              selected={race === key}
              onClick={() => { setRace(key); setRaceAncestry(''); }}
              title={r.label}
              description={r.description}
              subtitle={r.ability}
              image={raceImages[key]}
            />
          ))}
        </div>
      </Field>

      {race === 'sangvi' && (
        <Field label="Народ-пращур (Санґви)" className="mt-5">
          <select
            className={inputClass}
            value={raceAncestry}
            onChange={(e) => setRaceAncestry(e.target.value)}
            required
          >
            <option value="">Оберіть пращура...</option>
            {RACE_ANCESTRY_OPTIONS.map((r) => (
              <option key={r} value={r}>{RACES[r]?.label ?? r}</option>
            ))}
          </select>
        </Field>
      )}
    </Card>
  );
}

function ChoiceCard({ selected, onClick, title, subtitle, description, image, color }) {
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

function Step2Skills({ skills, setSkills, remaining }) {
  const setSkill = (key, delta) => {
    setSkills((prev) => {
      const next = prev[key] + delta;
      if (next < 1 || next > 12) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      return { ...prev, [key]: next };
    });
  };

  return (
    <Card>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-accent">2. Розподіл навичок</h2>
        <div className={`font-semibold ${remaining < 0 ? 'text-danger' : remaining === 0 ? 'text-sage' : 'text-gold'}`}>
          Залишилось: <strong>{remaining}</strong> / {BUDGET}
        </div>
      </div>
      <p className="mb-5 text-sm text-text-dim">
        Усі навички починаються з 1. Розподіліть {BUDGET} додаткових очок між навичками (від 1 до 12).
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
                    disabled={skills[skill.key] <= 1}
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
  const maxMagic = skills.endurance * a.magicMult;
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
          <p className="mb-3 text-xs italic text-text-dim">Витривалість × множник архетипу (×{a.magicMult})</p>
          <p className="text-center text-3xl font-bold text-gold">{maxMagic} / {maxMagic}</p>
        </div>
      </div>
    </Card>
  );
}

function Step4Equipment({ characterId, money, setMoney, equipment, setEquipment, allEquipment }) {
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
          {CURRENCIES.map((c) => (
            <div key={c.region} className="rounded-lg bg-bg p-3">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">{c.region}</h3>
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
          <a href="/equipment" target="_blank" rel="noreferrer" className="text-sm text-accent">Увесь каталог →</a>
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
                  <span>{item.name} <em className="text-xs text-text-dim">{EQUIPMENT_TYPES[item.type]?.label ?? item.type}</em></span>
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
                  {item && (EQUIPMENT_TYPES[item.type]?.label ?? item.type)}
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

function Step5TreePlaceholder() {
  return (
    <Card className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
        <TreePine size={32} strokeWidth={1.75} />
      </div>
      <h2 className="font-display text-lg text-accent">5. Дерево розвитку архетипу</h2>
      <p className="max-w-sm text-sm text-text-dim">
        Дерево розвитку буде доступне пізніше — цей сервіс ще в розробці. Персонажа вже створено,
        і ви зможете повернутись до розвитку дерева, коли він буде готовий.
      </p>
    </Card>
  );
}
