import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarSearch, Settings, Trash2, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import calendarApi from '../api/calendar';
import campaignApi from '../api/campaigns';
import { totalDaysSinceEpoch, weekdayIndexOf, yearLabel, getActiveSeason, eventOccursOnDay } from '../utils/calendarMath';
import MoonPhase from '../components/MoonPhase';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;
const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };

export default function CalendarView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // ?campaign_id=... scopes the view to one campaign: its own events show
  // alongside global lore events (see calendarApi.listEvents), its current
  // date gets a "today" marker, and a GM gets a "Set as Current Campaign
  // Date" action. Without it, this is just the calendar in the abstract.
  const campaignId = searchParams.get('campaign_id') || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';

  const [calendar, setCalendar] = useState(null);
  const [months, setMonths] = useState([]);
  const [weekdays, setWeekdays] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [moons, setMoons] = useState([]);
  const [events, setEvents] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const isCampaignGm = Boolean(campaign?.is_gm);
  const [loading, setLoading] = useState(true);

  const [viewYear, setViewYear] = useState(1);
  const [viewMonthIndex, setViewMonthIndex] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpYear, setJumpYear] = useState('');
  const [jumpMonthIndex, setJumpMonthIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCampaign(null);
    // The campaign fetch is deliberately NOT in this Promise.all: it used to
    // be, which meant any failure to load it (403 — e.g. viewing with an
    // account that isn't actually this campaign's GM or a member; a stale
    // campaign_id) dragged the whole page down with it via the shared
    // .catch below, silently bouncing back to /calendars before the grid
    // (or the current-date controls, which don't even need `campaign` to
    // have loaded — just canManage/campaignId) ever rendered. A failed
    // campaign fetch now just means "no campaign context", same as omitting
    // ?campaign_id, instead of an unrelated page-load failure.
    Promise.all([
      calendarApi.getOne(id),
      calendarApi.listMonths(id),
      calendarApi.listWeekdays(id),
      calendarApi.listSeasons(id),
      calendarApi.listMoons(id),
      calendarApi.listEvents(id, campaignId),
    ])
      .then(([cal, monthsList, weekdaysList, seasonsList, moonsList, eventsList]) => {
        if (!alive) return;
        setCalendar(cal);
        setMonths(monthsList);
        setWeekdays(weekdaysList);
        setSeasons(seasonsList);
        setMoons(moonsList);
        setEvents(eventsList);

        // Default view, lowest priority first: year 1 / first month, then
        // the calendar's own default_year/default_month_id, then (once it
        // loads, below) the campaign's actual current date — whichever is
        // most specific to what's being viewed wins.
        const defaultMi = cal.default_month_id ? monthsList.findIndex((m) => m.id === cal.default_month_id) : -1;
        if (defaultMi !== -1) {
          setViewYear(cal.default_year ?? 1);
          setViewMonthIndex(defaultMi);
        }

        if (campaignId) {
          campaignApi.getOne(campaignId)
            .then((campaignData) => {
              if (!alive) return;
              setCampaign(campaignData);
              if (campaignData?.current_month_id && campaignData?.current_year != null) {
                const mi = monthsList.findIndex((m) => m.id === campaignData.current_month_id);
                if (mi !== -1) {
                  setViewYear(campaignData.current_year);
                  setViewMonthIndex(mi);
                }
              }
            })
            .catch(() => {}); // best-effort — see the comment above
        }
      })
      .catch(() => { if (alive) navigate('/calendars'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, campaignId]);

  const refetchEvents = () => calendarApi.listEvents(id, campaignId).then(setEvents);

  const goToMonth = (delta) => {
    let newIndex = viewMonthIndex + delta;
    let newYear = viewYear;
    if (newIndex < 0) { newIndex = months.length - 1; newYear -= 1; }
    else if (newIndex >= months.length) { newIndex = 0; newYear += 1; }
    setViewMonthIndex(newIndex);
    setViewYear(newYear);
  };

  const jumpToToday = () => {
    if (!campaign?.current_month_id || campaign.current_year == null) return;
    const mi = months.findIndex((m) => m.id === campaign.current_month_id);
    if (mi === -1) return;
    setViewYear(campaign.current_year);
    setViewMonthIndex(mi);
  };

  const openJumpForm = () => {
    setJumpYear(String(viewYear));
    setJumpMonthIndex(viewMonthIndex);
    setJumpOpen(true);
  };

  const applyJump = () => {
    const y = Number(jumpYear);
    if (!Number.isInteger(y)) return;
    setViewYear(y);
    setViewMonthIndex(jumpMonthIndex);
    setJumpOpen(false);
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  if (months.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState icon="🗓️" title="У календаря ще немає місяців">
          {canManage ? 'Спершу побудуйте його структуру.' : 'Майстер ще не побудував цей календар.'}
          {canManage && (
            <div className="mt-4">
              <Button to={`/calendars/build/${id}`}>Побудувати календар</Button>
            </div>
          )}
        </EmptyState>
      </div>
    );
  }

  const totalWeekdays = weekdays.length;
  const firstDayOffset = calendar.first_day_offset || 0;
  const activeMonth = months[viewMonthIndex];

  // A written label, not just the highlighted grid cell — the cell only
  // shows up at all once you're already browsing the right month/year,
  // which isn't a way to *find out* the current date in the first place.
  const currentDateMonth = campaign?.current_month_id ? months.find((m) => m.id === campaign.current_month_id) : null;
  // Plain year here, not yearLabel's era suffix — this line is meant to be
  // a compact glance-and-go status, and "20 Каель, 102 За ільнбурзьким
  // календарем" runs long; the full era-suffixed form still shows in the
  // month header above, where there's room for it.
  const currentDateLabel = currentDateMonth && campaign?.current_year != null && campaign?.current_day != null
    ? `${campaign.current_day} ${currentDateMonth.name}, ${campaign.current_year}`
    : null;

  const daysInMonth = Number(activeMonth.length);
  const firstWeekday = weekdayIndexOf(
    totalDaysSinceEpoch(months, viewYear, viewMonthIndex, 1), firstDayOffset, totalWeekdays
  );

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  if (totalWeekdays > 0) while (cells.length % totalWeekdays !== 0) cells.push(null);

  const activeSeason = getActiveSeason(seasons, months, viewMonthIndex, 1);
  const scrimmed = Boolean(activeSeason?.bg_image_url);

  const containerStyle = scrimmed
    ? { backgroundImage: `url(${activeSeason.bg_image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Link to="/calendars" className="inline-flex items-center gap-1.5 text-sm text-text-dim">
          <ArrowLeft size={15} /> Календарі
        </Link>
        {canManage && (
          <Link to={`/calendars/build/${id}`} className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
            <Settings size={15} /> Редагувати структуру
          </Link>
        )}
      </div>

      <h1 className="mb-4 font-display text-2xl text-accent">{calendar.name}</h1>

      <div className="overflow-hidden rounded-2xl border border-border" style={containerStyle}>
        <div className={scrimmed ? 'bg-black/55 p-4 backdrop-blur-[1px]' : 'bg-surface p-4'}>
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${scrimmed ? 'text-white' : 'text-text'}`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goToMonth(-1)} aria-label="Попередній місяць"
                className={`rounded-lg border p-1.5 ${scrimmed ? 'border-white/30 hover:bg-white/10' : 'border-border hover:bg-surface-hover'}`}>
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="font-display text-lg">{activeMonth.name}</div>
                <div className={`text-xs ${scrimmed ? 'text-white/70' : 'text-text-dim'}`}>
                  {yearLabel(viewYear, calendar.current_era_name, calendar.previous_era_name)}
                </div>
              </div>
              <button type="button" onClick={() => goToMonth(1)} aria-label="Наступний місяць"
                className={`rounded-lg border p-1.5 ${scrimmed ? 'border-white/30 hover:bg-white/10' : 'border-border hover:bg-surface-hover'}`}>
                <ChevronRight size={18} />
              </button>
              <button type="button" onClick={openJumpForm} aria-label="Перейти до дати" title="Перейти до дати"
                className={`rounded-lg border p-1.5 ${scrimmed ? 'border-white/30 hover:bg-white/10' : 'border-border hover:bg-surface-hover'}`}>
                <CalendarSearch size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              {activeSeason && (
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ color: activeSeason.color, backgroundColor: `${activeSeason.color}33` }}
                >
                  {activeSeason.name}
                </span>
              )}
              {currentDateLabel ? (
                <span className={`text-xs ${scrimmed ? 'text-white/85' : 'text-text-dim'}`}>
                  Поточна дата:{' '}
                  <button type="button" onClick={jumpToToday}
                    className={`font-semibold underline ${scrimmed ? 'text-white' : 'text-accent'}`}>
                    {currentDateLabel}
                  </button>
                </span>
              ) : isCampaignGm && (
                // Nothing to jump to yet — this only exists so a GM opening a
                // freshly-linked calendar can find the "set current date"
                // action at all, instead of it being invisible until they
                // stumble into clicking a day cell on their own.
                <span className={`text-xs italic ${scrimmed ? 'text-white/70' : 'text-text-dim'}`}>
                  Поточну дату кампанії ще не задано — клікніть на день внизу
                </span>
              )}
            </div>
          </div>

          {jumpOpen && (
            <div className={`mb-4 flex flex-wrap items-end gap-2 rounded-lg border p-3 ${scrimmed ? 'border-white/20 bg-black/20' : 'border-border bg-bg'}`}>
              <Field label="Рік">
                <input
                  type="number"
                  autoFocus
                  className={`${inputClass} w-28`}
                  value={jumpYear}
                  onChange={(e) => setJumpYear(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyJump(); if (e.key === 'Escape') setJumpOpen(false); }}
                />
              </Field>
              <Field label="Місяць">
                <select
                  className={inputClass}
                  value={jumpMonthIndex}
                  onChange={(e) => setJumpMonthIndex(Number(e.target.value))}
                >
                  {months.map((m, i) => <option key={m.id} value={i}>{m.name}</option>)}
                </select>
              </Field>
              <Button size="sm" onClick={applyJump}>Перейти</Button>
              <Button variant="ghost" size="sm" onClick={() => setJumpOpen(false)}>Скасувати</Button>
            </div>
          )}

          {totalWeekdays === 0 && (
            <p className={`text-sm ${scrimmed ? 'text-white/80' : 'text-text-dim'}`}>
              У календаря ще немає днів тижня — сітку показати неможливо, поки їх не додано в конструкторі.
            </p>
          )}

          {totalWeekdays > 0 && (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${totalWeekdays}, minmax(0, 1fr))` }}>
              {weekdays.map((wd) => (
                <div key={wd.id} className={`px-1 pb-1.5 text-center text-[0.65rem] font-bold uppercase tracking-wide ${scrimmed ? 'text-white/70' : 'text-text-dim'}`}>
                  {wd.name}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`blank-${i}`} />;
                const totalDays = totalDaysSinceEpoch(months, viewYear, viewMonthIndex, day);
                const weekdayIndex = weekdayIndexOf(totalDays, firstDayOffset, totalWeekdays);
                const dayEvents = events.filter((e) =>
                  eventOccursOnDay(e, { year: viewYear, monthId: activeMonth.id, day, weekdayIndex }, months, firstDayOffset, totalWeekdays)
                );
                const isToday = campaign?.current_month_id === activeMonth.id
                  && campaign?.current_year === viewYear && campaign?.current_day === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay({ day, totalDays, weekdayIndex })}
                    className={[
                      'flex min-h-20 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors',
                      scrimmed
                        ? `border-white/20 hover:bg-white/10 ${isToday ? 'bg-white/20' : 'bg-black/20'}`
                        : `border-border hover:bg-surface-hover ${isToday ? 'bg-accent/15' : 'bg-bg'}`,
                    ].join(' ')}
                  >
                    <span className={`text-xs font-semibold ${scrimmed ? 'text-white' : 'text-text'} ${isToday ? 'text-accent' : ''}`}>
                      {day}
                    </span>
                    {moons.length > 0 && (
                      <div className="flex flex-wrap gap-0.5">
                        {moons.map((m) => (
                          <MoonPhase
                            key={m.id}
                            name={m.name}
                            color={m.color}
                            cycleLength={Number(m.cycle_length)}
                            shift={Number(m.shift)}
                            totalDaysPassed={totalDays}
                            size={13}
                          />
                        ))}
                      </div>
                    )}
                    {dayEvents.length > 0 && (
                      <div className="mt-auto flex flex-wrap gap-1">
                        {dayEvents.slice(0, 4).map((e) => (
                          <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color }} title={e.name} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedDay && (
        <DayEventsSheet
          calendarId={id}
          campaignId={campaignId}
          canManage={canManage}
          isCampaignGm={isCampaignGm}
          calendar={calendar}
          activeMonth={activeMonth}
          viewYear={viewYear}
          selectedDay={selectedDay}
          events={events.filter((e) =>
            eventOccursOnDay(e, { year: viewYear, monthId: activeMonth.id, day: selectedDay.day, weekdayIndex: selectedDay.weekdayIndex }, months, firstDayOffset, totalWeekdays)
          )}
          onClose={() => setSelectedDay(null)}
          onEventsChanged={refetchEvents}
          onCampaignDateSet={(updated) => setCampaign(updated)}
        />
      )}
    </div>
  );
}

function DayEventsSheet({
  calendarId, campaignId, canManage, isCampaignGm, calendar, activeMonth, viewYear, selectedDay,
  events, onClose, onEventsChanged, onCampaignDateSet,
}) {
  const [addingOpen, setAddingOpen] = useState(false);
  const [settingDate, setSettingDate] = useState(false);
  const [dateMessage, setDateMessage] = useState('');
  const [error, setError] = useState('');

  const title = `${selectedDay.day} ${activeMonth.name}, ${yearLabel(viewYear, calendar.current_era_name, calendar.previous_era_name)}`;

  const handleDelete = async (eventId) => {
    setError('');
    try {
      await calendarApi.removeEvent(calendarId, eventId);
      onEventsChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося видалити подію');
    }
  };

  const handleSetCampaignDate = async () => {
    setSettingDate(true);
    setError('');
    setDateMessage('');
    try {
      const updated = await campaignApi.updateCurrentDate(campaignId, {
        calendar_id: calendarId,
        current_year: viewYear,
        current_month_id: activeMonth.id,
        current_day: selectedDay.day,
      });
      onCampaignDateSet(updated);
      setDateMessage('Поточну дату кампанії оновлено');
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося оновити дату кампанії');
    } finally {
      setSettingDate(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        {events.length === 0 && !addingOpen && (
          <p className="text-sm text-text-dim">У цей день немає подій.</p>
        )}

        {events.length > 0 && (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-bg p-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-semibold text-text">{e.name}</span>
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                      {RECURRENCE_LABELS[e.recurrence] || e.recurrence}
                    </span>
                    {e.campaign_id && (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">Кампанія</span>
                    )}
                  </div>
                  {e.description && <p className="mt-1 text-xs text-text-dim">{e.description}</p>}
                </div>
                {canManage && (
                  <button type="button" onClick={() => handleDelete(e.id)} aria-label="Видалити подію"
                    className="shrink-0 rounded p-1 text-danger hover:bg-surface-hover">
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {dateMessage && <p className="text-sm text-sage">{dateMessage}</p>}

        {canManage && !addingOpen && (
          <Button variant="ghost" size="sm" onClick={() => setAddingOpen(true)} className="self-start">
            <Plus size={14} /> Додати подію
          </Button>
        )}

        {canManage && addingOpen && (
          <NewEventForm
            calendarId={calendarId}
            campaignId={campaignId}
            selectedDay={selectedDay}
            viewYear={viewYear}
            activeMonth={activeMonth}
            onCancel={() => setAddingOpen(false)}
            onCreated={() => { setAddingOpen(false); onEventsChanged(); }}
          />
        )}

        {/* Gated on isCampaignGm (this specific campaign's GM), not the
            coarser calendar-manager role canManage uses elsewhere in this
            sheet — the backend endpoint this hits (updateCurrentDate) checks
            campaign.gm_id, not admin/game_master, so an admin/GM who's just
            a player in someone else's campaign shouldn't see this at all. */}
        {isCampaignGm && (
          <Button variant="ghost" size="sm" onClick={handleSetCampaignDate} disabled={settingDate} className="self-start">
            {settingDate ? 'Збереження...' : 'Встановити як поточну дату кампанії'}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function NewEventForm({ calendarId, campaignId, selectedDay, viewYear, activeMonth, onCancel, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#e0a020');
  const [isPublic, setIsPublic] = useState(true);
  const [recurrence, setRecurrence] = useState('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!name.trim()) { setError('Вкажіть назву події'); return; }
    if (!HEX_COLOR_RE.test(color)) { setError('Колір має бути у форматі #rrggbb'); return; }
    setSaving(true);
    setError('');
    try {
      await calendarApi.createEvent(calendarId, {
        campaign_id: campaignId || null,
        name: name.trim(),
        description: description || null,
        color,
        is_public: isPublic,
        year: viewYear,
        month_id: activeMonth.id,
        day: selectedDay.day,
        recurrence,
      });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося створити подію');
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
        <Button type="button" size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? 'Створення...' : 'Створити'}
        </Button>
      </div>
    </div>
  );
}
