import { useState, useEffect, useRef } from 'react';
import chronologyApi from '../../api/chronology';
import Field, { inputClass } from '../ui/Field';
import { ageOnCalendarDate, totalDaysSinceEpoch } from '../../utils/chronologyMath';
import { makeTimeline } from '../../utils/chronologyEras';
import EraDateFields from '../chronology/EraDateFields';
import { defaultCalendarId } from '../../utils/chronologyEvent';

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
  const latest = useRef({ value, onChange });
  latest.current = { value, onChange };

  // Календар за замовчуванням підставляється лише в зовсім порожню дату (ще не
  // обрано ні календар, ні рік/місяць/день) — вже збережений вибір не чіпаємо.
  useEffect(() => {
    chronologyApi.list()
      .then((list) => {
        setCalendars(list);
        // Актуальне значення з ref, а не з замикання: форма редагування могла
        // підвантажити збережену дату, поки йшов запит календарів.
        const cur = latest.current.value || {};
        const def = defaultCalendarId(list);
        if (def && !cur.calendarId && !cur.year && !cur.monthId && !cur.day) {
          latest.current.onChange({ calendarId: def, year: '', monthId: '', day: '' });
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!calendarId) { setMonths([]); return; }
    chronologyApi.listMonths(calendarId).then(setMonths).catch(() => {});
  }, [calendarId]);

  const withAge = Boolean(onAgeComputed);
  const calendar = calendars.find((c) => c.id === calendarId);
  const untilApplies = Boolean(until?.calendarId) && until.year !== '' && until.year != null;
  const untilSameCalendar = untilApplies && until.calendarId === calendarId;
  const now = untilSameCalendar
    ? { year: until.year, monthId: until.monthId, day: until.day }
    : (calendar && !untilApplies ? { year: calendar.default_year, monthId: calendar.default_month_id } : null);
  // months порожні, доки не підвантажились, — тоді вік рахується лише за роками
  // й одразу уточнюється, щойно місяці прийдуть.
  const age = withAge && calendar && now ? ageOnCalendarDate(months, { year, monthId, day }, now) : null;
  // Підпис «поточної дати» календаря (місяць і рік) у його локальному відліку (ери).
  const defaultDateText = (() => {
    if (!calendar || calendar.default_year == null) return '';
    const tl = makeTimeline(calendar);
    const mi = tl.months.findIndex((m) => m.id === calendar.default_month_id);
    const loc = tl.locate(totalDaysSinceEpoch(tl.months, Number(calendar.default_year), Math.max(mi, 0), 1));
    return loc ? [mi === -1 ? null : loc.monthName, tl.yearText(loc)].filter(Boolean).join(' ') : '';
  })();

  useEffect(() => { if (withAge) onAgeComputed(age); }, [age]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (withAge) onAgeComputed(null); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

      {calendar && (
        <EraDateFields
          key={calendarId}
          calendar={calendar}
          value={{ year, monthId, day }}
          onChange={(v) => onChange({ ...value, year: v.year, monthId: v.monthId, day: v.day })}
        />
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
            Вік на {defaultDateText}:{' '}
            <span className="font-semibold text-text">{age}</span>
          </p>
        )
      )}
    </div>
  );
}
