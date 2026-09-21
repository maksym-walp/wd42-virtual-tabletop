import { useState, useEffect } from 'react';
import chronologyApi from '../../api/chronology';
import Field, { inputClass } from '../ui/Field';

// Picks a birth date against one of the user's own/public calendars — first
// the calendar itself (chronologyApi.list(), same own+public visibility
// ChronologyList.jsx shows), then year/month/day scoped to it. Unlike
// EventForm.jsx (which assumes a calendar already in context), this picks
// the calendar too, since an NPC isn't tied to one campaign's calendar.
export default function BirthDatePicker({ value, onChange }) {
  const { calendarId = '', year = '', monthId = '', day = '' } = value || {};
  const [calendars, setCalendars] = useState([]);
  const [months, setMonths] = useState([]);

  useEffect(() => { chronologyApi.list().then(setCalendars).catch(() => {}); }, []);

  useEffect(() => {
    if (!calendarId) { setMonths([]); return; }
    chronologyApi.listMonths(calendarId).then(setMonths).catch(() => {});
  }, [calendarId]);

  const selectedMonth = months.find((m) => m.id === monthId);

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
    </div>
  );
}
