import { useEffect, useState } from 'react';
import chronologyApi from '../../api/chronology';
import { totalDaysSinceEpoch } from '../../utils/chronologyMath';
import { calendarOffset, dateFromTotalDays, dateLabel, isSynced } from '../../utils/chronologySync';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import { termsOf } from '../../utils/chronologyEras';

// Синхронізація календаря з календарем за замовчуванням: майстер вказує одну й
// ту саму мить у двох календарях («1 Нового року 1 тут = 12 Каель 1043 там»), з
// чого виходить постійний зсув у днях (sync_offset_days). Через нього події
// видно на сітках усіх синхронізованих календарів, а дати перераховуються при
// наведенні. `months` — місяці, що зараз у конструкторі (довжини беруться з
// форми, а не з БД), щоб синхронізувати ще до збереження структури.
export default function CalendarSyncSection({ calendarId, months }) {
  const [calendars, setCalendars] = useState(null);
  const [mine, setMine] = useState({ year: '1', monthIndex: 0, day: '1' });
  const [base, setBase] = useState({ year: '', monthIndex: 0, day: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { chronologyApi.list().then(setCalendars).catch(() => setCalendars([])); }, []);

  if (calendars === null) return <p className="text-sm text-text-dim">Завантаження...</p>;

  const self = calendars.find((c) => c.id === calendarId);
  const terms = termsOf(self);
  const baseCal = calendars.find((c) => c.is_default);

  if (!baseCal) {
    return <p className="text-sm text-text-dim">Календар за замовчуванням ще не обрано — його позначає адмін у списку календарів (зірочка). Синхронізація можлива лише з ним.</p>;
  }
  if (baseCal.id === calendarId) {
    return <p className="text-sm text-text-dim">Це календар за замовчуванням — основа синхронізації. Решта календарів прив'язуються до нього у своїх налаштуваннях.</p>;
  }

  const baseMonths = baseCal.preview_months || [];
  const synced = isSynced(self);
  // Що відповідає «дню 1 року 1» цього календаря в основному.
  const originInBase = synced
    ? dateFromTotalDays(baseMonths, -calendarOffset(self) + calendarOffset(baseCal))
    : null;

  const apply = (updated) => setCalendars((list) => list.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

  const validate = () => {
    const localMonths = months.map((m) => ({ ...m, length: Number(m.length) }));
    if (localMonths.length === 0 || baseMonths.length === 0) return 'У обох календарів мають бути місяці';
    for (const [label, d, list] of [['цьому календарі', mine, localMonths], ['основному календарі', base, baseMonths]]) {
      if (d.year === '' || !Number.isInteger(Number(d.year))) return `Вкажіть рік у ${label}`;
      const len = Number(list[d.monthIndex]?.length);
      if (!Number.isInteger(Number(d.day)) || Number(d.day) < 1 || Number(d.day) > len) {
        return `День у ${label} має бути від 1 до ${len}`;
      }
    }
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    const localMonths = months.map((m) => ({ ...m, length: Number(m.length) }));
    // світовий_день = день_в_основному − зсув_основного = день_тут − зсув_тут
    const totalMine = totalDaysSinceEpoch(localMonths, Number(mine.year), mine.monthIndex, Number(mine.day));
    const totalBase = totalDaysSinceEpoch(baseMonths, Number(base.year), base.monthIndex, Number(base.day));
    const offset = totalMine - totalBase + calendarOffset(baseCal);
    await send(offset);
  };

  const send = async (offset) => {
    setSaving(true);
    setError('');
    try {
      apply(await chronologyApi.setSync(calendarId, offset));
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти синхронізацію');
    } finally {
      setSaving(false);
    }
  };

  const dateInputs = (value, set, monthList, who) => (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Field label={`${terms.year} (${who})`}>
        <input type="number" className={inputClass} value={value.year} onChange={(e) => set({ ...value, year: e.target.value })} />
      </Field>
      <Field label="Місяць">
        <select className={inputClass} value={value.monthIndex} onChange={(e) => set({ ...value, monthIndex: Number(e.target.value) })}>
          {monthList.map((m, i) => <option key={m.id} value={i}>{m.name || 'Без назви'}</option>)}
        </select>
      </Field>
      <Field label={terms.day}>
        <input type="number" min={1} className={inputClass} value={value.day} onChange={(e) => set({ ...value, day: e.target.value })} />
      </Field>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-dim">
        {synced && originInBase
          ? <>Синхронізовано з «{baseCal.name}»: день 1 року 1 цього календаря = <span className="text-text">{dateLabel(baseCal, originInBase)}</span>.</>
          : <>Не синхронізовано. Вкажіть одну й ту саму мить у цьому календарі та в «{baseCal.name}» — події з'являтимуться в обох, а дати можна буде порівняти при наведенні.</>}
      </p>
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">Ця дата в цьому календарі</p>
        {dateInputs(mine, setMine, months, 'тут')}
        <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">= ця дата в «{baseCal.name}»</p>
        {dateInputs(base, setBase, baseMonths, 'там')}
      </div>
      <p className="text-xs text-text-dim">
        Якщо потім змінити довжину місяців, відповідність зсунеться — повторіть синхронізацію.
      </p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? 'Збереження...' : synced ? 'Оновити синхронізацію' : 'Синхронізувати'}
        </Button>
        {synced && (
          <Button type="button" size="sm" variant="ghost" onClick={() => send(null)} disabled={saving}>
            Вимкнути синхронізацію
          </Button>
        )}
      </div>
    </div>
  );
}
