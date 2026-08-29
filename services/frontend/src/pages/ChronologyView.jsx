import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarSearch, Settings, Trash2, Plus, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import campaignApi from '../api/campaigns';
import mapsApi from '../api/maps';
import compendiumApi from '../api/compendium';
import { totalDaysSinceEpoch, weekdayIndexOf, yearLabel, getActiveSeason, eventOccursOnDay } from '../utils/chronologyMath';
import { eventPlaceLabel } from '../utils/chronologyEvent';
import MoonPhase from '../components/MoonPhase';
import CatalogTabs from '../components/CatalogTabs';
import EventForm from '../components/chronology/EventForm';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';

const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };

export default function ChronologyView() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // ?campaign_id=... scopes the view to one campaign: its own events show
  // alongside global lore events (see chronologyApi.listEvents), its current
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
  const [locations, setLocations] = useState([]);
  const [characterOptions, setCharacterOptions] = useState([]);
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
    // .catch below, silently bouncing back to /chronology before the grid
    // (or the current-date controls, which don't even need `campaign` to
    // have loaded — just canManage/campaignId) ever rendered. A failed
    // campaign fetch now just means "no campaign context", same as omitting
    // ?campaign_id, instead of an unrelated page-load failure.
    // Locations are fetched for everyone — the day sheet resolves an
    // event's place label for any viewer, not just managers. Characters are
    // only needed to power EventForm's participant picker, which only a
    // manager ever opens, so that fetch is skipped for everyone else.
    Promise.all([
      chronologyApi.getOne(id),
      chronologyApi.listMonths(id),
      chronologyApi.listWeekdays(id),
      chronologyApi.listSeasons(id),
      chronologyApi.listMoons(id),
      chronologyApi.listEvents(id, campaignId),
      mapsApi.listLocations(),
      canManage
        ? Promise.all([compendiumApi.listEntries('npc'), compendiumApi.listEntries('creature')])
        : Promise.resolve([[], []]),
    ])
      .then(([cal, monthsList, weekdaysList, seasonsList, moonsList, eventsList, locationsList, [npcs, creatures]]) => {
        if (!alive) return;
        setCalendar(cal);
        setMonths(monthsList);
        setWeekdays(weekdaysList);
        setSeasons(seasonsList);
        setMoons(moonsList);
        setEvents(eventsList);
        setLocations(locationsList);
        setCharacterOptions([
          ...npcs.map((n) => ({ key: n.id, label: `${n.name} (НІП)` })),
          ...creatures.map((c) => ({ key: c.id, label: `${c.name} (Істота)` })),
        ]);

        // A ?year=&month_id=&day= link (from the Events tab's "Відкрити" on
        // an event with no location) wins over every other default below —
        // it's an explicit destination the user just followed, not a
        // fallback.
        const qYear = searchParams.get('year');
        const qMonthId = searchParams.get('month_id');
        const qDay = searchParams.get('day');
        const deepLinkMi = qMonthId ? monthsList.findIndex((m) => m.id === qMonthId) : -1;
        const hasDeepLink = Boolean(qYear && qDay && deepLinkMi !== -1);

        // Default view, lowest priority first: year 1 / first month, then
        // the calendar's own default_year/default_month_id, then (once it
        // loads, below) the campaign's actual current date — whichever is
        // most specific to what's being viewed wins. The deep link above
        // beats all three.
        const defaultMi = cal.default_month_id ? monthsList.findIndex((m) => m.id === cal.default_month_id) : -1;
        if (defaultMi !== -1 && !hasDeepLink) {
          setViewYear(cal.default_year ?? 1);
          setViewMonthIndex(defaultMi);
        }

        if (campaignId) {
          campaignApi.getOne(campaignId)
            .then((campaignData) => {
              if (!alive) return;
              setCampaign(campaignData);
              if (!hasDeepLink && campaignData?.current_month_id && campaignData?.current_year != null) {
                const mi = monthsList.findIndex((m) => m.id === campaignData.current_month_id);
                if (mi !== -1) {
                  setViewYear(campaignData.current_year);
                  setViewMonthIndex(mi);
                }
              }
            })
            .catch(() => {}); // best-effort — see the comment above
        }

        if (hasDeepLink) {
          setViewYear(Number(qYear));
          setViewMonthIndex(deepLinkMi);
          const totalDays = totalDaysSinceEpoch(monthsList, Number(qYear), deepLinkMi, Number(qDay));
          const weekdayIndex = weekdayIndexOf(totalDays, cal.first_day_offset || 0, weekdaysList.length);
          setSelectedDay({ day: Number(qDay), totalDays, weekdayIndex });
        }
      })
      .catch(() => { if (alive) navigate('/chronology'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, campaignId, canManage]);

  const refetchEvents = () => chronologyApi.listEvents(id, campaignId).then(setEvents);

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
              <Button to={`/chronology/${id}/build`}>Побудувати календар</Button>
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
        <Link to="/chronology" className="inline-flex items-center gap-1.5 text-sm text-text-dim">
          <ArrowLeft size={15} /> Календарі
        </Link>
        {canManage && (
          <Link to={`/chronology/${id}/build`} className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
            <Settings size={15} /> Редагувати структуру
          </Link>
        )}
      </div>

      <h1 className="mb-4 font-display text-2xl text-accent">{calendar.name}</h1>

      <CatalogTabs
        tabs={[
          { label: 'Сітка', to: `/chronology/${id}${campaignId ? `?campaign_id=${campaignId}` : ''}`, end: true },
          { label: 'Події', to: `/chronology/${id}/events${campaignId ? `?campaign_id=${campaignId}` : ''}` },
        ]}
      />

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
                  {/* Below md (768px) there's rarely room for a full weekday
                      name once a calendar has more than ~5-6 of them, so the
                      GM-authored short_name (builder-set, not truncated
                      client-side) takes over; falls back to the full name if
                      short_name was never set. */}
                  <span className="hidden md:inline">{wd.name}</span>
                  <span className="md:hidden">{wd.short_name || wd.name}</span>
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
          months={months}
          locations={locations}
          characterOptions={characterOptions}
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
  calendarId, campaignId, canManage, isCampaignGm, calendar, months, locations, characterOptions,
  activeMonth, viewYear, selectedDay, events, onClose, onEventsChanged, onCampaignDateSet,
}) {
  const [addingOpen, setAddingOpen] = useState(false);
  const [settingDate, setSettingDate] = useState(false);
  const [dateMessage, setDateMessage] = useState('');
  const [error, setError] = useState('');

  const locationsById = new Map(locations.map((l) => [l.id, l]));
  const title = `${selectedDay.day} ${activeMonth.name}, ${yearLabel(viewYear, calendar.current_era_name, calendar.previous_era_name)}`;

  const handleDelete = async (eventId) => {
    setError('');
    try {
      await chronologyApi.removeEvent(calendarId, eventId);
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
                  {eventPlaceLabel(e, locationsById) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-dim">
                      <MapPin size={11} /> {eventPlaceLabel(e, locationsById)}
                    </p>
                  )}
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
          <EventForm
            calendarId={calendarId}
            campaignId={campaignId}
            months={months}
            locations={locations}
            characterOptions={characterOptions}
            initialDate={{ year: viewYear, monthId: activeMonth.id, day: selectedDay.day }}
            onCancel={() => setAddingOpen(false)}
            onSaved={() => { setAddingOpen(false); onEventsChanged(); }}
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
