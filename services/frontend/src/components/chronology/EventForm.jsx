import { useState } from 'react';
import useEventTypes from '../../hooks/useEventTypes';
import chronologyApi from '../../api/chronology';
import { totalDaysSinceEpoch, DURATION_DISPLAY_LABELS } from '../../utils/chronologyMath';
import { EVENT_COLOR_PRESETS } from '../../constants/chronologyColors';
import { convertDate, isSynced } from '../../utils/chronologySync';
import ColorField from '../ui/ColorField';
import EraDateFields from './EraDateFields';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';
import SmartTextarea from '../ui/SmartTextarea';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };

// Create/edit form for a chronology event — the body of the event form page
// (pages/ChronologyEventForm.jsx). `initialDate` prefills the date when the
// page is opened from a calendar day (still editable rather than locked to
// the clicked cell); `event` is the event being edited. `calendars` (рядки chronologyApi.list() зі структурою в
// preview_months)/`locations`/`characterOptions` are fetched once by the
// caller and passed down so opening the form doesn't refetch them.
//
// Подія належить календарю (`calendarId` — за замовчуванням, у редагуванні
// event.calendar_id): її дата й повторюваність рахуються за його структурою, а
// на сітках решти синхронізованих календарів вона показується через спільну
// вісь (chronologySync.js). Календар можна змінити в самій формі.
export default function EventForm({
  calendarId, calendars, campaignId, locations, characterOptions,
  event, initialDate, onCancel, onSaved,
}) {
  const isEdit = Boolean(event);
  const [ownerId, setOwnerId] = useState(event?.calendar_id || calendarId);
  const owner = calendars.find((c) => c.id === ownerId);
  const months = owner?.preview_months || [];

  const [name, setName] = useState(event?.name || '');
  const [description, setDescription] = useState(event?.description || '');
  // Тип події задає адмін (панель адміністратора), і колір події — це колір її
  // типу; власний колір лишається для подій без типу. own_color — збережений
  // власний колір (color у відповіді вже підмінено кольором типу).
  const { eventTypes } = useEventTypes();
  const [eventType, setEventType] = useState(event?.event_type || '');
  const activeType = eventTypes.find((t) => t.key === eventType);
  const [color, setColor] = useState(event?.own_color || event?.color || '#e0a020');
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
  // Нова тривала подія за замовчуванням позначається на початку й кінці;
  // збережена події зберігає свій вибір.
  const [durationDisplay, setDurationDisplay] = useState(event ? (event.duration_display || 'start') : 'start_end');

  const [placeMode, setPlaceMode] = useState(event?.location_id ? 'location' : event?.region ? 'region' : 'none');
  const [locationId, setLocationId] = useState(event?.location_id || '');
  const [region, setRegion] = useState(event?.region || '');

  const [participantIds, setParticipantIds] = useState(event?.participant_ids || []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Діапазон позначок (початок+кінець / кожен день) має сенс лише для
  // одноразової події; повторювана лишає тільки «початок» або «не показувати».
  const rangeDisplayAllowed = recurrence === 'none';
  const displayOptions = Object.entries(DURATION_DISPLAY_LABELS)
    .filter(([key]) => rangeDisplayAllowed || key === 'start' || key === 'none');
  const effectiveDisplay = displayOptions.some(([key]) => key === durationDisplay) ? durationDisplay : 'start';

  // Зміна календаря події: дату переносимо через синхронізацію, якщо обидва
  // календарі на спільній осі; інакше місяці (id чужого календаря) очищаємо.
  const changeOwner = (nextId) => {
    const next = calendars.find((c) => c.id === nextId);
    const move = (y, m, d, setY, setM, setD) => {
      const converted = owner && next && y !== '' && m && d !== ''
        ? convertDate(owner, next, { year: Number(y), monthId: m, day: Number(d) })
        : null;
      if (converted) { setY(String(converted.year)); setM(converted.monthId); setD(String(converted.day)); } else { setM(''); }
    };
    move(year, monthId, day, setYear, setMonthId, setDay);
    if (isDuration) move(endYear, endMonthId, endDay, setEndYear, setEndMonthId, setEndDay);
    setOwnerId(nextId);
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Вкажіть назву події'); return; }
    if (!activeType && !HEX_COLOR_RE.test(color)) { setError('Колір має бути у форматі #rrggbb'); return; }

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
        color: activeType ? activeType.color : color,
        event_type: activeType ? activeType.key : null,
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
        duration_display: isDuration ? effectiveDisplay : 'start',
        participant_ids: participantIds,
        calendar_id: ownerId,
      };
      // Редагування йде на маршрут поточного календаря події — бекенд сам
      // переносить її, якщо в тілі інший calendar_id.
      const saved = isEdit
        ? await chronologyApi.updateEvent(event.calendar_id || calendarId, event.id, payload)
        : await chronologyApi.createEvent(ownerId, payload);
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
      {calendars.length > 1 && (
        <Field
          label="Календар події"
          hint="Дату й повторюваність рахують за структурою цього календаря; в інших синхронізованих календарях подія з'явиться сама."
        >
          <select className={inputClass} value={ownerId} onChange={(e) => changeOwner(e.target.value)}>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.is_default ? ' ★' : ''}{isSynced(c) ? '' : ' (не синхронізовано)'}
              </option>
            ))}
          </select>
        </Field>
      )}
      {calendars.length > 1 && owner && !isSynced(owner) && (
        <p className="text-xs text-text-dim">
          Цей календар не синхронізовано з календарем за замовчуванням — подію бачитимуть лише в ньому.
        </p>
      )}
      <SmartTextarea label="Опис" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />

      {owner && (
        <EraDateFields
          key={`start-${ownerId}`}
          calendar={owner}
          value={{ year, monthId, day }}
          onChange={(v) => { setYear(v.year); setMonthId(v.monthId); setDay(v.day); }}
        />
      )}

      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
        <input type="checkbox" checked={isDuration} onChange={(e) => setIsDuration(e.target.checked)} className="h-5 w-5 accent-accent" />
        Тривала подія (має дату завершення)
      </label>

      {isDuration && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3">
          {owner && (
            <EraDateFields
              key={`end-${ownerId}`}
              calendar={owner}
              labelSuffix=" завершення"
              value={{ year: endYear, monthId: endMonthId, day: endDay }}
              onChange={(v) => { setEndYear(v.year); setEndMonthId(v.monthId); setEndDay(v.day); }}
            />
          )}
          <Field
            label="Позначка в календарі"
            hint={rangeDisplayAllowed ? undefined : 'Для повторюваної події доступні лише початок або приховування.'}
          >
            <select className={inputClass} value={effectiveDisplay} onChange={(e) => setDurationDisplay(e.target.value)}>
              {displayOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
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

      {eventTypes.length > 0 && (
        <Field
          label="Тип події"
          hint="Колір події визначається її типом — типи й кольори налаштовує адміністратор."
        >
          <div className="flex items-center gap-2">
            {activeType && (
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: activeType.color }} aria-hidden />
            )}
            <select className={inputClass} value={activeType ? eventType : ''} onChange={(e) => setEventType(e.target.value)}>
              <option value="">Без типу (власний колір)</option>
              {eventTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </Field>
      )}
      {!activeType && <ColorField label="Колір" value={color} onChange={setColor} presets={EVENT_COLOR_PRESETS} />}
      <Field label="Повторення">
        <select className={inputClass} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
          {Object.entries(RECURRENCE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </Field>
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
