import { useState, useEffect } from 'react';
import chronologyApi from '../../api/chronology';
import Field, { inputClass } from '../ui/Field';
import { ageOnCalendarDate, yearLabel } from '../../utils/chronologyMath';

// Picks a date against one of the user's own/public calendars — first the
// calendar itself (chronologyApi.list(), same own+public visibility
// ChronologyList.jsx shows), then year/month/day scoped to it. Unlike
// EventForm.jsx (which assumes a calendar already in context), this picks
// the calendar too, since an NPC isn't tied to one campaign's calendar.
// Used for an NPC's birth and death dates.
//
// onAgeComputed(age | null) — лише для дати народження: вік на поточну дату
// обраного календаря (default_year/default_month_id), а якщо задано `until`
// (дата смерті в тому ж календарі) — вік на момент смерті. Форма підставляє
// його у поле «Вік».
export default function CalendarDatePicker({ value, onChange, onAgeComputed, until }) {
  const { calendarId = '', year = '', monthId = '', day = '' } = value || {};
  const [calendars, setCalendars] = useState([]);
  const [months, setMonths] = useState([]);

  useEffect(() => { chronologyApi.list().then(setCalendars).catch(() => {}); }, []);

  useEffect(() => {
    if (!calendarId) { setMonths([]); return; }
    chronologyApi.listMonths(calendarId).then(setMonths).catch(() => {});
  }, [calendarId]);

  const withAge = Boolean(onAgeComputed);
  const selectedMonth = months.find((m) => m.id === monthId);
  const calendar = calendars.find((c) => c.id === calendarId);
  const untilApplies = Boolean(until?.calendarId) && until.year !== '' && until.year != null;
  const untilSameCalendar = untilApplies && until.calendarId === calendarId;
  const now = untilSameCalendar
    ? { year: until.year, monthId: until.monthId, day: until.day }
    : (calendar && !untilApplies ? { year: calendar.default_year, monthId: calendar.default_month_id } : null);
  // months порожні, доки не підвантажились, — тоді вік рахується лише за роками
  // й одразу уточнюється, щойно місяці прийдуть.
  const age = withAge && calendar && now ? ageOnCalendarDate(months, { year, monthId, day }, now) : null;
  const nowMonth = months.find((m) => m.id === now?.monthId);

  useEffect(() => { if (withAge) onAgeComputed(age); }, [age]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (withAge) onAgeComputed(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value });

  return (
    <div className="flex flex-col gap-3">
      <Field label="Календар">
        <select
          className={inputClass} value={calendarId}
          onChange={(e) => onChange({ calendarId: e.target.value, year: '', monthId: '', day: '' })}
        >
          <option value="">Не вказано</option>
          {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>

      {calendarId && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Рік">
            <input type="number" className={inputClass} value={year} onChange={set('year')} />
          </Field>
          <Field label="Місяць">
            <select className={inputClass} value={monthId} onChange={set('monthId')}>
              <option value="">Не задано</option>
              {months.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="День">
            <input
              type="number" min={1} max={selectedMonth?.length || undefined}
              className={inputClass} value={day} onChange={set('day')}
            />
          </Field>
        </div>
      )}

      {withAge && calendar && year !== '' && (
        untilApplies && !untilSameCalendar ? (
          <p className="text-xs text-text-dim">
            Дата смерті вказана в іншому календарі — вік автоматично не рахується.
          </p>
        ) : untilSameCalendar ? (
          age == null ? (
            <p className="text-xs text-danger">Дата смерті раніша за дату народження.</p>
          ) : (
            <p className="text-xs text-text-dim">
              Вік на момент смерті: <span className="font-semibold text-text">{age}</span>
            </p>
          )
        ) : calendar.default_year == null ? (
          <p className="text-xs text-text-dim">
            Щоб вік рахувався автоматично, задайте календарю рік за замовчуванням (поточну дату) у його налаштуваннях.
          </p>
        ) : age == null ? (
          <p className="text-xs text-danger">Дата народження пізніша за поточну дату календаря.</p>
        ) : (
          <p className="text-xs text-text-dim">
            Вік на {[nowMonth?.name, yearLabel(Number(calendar.default_year), calendar.current_era_name, calendar.previous_era_name)].filter(Boolean).join(' ')}:{' '}
            <span className="font-semibold text-text">{age}</span>
          </p>
        )
      )}
    </div>
  );
}
