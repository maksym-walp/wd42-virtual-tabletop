import { useEffect, useMemo, useState } from 'react';
import { totalDaysSinceEpoch } from '../../utils/chronologyMath';
import { makeTimeline, dateFromTotalDays, termsOf } from '../../utils/chronologyEras';
import Field, { inputClass } from '../ui/Field';

const EMPTY = { year: '', monthId: '', day: '' };

// Поля дати календаря: Рік / Місяць / День. Значення { year, monthId, day } —
// завжди у безперервному базовому відліку (так дати зберігаються); якщо в
// календаря є ери, поля показують і редагують ЛОКАЛЬНУ дату — «Ера, [цикл],
// рік, місяць, день» (у новій ері відлік знову з 1), а сюди віддають базову.
//
// Дата в календарі з ерами має бути повною (рік + місяць + день) або порожньою:
// локальний рік без дня не переводиться в базовий. Уже збережена часткова дата
// (напр. лише рік) лишається у звичайних базових полях, щоб її не затерти.
export default function EraDateFields({ calendar, value, onChange, labelSuffix = '', required = false }) {
  const timeline = useMemo(() => makeTimeline(calendar), [calendar]);
  const terms = termsOf(calendar);
  const months = timeline.months;
  const val = value || EMPTY;
  const isEmpty = val.year === '' && !val.monthId && val.day === '';
  const isComplete = val.year !== '' && Boolean(val.monthId) && val.day !== '';
  const localMode = timeline.hasEras && (isEmpty || isComplete);

  const baseDay = () => {
    const mi = months.findIndex((m) => m.id === val.monthId);
    return mi === -1 ? null : totalDaysSinceEpoch(months, Number(val.year), mi, Number(val.day));
  };

  // Ера «за замовчуванням» для нової дати: та, що діє на дату за замовчуванням
  // календаря, інакше остання.
  const defaultEraIndex = () => {
    const mi = months.findIndex((m) => m.id === calendar.default_month_id);
    if (calendar.default_year != null && mi !== -1) {
      const loc = timeline.locate(totalDaysSinceEpoch(months, Number(calendar.default_year), mi, 1));
      if (loc) return loc.eraIndex;
    }
    return timeline.eras.length - 1;
  };

  const fromValue = () => {
    const T = isComplete ? baseDay() : null;
    const loc = T == null ? null : timeline.locate(T);
    if (!loc) return { eraIndex: defaultEraIndex(), cycle: '1', year: '', monthIndex: '', day: '' };
    return { eraIndex: loc.eraIndex, cycle: String(loc.cycle ?? 1), year: String(loc.year), monthIndex: String(loc.monthIndex), day: String(loc.day) };
  };

  const [draft, setDraft] = useState(fromValue);

  const draftSpec = () => ({
    eraIndex: draft.eraIndex,
    cycle: Number(draft.cycle) || 1,
    year: Number(draft.year),
    monthIndex: Number(draft.monthIndex),
    day: Number(draft.day),
  });
  const draftFilled = draft.year !== '' && draft.monthIndex !== '' && draft.day !== '';
  const draftValid = localMode && draftFilled && Number.isInteger(draftSpec().year) && timeline.isValidLocal(draftSpec());
  const draftT = draftValid ? timeline.toAbs(draftSpec()) : null;

  // Значення змінили ззовні (напр. перенесення події в інший календар) —
  // перечитуємо чернетку, якщо воно вказує на іншу мить, ніж чернетка.
  useEffect(() => {
    if (!localMode || !isComplete) return;
    if (baseDay() !== draftT) setDraft(fromValue());
  }, [val.year, val.monthId, val.day]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!localMode) {
    const set = (field) => (e) => onChange({ ...val, [field]: e.target.value });
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={`${terms.year}${labelSuffix}`}>
          <input type="number" className={inputClass} value={val.year} onChange={set('year')} required={required} />
        </Field>
        <Field label={`Місяць${labelSuffix}`}>
          <select className={inputClass} value={val.monthId} onChange={set('monthId')}>
            <option value="">Не задано</option>
            {months.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label={`${terms.day}${labelSuffix}`}>
          <input type="number" min={1} className={inputClass} value={val.day} onChange={set('day')} />
        </Field>
      </div>
    );
  }

  const update = (patch) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    const spec = {
      eraIndex: next.eraIndex, cycle: Number(next.cycle) || 1,
      year: Number(next.year), monthIndex: Number(next.monthIndex), day: Number(next.day),
    };
    const filled = next.year !== '' && next.monthIndex !== '' && next.day !== '';
    if (filled && Number.isInteger(spec.year) && timeline.isValidLocal(spec)) {
      const d = dateFromTotalDays(months, timeline.toAbs(spec));
      onChange({ year: String(d.year), monthId: d.monthId, day: String(d.day) });
    } else if (!isEmpty) {
      onChange(EMPTY);
    }
  };

  const era = draft.eraIndex >= 0 ? timeline.eras[draft.eraIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label={`Ера${labelSuffix}`} className="col-span-2 sm:col-span-2">
          <select
            className={inputClass}
            value={draft.eraIndex}
            onChange={(e) => update({ eraIndex: Number(e.target.value) })}
          >
            <option value={-1}>{calendar.current_era_name || 'Основна ера'}</option>
            {timeline.eras.map((er, i) => <option key={er.id || i} value={i}>{er.name}</option>)}
          </select>
        </Field>
        {era?.cycle ? (
          <Field label={`Цикл${labelSuffix}`}>
            <input type="number" min={1} className={inputClass} value={draft.cycle} onChange={(e) => update({ cycle: e.target.value })} />
          </Field>
        ) : null}
        <Field label={`${terms.year}${labelSuffix}`}>
          <input type="number" className={inputClass} value={draft.year} onChange={(e) => update({ year: e.target.value })} required={required} />
        </Field>
        <Field label={`Місяць${labelSuffix}`}>
          <select className={inputClass} value={draft.monthIndex} onChange={(e) => update({ monthIndex: e.target.value })}>
            <option value="">Не задано</option>
            {months.map((m, i) => <option key={m.id} value={i}>{m.name}</option>)}
          </select>
        </Field>
        <Field label={`${terms.day}${labelSuffix}`}>
          <input type="number" min={1} className={inputClass} value={draft.day} onChange={(e) => update({ day: e.target.value })} />
        </Field>
      </div>
      {draftFilled && !draftValid && (
        <p className="text-xs text-danger">
          Такої дати немає в цій ері (за межами її тривалості або циклу).
        </p>
      )}
    </div>
  );
}
