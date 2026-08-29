import { useState } from 'react';
import chronologyApi from '../../api/chronology';
import { totalDaysSinceEpoch } from '../../utils/chronologyMath';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };

// Shared create/edit form for a chronology event — used both by
// ChronologyView.jsx's "click a day → add event" flow (via `initialDate`,
// still editable rather than locked to the clicked cell) and by
// ChronologyEvents.jsx's standalone "Додати подію"/edit-a-row flow (via
// `event`). `months`/`locations`/`characterOptions` are fetched once by the
// caller and passed down so opening the form doesn't refetch them.
export default function EventForm({
  calendarId, campaignId, months, locations, characterOptions,
  event, initialDate, onCancel, onSaved,
}) {
  const isEdit = Boolean(event);

  const [name, setName] = useState(event?.name || '');
  const [description, setDescription] = useState(event?.description || '');
  const [color, setColor] = useState(event?.color || '#e0a020');
  const [isPublic, setIsPublic] = useState(event?.is_public ?? true);
  const [recurrence, setRecurrence] = useState(event?.recurrence || 'none');

  const [year, setYear] = useState(String(event?.year ?? initialDate?.year ?? ''));
  const [monthId, setMonthId] = useState(event?.month_id || initialDate?.monthId || '');
  const [day, setDay] = useState(String(event?.day ?? initialDate?.day ?? ''));

  const [isDuration, setIsDuration] = useState(
    Boolean(event && (event.end_year != null || event.end_month_id || event.end_day != null))
  );
  const [endYear, setEndYear] = useState(String(event?.end_year ?? ''));
  const [endMonthId, setEndMonthId] = useState(event?.end_month_id || '');
  const [endDay, setEndDay] = useState(String(event?.end_day ?? ''));

  const [placeMode, setPlaceMode] = useState(event?.location_id ? 'location' : event?.region ? 'region' : 'none');
  const [locationId, setLocationId] = useState(event?.location_id || '');
  const [region, setRegion] = useState(event?.region || '');

  const [participantIds, setParticipantIds] = useState(event?.participant_ids || []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Вкажіть назву події'); return; }
    if (!HEX_COLOR_RE.test(color)) { setError('Колір має бути у форматі #rrggbb'); return; }

    if (isDuration && year && monthId && day && endYear && endMonthId && endDay) {
      const startIdx = months.findIndex((m) => m.id === monthId);
      const endIdx = months.findIndex((m) => m.id === endMonthId);
      if (startIdx !== -1 && endIdx !== -1) {
        const startDays = totalDaysSinceEpoch(months, Number(year), startIdx, Number(day));
        const endDays = totalDaysSinceEpoch(months, Number(endYear), endIdx, Number(endDay));
        if (endDays < startDays) { setError('Дата завершення не може бути раніше дати початку'); return; }
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        campaign_id: campaignId || null,
        name: name.trim(),
        description: description || null,
        color,
        is_public: isPublic,
        year: year === '' ? null : Number(year),
        month_id: monthId || null,
        day: day === '' ? null : Number(day),
        recurrence,
        location_id: placeMode === 'location' ? (locationId || null) : null,
        region: placeMode === 'region' ? (region.trim() || null) : null,
        end_year: isDuration && endYear !== '' ? Number(endYear) : null,
        end_month_id: isDuration ? (endMonthId || null) : null,
        end_day: isDuration && endDay !== '' ? Number(endDay) : null,
        participant_ids: participantIds,
      };
      const saved = isEdit
        ? await chronologyApi.updateEvent(calendarId, event.id, payload)
        : await chronologyApi.createEvent(calendarId, payload);
      onSaved(saved);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти подію');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-3">
      <Field label="Назва">
        <input autoFocus className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      </Field>
      <Field label="Опис">
        <textarea rows={2} className={`${inputClass} resize-y`} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Рік">
          <input type="number" className={inputClass} value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
        <Field label="Місяць">
          <select className={inputClass} value={monthId} onChange={(e) => setMonthId(e.target.value)}>
            <option value="">Не задано</option>
            {months.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="День">
          <input type="number" min={1} className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
        <input type="checkbox" checked={isDuration} onChange={(e) => setIsDuration(e.target.checked)} className="h-5 w-5 accent-accent" />
        Тривала подія (має дату завершення)
      </label>

      {isDuration && (
        <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-3">
          <Field label="Рік завершення">
            <input type="number" className={inputClass} value={endYear} onChange={(e) => setEndYear(e.target.value)} />
          </Field>
          <Field label="Місяць завершення">
            <select className={inputClass} value={endMonthId} onChange={(e) => setEndMonthId(e.target.value)}>
              <option value="">Не задано</option>
              {months.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="День завершення">
            <input type="number" min={1} className={inputClass} value={endDay} onChange={(e) => setEndDay(e.target.value)} />
          </Field>
        </div>
      )}

      <Field label="Місце">
        <div className="mb-2 flex gap-1.5">
          {[['none', 'Не вказано'], ['location', 'Локація'], ['region', 'Регіон']].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setPlaceMode(key)}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                placeMode === key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border text-text-dim hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {placeMode === 'location' && (
          <select className={inputClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            <option value="">Оберіть локацію...</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
        {placeMode === 'region' && (
          <input
            className={inputClass}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Наприклад, Північні землі"
            maxLength={200}
          />
        )}
      </Field>

      <Field label="Персонажі">
        <MultiSelectDropdown
          options={characterOptions}
          value={participantIds}
          onChange={setParticipantIds}
          placeholder="Нікого не обрано"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Колір">
          <div className="flex items-center gap-2">
            <input type="color" value={HEX_COLOR_RE.test(color) ? color : '#888888'} onChange={(e) => setColor(e.target.value)}
              className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-bg p-1" />
            <input type="text" className={inputClass} value={color} onChange={(e) => setColor(e.target.value)} maxLength={7} />
          </div>
        </Field>
        <Field label="Повторення">
          <select className={inputClass} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
            {Object.entries(RECURRENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="h-5 w-5 accent-accent" />
        Публічна — видима всім гравцям
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Скасувати</Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Збереження...' : isEdit ? 'Зберегти' : 'Створити'}
        </Button>
      </div>
    </div>
  );
}
