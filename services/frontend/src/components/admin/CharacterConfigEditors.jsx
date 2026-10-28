import { useEffect, useRef, useState } from 'react';
import { GripVertical, X, Plus } from 'lucide-react';
import adminApi from '../../api/admin';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';
import { invalidateCharacterConfig } from '../../hooks/useCharacterConfig';
import { invalidateMagicForms } from '../../hooks/useMagicForms';
import { invalidateEventTypes } from '../../hooks/useEventTypes';
import compendiumApi from '../../api/compendium';
import { CHARACTERISTICS } from '../../constants/characterSheet';

// Редактори конфігів листа персонажа (стани, валюти). Їхні записи мають
// більше полів, ніж {key, label} звичайного ConfigCard, тож окремі картки.
// Значення з _rowId (стабільний React-ключ рядка), який не йде на бекенд.

const KEY_PATTERN = /^[a-z0-9_]+$/;
const keyInputClass = `${inputClass} font-mono text-sm`;

let nextRowId = 1_000_000;
const newRowId = () => nextRowId++;
const stripRowIds = (value) => value.map(({ _rowId, ...rest }) => rest);

function useRowDrag(value, onChange) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);
  return {
    overIndex,
    handleProps: (index) => ({
      draggable: true,
      onDragStart: (e) => { dragIndex.current = index; e.dataTransfer.effectAllowed = 'move'; },
      onDragEnd: () => setOverIndex(null),
    }),
    rowProps: (index) => ({
      onDragOver: (e) => { e.preventDefault(); if (overIndex !== index) setOverIndex(index); },
      onDrop: (e) => {
        e.preventDefault();
        setOverIndex(null);
        const from = dragIndex.current;
        dragIndex.current = null;
        if (from === null || from === index) return;
        const next = [...value];
        const [moved] = next.splice(from, 1);
        next.splice(index, 0, moved);
        onChange(next);
      },
    }),
  };
}

function ConfigShell({ title, hint, children, saving, error, onSave, onAdd, addLabel }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        {hint && <p className="text-xs text-text-dim">{hint}</p>}
        {children}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {onAdd ? (
            <Button type="button" variant="ghost" size="sm" onClick={onAdd}><Plus size={14} /> {addLabel}</Button>
          ) : <span />}
          <Button type="button" size="sm" disabled={saving} onClick={onSave}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}

// afterSave — скинути кеш фронтенду, що читає цей конфіг (за замовчуванням —
// кеш конфігів листа персонажа).
function useSave(configKey, value, validate, onSaved, afterSave = invalidateCharacterConfig) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    const stripped = stripRowIds(value);
    const problem = validate(stripped);
    if (problem) { setError(problem); return; }
    setSaving(true);
    setError('');
    try {
      const saved = await adminApi.updateConfig(configKey, stripped);
      afterSave(saved.value);
      onSaved(saved);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, save };
}

function checkKeys(entries, what) {
  const seen = new Set();
  for (const { key, label } of entries) {
    if (!label?.trim()) return `Кожен ${what} має мати назву`;
    if (!key || !KEY_PATTERN.test(key)) return `key "${key ?? ''}": лише латинські малі літери, цифри й "_"`;
    if (seen.has(key)) return `Дублікат key: ${key}`;
    seen.add(key);
  }
  return null;
}

// ── Стани ────────────────────────────────────────────────────────────────────

function validateConditions(value) {
  if (value.some((c) => !c.label?.trim())) return 'Кожен стан має мати назву';
  if (value.some((c) => (c.description ?? '').length > 2000)) return 'Опис стану — не довше 2000 символів';
  return null;
}

// Набір станів фіксований (Втома, Хвороба, Травма; рівні 1–5): ефекти рівнів
// задають правила character-sheet, тож без додавання, видалення,
// перетягування, зміни key і макс. рівня — лише назва й опис.
export function ConditionsConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const { saving, error, save } = useSave('conditions', value, validateConditions, onSaved);
  const update = (rowId, patch) => onChange(value.map((c) => (c._rowId === rowId ? { ...c, ...patch } : c)));

  return (
    <ConfigShell
      title="Стани персонажа"
      hint="Три стани з рівнями 1–5; кожен рівень закреслює один кубик здоровʼя, 6-й — непритомність. Ефекти рівнів задані правилами гри; тут — лише назва й опис, який гравці бачать за іконкою ⓘ."
      saving={saving}
      error={error}
      onSave={save}
    >
      {value.map((c) => (
        <div key={c._rowId} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <input className={inputClass} placeholder="Назва" value={c.label}
              onChange={(e) => update(c._rowId, { label: e.target.value })} />
            <input className={keyInputClass} value={c.key} readOnly aria-label="key" />
          </div>
          <textarea
            rows={2} className={inputClass} placeholder="Опис стану — його бачитимуть гравці за іконкою ⓘ"
            value={c.description ?? ''}
            onChange={(e) => update(c._rowId, { description: e.target.value })}
          />
        </div>
      ))}
    </ConfigShell>
  );
}

// ── Форми магії ──────────────────────────────────────────────────────────────

function validateMagicForms(value) {
  if (value.some((f) => !f.label?.trim())) return 'Кожна форма магії має мати назву';
  if (value.some((f) => (f.description ?? '').length > 2000)) return 'Опис форми магії — не довше 2000 символів';
  return null;
}

// Набір форм фіксований (його визначає CHECK у БД), тож без додавання,
// видалення, перетягування й зміни key — лише назва й опис, який гравці
// бачать при наведенні на форму магії заклинання.
export function MagicFormsConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const { saving, error, save } = useSave('magic_forms', value, validateMagicForms, onSaved, invalidateMagicForms);
  const update = (rowId, patch) => onChange(value.map((f) => (f._rowId === rowId ? { ...f, ...patch } : f)));

  return (
    <ConfigShell
      title="Форми магії"
      hint="Назва й опис кожної форми магії заклинань. Опис показується при наведенні на форму. Набір форм фіксований; key (службова назва) змінити не можна."
      saving={saving}
      error={error}
      onSave={save}
    >
      {value.map((f) => (
        <div key={f._rowId} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <input className={inputClass} placeholder="Назва" value={f.label}
              onChange={(e) => update(f._rowId, { label: e.target.value })} />
            <input className={keyInputClass} value={f.key} readOnly aria-label="key" />
          </div>
          <textarea
            rows={3} className={inputClass} placeholder="Опис форми магії — його побачать гравці при наведенні"
            value={f.description ?? ''}
            onChange={(e) => update(f._rowId, { description: e.target.value })}
          />
        </div>
      ))}
    </ConfigShell>
  );
}

// ── Валюти ───────────────────────────────────────────────────────────────────

function validateCurrencies(value) {
  if (!value.length) return 'Потрібна хоча б одна пара валют';
  const pairError = checkKeys(value, 'регіон');
  if (pairError) return pairError;
  const denoms = value.flatMap((p) => [p.high, p.low].map((d) => ({ ...d, label: d.name })));
  const denomError = checkKeys(denoms, 'номінал');
  if (denomError) return denomError;
  for (const p of value) {
    if (p.convertible && (!Number.isInteger(p.rate) || p.rate < 2)) return `«${p.label}»: курс — ціле число не менше 2`;
  }
  return null;
}

const emptyDenom = () => ({ key: '', name: '', metal: '' });

function DenomFields({ title, denom, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">{title}</span>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-2">
        <input className={inputClass} placeholder="Назва" value={denom.name}
          onChange={(e) => onChange({ ...denom, name: e.target.value })} />
        <input className={keyInputClass} placeholder="key" value={denom.key}
          onChange={(e) => onChange({ ...denom, key: e.target.value })} />
        <input className={inputClass} placeholder="Метал" value={denom.metal ?? ''}
          onChange={(e) => onChange({ ...denom, metal: e.target.value || null })} />
      </div>
    </div>
  );
}

export function CurrenciesConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const drag = useRowDrag(value, onChange);
  const { saving, error, save } = useSave('currencies', value, validateCurrencies, onSaved);
  const update = (rowId, patch) => onChange(value.map((p) => (p._rowId === rowId ? { ...p, ...patch } : p)));

  return (
    <ConfigShell
      title="Валюти"
      hint="Пара — старший і молодший номінал одного регіону. key номіналу — ключ балансу в гаманці персонажа: видалення чи зміна key не стирає баланс, але ховає його з листа, доки key не повернуть."
      saving={saving}
      error={error}
      onSave={save}
      addLabel="Додати пару"
      onAdd={() => onChange([...value, {
        key: '', label: '', description: '', convertible: true, rate: 100,
        high: emptyDenom(), low: emptyDenom(), _rowId: newRowId(),
      }])}
    >
      {value.map((p, index) => (
        <div
          key={p._rowId}
          {...drag.rowProps(index)}
          className={`flex gap-2 rounded-lg border border-border p-2.5 ${drag.overIndex === index ? 'bg-surface-hover' : ''}`}
        >
          <span {...drag.handleProps(index)} className="mt-2.5 shrink-0 cursor-grab text-text-dim active:cursor-grabbing" aria-label="Перетягнути">
            <GripVertical size={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <input className={inputClass} placeholder="Регіон / назва пари" value={p.label}
                onChange={(e) => update(p._rowId, { label: e.target.value })} />
              <input className={keyInputClass} placeholder="key пари" value={p.key}
                onChange={(e) => update(p._rowId, { key: e.target.value })} />
            </div>
            <DenomFields title="Старший номінал" denom={p.high} onChange={(high) => update(p._rowId, { high })} />
            <DenomFields title="Молодший номінал" denom={p.low} onChange={(low) => update(p._rowId, { low })} />
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2 text-text-dim">
                <input type="checkbox" className="h-4 w-4 accent-accent" checked={p.convertible}
                  onChange={(e) => update(p._rowId, { convertible: e.target.checked, rate: e.target.checked ? (p.rate ?? 100) : null })} />
                Обмінюється за курсом
              </label>
              {p.convertible && (
                <label className="inline-flex items-center gap-2 text-text-dim">
                  1 старший =
                  <input type="number" min="2" className={`${inputClass} w-24`} value={p.rate ?? ''}
                    onChange={(e) => update(p._rowId, { rate: e.target.value === '' ? null : Number(e.target.value) })} />
                  молодших
                </label>
              )}
            </div>
            <textarea rows={2} className={inputClass} placeholder="Опис (необовʼязково)" value={p.description ?? ''}
              onChange={(e) => update(p._rowId, { description: e.target.value })} />
          </div>
          <button type="button" onClick={() => onChange(value.filter((x) => x._rowId !== p._rowId))}
            aria-label="Видалити пару" className="shrink-0 self-start rounded-lg p-2 text-text-dim hover:text-danger">
            <X size={16} />
          </button>
        </div>
      ))}
    </ConfigShell>
  );
}

// ── Раси та підвиди персонажа ────────────────────────────────────────────────

const MAX_PEOPLE_BONUS = 5;
const MAX_RACE_BUDGET = 20;

function validateRaces(value) {
  const seenRaces = new Set();
  for (const race of value) {
    if (!race.race_id) return 'Оберіть расу у кожному блоці';
    if (seenRaces.has(race.race_id)) return 'Та сама раса додана двічі';
    seenRaces.add(race.race_id);
    if (!Number.isInteger(race.bonus_budget) || race.bonus_budget < 0 || race.bonus_budget > MAX_RACE_BUDGET) {
      return `Додаткові очки раси — ціле від 0 до ${MAX_RACE_BUDGET}`;
    }
    const seenPeoples = new Set();
    for (const people of race.peoples) {
      if (!people.people_id) return 'Оберіть народ у кожному підвиді';
      if (seenPeoples.has(people.people_id)) return 'Той самий народ додано двічі до однієї раси';
      seenPeoples.add(people.people_id);
      const skills = new Set();
      for (const bonus of people.skill_bonuses) {
        if (!bonus.skill) return 'Оберіть навичку у кожному бонусі';
        if (skills.has(bonus.skill)) return 'Навичка повторюється в одного підвиду';
        skills.add(bonus.skill);
        if (!Number.isInteger(bonus.value) || bonus.value < 1 || bonus.value > MAX_PEOPLE_BONUS) {
          return `Бонус до навички — ціле від 1 до ${MAX_PEOPLE_BONUS}`;
        }
      }
    }
  }
  return null;
}

export function RacesConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const { saving, error, save } = useSave('character_races', value, validateRaces, onSaved);
  // Публічні раси й народи компендіуму: гравцям віддаються лише вони, тож
  // тільки їх і пропонуємо.
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    Promise.all([compendiumApi.listRaces(), compendiumApi.listPeoples()])
      .then(([races, peoples]) => setCatalog({
        races: races.filter((r) => r.is_public),
        peoples: peoples.filter((p) => p.is_public),
      }))
      .catch(() => setCatalog({ races: [], peoples: [] }));
  }, []);

  const raceName = (id) => catalog?.races.find((r) => r.id === id)?.name;
  const update = (rowId, patch) => onChange(value.map((r) => (r._rowId === rowId ? { ...r, ...patch } : r)));
  const updatePeople = (race, index, patch) => update(race._rowId, {
    peoples: race.peoples.map((p, i) => (i === index ? { ...p, ...patch } : p)),
  });
  const updateBonus = (race, pIndex, bIndex, patch) => updatePeople(race, pIndex, {
    skill_bonuses: race.peoples[pIndex].skill_bonuses.map((b, i) => (i === bIndex ? { ...b, ...patch } : b)),
  });
  const removeAt = (list, index) => list.filter((_, i) => i !== index);

  return (
    <ConfigShell
      title="Раси та підвиди персонажа"
      hint="Раси, які гравець може обрати при створенні персонажа, — публічні раси компендіуму (назва, опис і зображення беруться звідти). Для кожної налаштуйте механіку (як і раніше: +1 до 4 навичок однієї характеристики та/або додаткові очки пулу) і підвиди — народи цієї раси з компендіуму з бонусами до навичок. Бонуси безкоштовні: додаються до значення навички й не віднімаються з пулу очок."
      saving={saving}
      error={error}
      onSave={save}
      addLabel="Додати расу"
      onAdd={() => onChange([...value, {
        race_id: '', bonus_characteristic: null, bonus_budget: 0, peoples: [], _rowId: newRowId(),
      }])}
    >
      {!value.length && <p className="text-sm text-text-dim">Жодної раси не відкрито — гравці не зможуть створити персонажа.</p>}
      {value.map((race) => {
        const racePeoples = catalog?.peoples.filter((p) => p.race_id === race.race_id) ?? [];
        const taken = new Set(value.filter((r) => r._rowId !== race._rowId).map((r) => r.race_id));
        return (
          <div key={race._rowId} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
            <div className="flex items-center gap-2">
              <select className={inputClass} value={race.race_id} aria-label="Раса"
                onChange={(e) => update(race._rowId, { race_id: e.target.value, peoples: [] })}>
                <option value="">Оберіть расу…</option>
                {race.race_id && !raceName(race.race_id) && (
                  <option value={race.race_id}>{catalog ? 'Раса недоступна (не публічна або видалена)' : 'Завантаження…'}</option>
                )}
                {catalog?.races.filter((r) => !taken.has(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button type="button" aria-label="Видалити расу" className="shrink-0 rounded-lg p-2 text-text-dim hover:text-danger"
                onClick={() => onChange(value.filter((r) => r._rowId !== race._rowId))}>
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-sm text-text-dim">
              <label className="inline-flex items-center gap-2">
                +1 до навичок
                <select className={`${inputClass} w-auto`} value={race.bonus_characteristic ?? ''} aria-label="Характеристика з бонусом"
                  onChange={(e) => update(race._rowId, { bonus_characteristic: e.target.value || null })}>
                  <option value="">— немає —</option>
                  {CHARACTERISTICS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              </label>
              <label className="inline-flex items-center gap-2">
                Додаткові очки пулу
                <input type="number" min="0" max={MAX_RACE_BUDGET} className={`${inputClass} w-20`} value={race.bonus_budget ?? 0}
                  onChange={(e) => update(race._rowId, { bonus_budget: e.target.value === '' ? null : Number(e.target.value) })} />
              </label>
            </div>

            {race.race_id && (
              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">Підвиди (народи)</span>
                {race.peoples.map((people, pIndex) => (
                  <div key={pIndex} className="flex gap-2 rounded-lg bg-bg p-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <select className={inputClass} value={people.people_id} aria-label="Народ"
                        onChange={(e) => updatePeople(race, pIndex, { people_id: e.target.value })}>
                        <option value="">Оберіть народ…</option>
                        {people.people_id && !racePeoples.some((p) => p.id === people.people_id) && (
                          <option value={people.people_id}>{catalog ? 'Народ недоступний (не публічний або видалений)' : 'Завантаження…'}</option>
                        )}
                        {racePeoples.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      {people.skill_bonuses.map((bonus, bIndex) => (
                        <div key={bIndex} className="flex items-center gap-2">
                          <select className={inputClass} value={bonus.skill} aria-label="Навичка"
                            onChange={(e) => updateBonus(race, pIndex, bIndex, { skill: e.target.value })}>
                            <option value="">Навичка…</option>
                            {CHARACTERISTICS.map((c) => (
                              <optgroup key={c.key} label={c.label}>
                                {c.skills.map((sk) => <option key={sk.key} value={sk.key}>{sk.label}</option>)}
                              </optgroup>
                            ))}
                          </select>
                          <span className="text-text-dim">+</span>
                          <input type="number" min="1" max={MAX_PEOPLE_BONUS} className={`${inputClass} w-20`} value={bonus.value}
                            aria-label="Бонус"
                            onChange={(e) => updateBonus(race, pIndex, bIndex, { value: e.target.value === '' ? null : Number(e.target.value) })} />
                          <button type="button" aria-label="Прибрати бонус" className="shrink-0 rounded-lg p-2 text-text-dim hover:text-danger"
                            onClick={() => updatePeople(race, pIndex, { skill_bonuses: removeAt(people.skill_bonuses, bIndex) })}>
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                      <div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => updatePeople(race, pIndex, {
                          skill_bonuses: [...people.skill_bonuses, { skill: '', value: 1 }],
                        })}><Plus size={14} /> Бонус до навички</Button>
                      </div>
                    </div>
                    <button type="button" aria-label="Видалити підвид" className="shrink-0 self-start rounded-lg p-2 text-text-dim hover:text-danger"
                      onClick={() => update(race._rowId, { peoples: removeAt(race.peoples, pIndex) })}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => update(race._rowId, {
                    peoples: [...race.peoples, { people_id: '', skill_bonuses: [] }],
                  })}><Plus size={14} /> Додати підвид</Button>
                  {catalog && !racePeoples.length && (
                    <span className="ml-2 text-xs text-text-dim">У цієї раси немає публічних народів у компендіумі.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </ConfigShell>
  );
}

// ── Типи подій хронології ────────────────────────────────────────────────────

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

function validateEventTypes(value) {
  if (!value.length) return null; // порожній список коректний — події користуються власним кольором
  const keysError = checkKeys(value, 'тип');
  if (keysError) return keysError;
  const bad = value.find((t) => !HEX_COLOR_RE.test(t.color || ''));
  return bad ? `«${bad.label}»: колір має бути у форматі #rrggbb` : null;
}

export function EventTypesConfigCard({ config, onChange, onSaved }) {
  const value = config.value;
  const drag = useRowDrag(value, onChange);
  const { saving, error, save } = useSave('event_types', value, validateEventTypes, onSaved, invalidateEventTypes);
  const update = (rowId, patch) => onChange(value.map((t) => (t._rowId === rowId ? { ...t, ...patch } : t)));

  return (
    <ConfigShell
      title="Типи подій хронології"
      hint="Кожна подія хронології має тип, а колір події береться з кольору її типу — змінивши колір тут, ви перефарбуєте всі події цього типу. key — службова назва типу, що зберігається в події: якщо змінити або видалити key, події цього типу втратять тип і користуватимуться власним кольором."
      saving={saving}
      error={error}
      onSave={save}
      addLabel="Додати тип"
      onAdd={() => onChange([...value, { key: '', label: '', color: '#e0a020', _rowId: newRowId() }])}
    >
      {value.length === 0 && <p className="text-sm text-text-dim">Типів ще немає — події користуються власним кольором.</p>}
      {value.map((t, index) => (
        <div
          key={t._rowId}
          {...drag.rowProps(index)}
          className={`flex items-center gap-2 rounded-lg border border-border p-2.5 ${drag.overIndex === index ? 'bg-surface-hover' : ''}`}
        >
          <span {...drag.handleProps(index)} className="shrink-0 cursor-grab text-text-dim active:cursor-grabbing" aria-label="Перетягнути">
            <GripVertical size={16} />
          </span>
          <input
            type="color"
            value={HEX_COLOR_RE.test(t.color || '') ? t.color : '#888888'}
            onChange={(e) => update(t._rowId, { color: e.target.value })}
            className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-border bg-bg p-1"
            aria-label={`Колір типу ${t.label || ''}`}
          />
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_7rem]">
            <input className={inputClass} placeholder="Назва" value={t.label}
              onChange={(e) => update(t._rowId, { label: e.target.value })} />
            <input className={keyInputClass} placeholder="key" value={t.key}
              onChange={(e) => update(t._rowId, { key: e.target.value })} />
            <input className={keyInputClass} placeholder="#rrggbb" value={t.color} maxLength={7}
              onChange={(e) => update(t._rowId, { color: e.target.value })} />
          </div>
          <button type="button" onClick={() => onChange(value.filter((x) => x._rowId !== t._rowId))}
            aria-label="Видалити тип" className="shrink-0 rounded-lg p-2 text-text-dim hover:text-danger">
            <X size={16} />
          </button>
        </div>
      ))}
    </ConfigShell>
  );
}
