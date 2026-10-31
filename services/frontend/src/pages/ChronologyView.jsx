import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarSearch, Settings, Trash2, Plus, MapPin, ListTree, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import campaignApi from '../api/campaigns';
import mapsApi from '../api/maps';
import { totalDaysSinceEpoch, getActiveSeason } from '../utils/chronologyMath';
import { makeTimeline, termsOf, dateFromTotalDays, NO_WEEKDAY_COLUMNS } from '../utils/chronologyEras';
import { eventsOnDay, equivalentDates, equivalentDatesText } from '../utils/chronologySync';
import { eventPlaceLabel, recurrenceLabel } from '../utils/chronologyEvent';
import MoonPhase from '../components/MoonPhase';
import SmartTextReader from '../components/SmartTextReader';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import ShareButton from '../components/ShareButton';

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
  const [calendars, setCalendars] = useState([]);
  const [locations, setLocations] = useState([]);
  const [campaign, setCampaign] = useState(null);
  const isCampaignGm = Boolean(campaign?.is_gm);
  const [loading, setLoading] = useState(true);

  // Сітка навігує днем базового відліку (viewT — будь-який день показаного
  // місяця): сторінка місяця, її підпис і межі виводяться з локального відліку
  // ер (chronologyEras.js), тож місяці й роки нової ери починаються з 1.
  const [viewT, setViewT] = useState(0);
  const [selectedT, setSelectedT] = useState(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jump, setJump] = useState({ eraIndex: -1, cycle: '1', year: '', monthIndex: 0 });
  const [jumpError, setJumpError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setCampaign(null);
    setViewT(0);
    setSelectedT(null);
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
    // event's place label for any viewer, not just managers.
    Promise.all([
      chronologyApi.getOne(id),
      chronologyApi.listMonths(id),
      chronologyApi.listWeekdays(id),
      chronologyApi.listSeasons(id),
      chronologyApi.listMoons(id),
      chronologyApi.listEvents(id, campaignId, { synced: true }),
      chronologyApi.list(),
      mapsApi.listLocations(),
    ])
      .then(([cal, monthsList, weekdaysList, seasonsList, moonsList, eventsList, calendarsList, locationsList]) => {
        if (!alive) return;
        setCalendar(cal);
        setMonths(monthsList);
        setWeekdays(weekdaysList);
        setSeasons(seasonsList);
        setMoons(moonsList);
        setEvents(eventsList);
        setCalendars(calendarsList);
        setLocations(locationsList);

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
          setViewT(totalDaysSinceEpoch(monthsList, Number(cal.default_year ?? 1), defaultMi, 1));
        }

        if (campaignId) {
          campaignApi.getOne(campaignId)
            .then((campaignData) => {
              if (!alive) return;
              setCampaign(campaignData);
              if (!hasDeepLink && campaignData?.current_month_id && campaignData?.current_year != null) {
                const mi = monthsList.findIndex((m) => m.id === campaignData.current_month_id);
                if (mi !== -1) {
                  setViewT(totalDaysSinceEpoch(monthsList, Number(campaignData.current_year), mi, 1));
                }
              }
            })
            .catch(() => {}); // best-effort — see the comment above
        }

        if (hasDeepLink) {
          const T = totalDaysSinceEpoch(monthsList, Number(qYear), deepLinkMi, Number(qDay));
          setViewT(T);
          setSelectedT(T);
        }
      })
      .catch(() => { if (alive) navigate('/chronology'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, campaignId, canManage]);

  const handleExport = async () => {
    try {
      const data = await chronologyApi.exportStructure(id);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(calendar.name || 'calendar').replace(/[\\/:*?"<>|]+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Не вдалося експортувати календар');
    }
  };

  const refetchEvents = () => chronologyApi.listEvents(id, campaignId, { synced: true }).then(setEvents);

  // Дата кампанії «сьогодні» у базовому відліку (null — не задана).
  const campaignT = (() => {
    const mi = campaign?.current_month_id ? months.findIndex((m) => m.id === campaign.current_month_id) : -1;
    return mi !== -1 && campaign.current_year != null && campaign.current_day != null
      ? totalDaysSinceEpoch(months, Number(campaign.current_year), mi, Number(campaign.current_day))
      : null;
  })();

  const jumpToToday = () => {
    if (campaignT != null) setViewT(campaignT);
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  if (months.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState icon="🗓️" title={calendar.term_month ? `У календаря ще немає: ${termsOf(calendar).month.toLowerCase()}` : 'У календаря ще немає місяців'}>
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

  const totalWeekdays = weekdays.length || Number(calendar.week_length) || 0;
  const terms = termsOf(calendar);
  // Локальний відлік календаря (ери) — повні months/weekdayCount свіжіші за
  // preview з getOne.
  const syncTarget = { ...calendar, months, weekdayCount: totalWeekdays, moons };
  const timeline = makeTimeline(syncTarget);
  const page = timeline.monthPage(viewT);
  const activeMonth = months[page.loc.monthIndex];
  const todayLoc = campaignT != null ? timeline.locate(campaignT) : null;

  const goToMonth = (delta) => setViewT(delta < 0 ? page.start - 1 : page.end + 1);

  const openJumpForm = () => {
    setJump({
      eraIndex: page.loc.eraIndex, cycle: String(page.loc.cycle ?? 1),
      year: String(page.loc.year), monthIndex: page.loc.monthIndex,
    });
    setJumpError('');
    setJumpOpen(true);
  };

  const applyJump = () => {
    const spec = {
      eraIndex: jump.eraIndex, cycle: Number(jump.cycle) || 1,
      year: Number(jump.year), monthIndex: Number(jump.monthIndex), day: 1,
    };
    if (!Number.isInteger(spec.year) || !timeline.isValidLocal(spec)) {
      setJumpError(`Такої дати (${terms.month.toLowerCase()} і рік) немає в цій ері — за межами її тривалості або циклу.`);
      return;
    }
    setViewT(timeline.toAbs(spec));
    setJumpOpen(false);
  };

  // A written label, not just the highlighted grid cell — the cell only
  // shows up at all once you're already browsing the right month/year,
  // which isn't a way to *find out* the current date in the first place.
  // Plain year here, not yearLabel's era suffix — this line is meant to be
  // a compact glance-and-go status, and "20 Каель, 102 За ільнбурзьким
  // календарем" runs long; the full era-suffixed form still shows in the
  // month header above, where there's room for it.
  const currentDateLabel = todayLoc
    ? `${todayLoc.day} ${todayLoc.monthName}, ${todayLoc.year}${todayLoc.era ? ` ${todayLoc.era.name}` : ''}`
    : null;

  const firstWeekday = timeline.weekdayAt(page.start);

  // Сітка рахує події через спільну вісь синхронізації: події інших календарів
  // потрапляють у клітинку, якщо їхня дата (з повторюваністю за структурою
  // власного календаря) збігається з цим днем. calendar з getOne — той самий
  // рядок, що в списку, але months/weekdayCount тут свіжіші.
  const syncCtx = { calendarsById: new Map(calendars.map((c) => [c.id, c])), target: syncTarget, targetTimeline: timeline };
  const baseOf = (T) => {
    const d = dateFromTotalDays(months, T);
    return { year: d.year, monthId: d.monthId, day: d.day };
  };

  // Клітинки — дні базового відліку від початку сторінки місяця до її кінця
  // (місяць може обриватися початком наступної ери).
  // Без днів тижня сітка — просто ряди по NO_WEEKDAY_COLUMNS днів.
  const columns = totalWeekdays || NO_WEEKDAY_COLUMNS;
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let T = page.start; T <= page.end; T++) cells.push(T);
  while (cells.length % columns !== 0) cells.push(null);

  const activeSeason = getActiveSeason(seasons, months, page.loc.monthIndex, 1);
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
        <div className="flex items-center gap-4">
          <Link
            to={`/chronology/events?calendar=${id}${campaignId ? `&campaign_id=${campaignId}` : ''}`}
            className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text"
          >
            <ListTree size={15} /> Список подій
          </Link>
          <button type="button" onClick={handleExport} className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
            <Download size={15} /> Експорт JSON
          </button>
          {canManage && (
            <Link to={`/chronology/${id}/build`} className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
              <Settings size={15} /> Редагувати структуру
            </Link>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2">
        <h1 className="font-display text-2xl text-accent">{calendar.name}</h1>
        <ShareButton className="mt-0.5" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border" style={containerStyle}>
        <div className={scrimmed ? 'bg-black/55 p-4 backdrop-blur-[1px]' : 'bg-surface p-4'}>
          <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 ${scrimmed ? 'text-white' : 'text-text'}`}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => goToMonth(-1)} aria-label={calendar.term_month ? `${terms.month}: назад` : 'Попередній місяць'}
                className={`rounded-lg border p-1.5 ${scrimmed ? 'border-white/30 hover:bg-white/10' : 'border-border hover:bg-surface-hover'}`}>
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <div className="font-display text-lg">{activeMonth.name}</div>
                <div className={`text-xs ${scrimmed ? 'text-white/70' : 'text-text-dim'}`}>
                  {timeline.yearText(page.loc)}
                </div>
              </div>
              <button type="button" onClick={() => goToMonth(1)} aria-label={calendar.term_month ? `${terms.month}: вперед` : 'Наступний місяць'}
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
              {timeline.hasEras && (
                <Field label="Ера">
                  <select
                    className={inputClass}
                    value={jump.eraIndex}
                    onChange={(e) => setJump((j) => ({ ...j, eraIndex: Number(e.target.value) }))}
                  >
                    <option value={-1}>{calendar.current_era_name || 'Основна ера'}</option>
                    {timeline.eras.map((er, i) => <option key={er.id || i} value={i}>{er.name}</option>)}
                  </select>
                </Field>
              )}
              {jump.eraIndex >= 0 && timeline.eras[jump.eraIndex]?.cycle && (
                <Field label="Цикл">
                  <input
                    type="number" min={1} className={`${inputClass} w-24`} value={jump.cycle}
                    onChange={(e) => setJump((j) => ({ ...j, cycle: e.target.value }))}
                  />
                </Field>
              )}
              <Field label={terms.year}>
                <input
                  type="number"
                  autoFocus
                  className={`${inputClass} w-28`}
                  value={jump.year}
                  onChange={(e) => setJump((j) => ({ ...j, year: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') applyJump(); if (e.key === 'Escape') setJumpOpen(false); }}
                />
              </Field>
              <Field label={terms.month}>
                <select
                  className={inputClass}
                  value={jump.monthIndex}
                  onChange={(e) => setJump((j) => ({ ...j, monthIndex: Number(e.target.value) }))}
                >
                  {months.map((m, i) => <option key={m.id} value={i}>{m.name}</option>)}
                </select>
              </Field>
              <Button size="sm" onClick={applyJump}>Перейти</Button>
              <Button variant="ghost" size="sm" onClick={() => setJumpOpen(false)}>Скасувати</Button>
              {jumpError && <p className="basis-full text-xs text-danger">{jumpError}</p>}
            </div>
          )}

          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {(weekdays.length > 0 ? weekdays : Array.from({ length: totalWeekdays }, (_, i) => ({ id: i, name: String(i + 1) }))).map((wd) => (
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
            {cells.map((T, i) => {
              if (T === null) return <div key={`blank-${i}`} />;
              const day = T - page.start + 1;
              const totalDays = T;
              const dayEvents = eventsOnDay(events, syncCtx, T);
              const equivalents = equivalentDatesText(calendars, syncTarget, baseOf(T));
              const isToday = T === campaignT;

              return (
                <button
                  key={T}
                  type="button"
                  onClick={() => setSelectedT(T)}
                  title={equivalents || undefined}
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
          {page.truncated && (
            <p className={`mt-3 text-xs ${scrimmed ? 'text-white/70' : 'text-text-dim'}`}>
              Тут закінчується {page.loc.era ? `«${page.loc.era.name}»` : 'основна ера'}: з наступного дня починається {(() => {
                const next = timeline.locate(page.end + 1);
                return next?.era ? `«${next.era.name}»${next.cycle ? ` (цикл ${next.cycle})` : ''}` : 'нова ера';
              })()}.
            </p>
          )}
        </div>
      </div>

      {selectedT != null && (
        <DayEventsSheet
          calendarId={id}
          campaignId={campaignId}
          canManage={canManage}
          isCampaignGm={isCampaignGm}
          calendar={calendar}
          locations={locations}
          moons={moons}
          title={timeline.format(selectedT)}
          baseDate={baseOf(selectedT)}
          calendars={calendars}
          events={eventsOnDay(events, syncCtx, selectedT)}
          equivalents={equivalentDates(calendars, syncTarget, baseOf(selectedT))}
          onClose={() => setSelectedT(null)}
          onEventsChanged={refetchEvents}
          onCampaignDateSet={(updated) => setCampaign(updated)}
        />
      )}
    </div>
  );
}

function DayEventsSheet({
  calendarId, campaignId, canManage, isCampaignGm, calendar, calendars, locations, moons = [],
  title, baseDate, events, equivalents, onClose, onEventsChanged, onCampaignDateSet,
}) {
  const [settingDate, setSettingDate] = useState(false);
  const [dateMessage, setDateMessage] = useState('');
  const [error, setError] = useState('');

  const locationsById = new Map(locations.map((l) => [l.id, l]));

  const calendarsById = new Map(calendars.map((c) => [c.id, c]));

  const handleDelete = async (event) => {
    setError('');
    try {
      // Подія може належати іншому (синхронізованому) календарю.
      await chronologyApi.removeEvent(event.calendar_id || calendarId, event.id);
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
        current_year: baseDate.year,
        current_month_id: baseDate.monthId,
        current_day: baseDate.day,
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
        {events.length === 0 && (
          <p className="text-sm text-text-dim">У цей день немає подій.</p>
        )}

        {equivalents.length > 0 && (
          <div className="rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text-dim">
            <p className="mb-1 font-semibold uppercase tracking-wide">В інших календарях</p>
            <ul className="flex flex-col gap-0.5">
              {equivalents.map((q) => (
                <li key={q.calendar.id}><span className="text-text">{q.label}</span> — {q.calendar.name}</li>
              ))}
            </ul>
          </div>
        )}

        {events.length > 0 && (
          <ul className="flex flex-col gap-2">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-bg p-3">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      to={`/chronology/${e.calendar_id}/events/${e.id}${campaignId ? `?campaign_id=${campaignId}` : ''}`}
                      className="text-sm font-semibold text-text hover:text-accent"
                    >
                      {e.name}
                    </Link>
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                      {recurrenceLabel(e, moons)}
                    </span>
                    {e.campaign_id && (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">Кампанія</span>
                    )}
                    {e.calendar_id !== calendarId && calendarsById.get(e.calendar_id) && (
                      <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                        {calendarsById.get(e.calendar_id).name}
                      </span>
                    )}
                  </div>
                  {e.description && <SmartTextReader text={e.description} className="mt-1 text-xs text-text-dim" />}
                  {eventPlaceLabel(e, locationsById) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-text-dim">
                      <MapPin size={11} /> {eventPlaceLabel(e, locationsById)}
                    </p>
                  )}
                </div>
                {canManage && (
                  <button type="button" onClick={() => handleDelete(e)} aria-label="Видалити подію"
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

        {canManage && (
          <Button
            variant="ghost" size="sm" className="self-start"
            to={`/chronology/events/new?${new URLSearchParams({
              calendar: calendarId,
              year: baseDate.year, month_id: baseDate.monthId, day: baseDate.day,
              ...(campaignId ? { campaign_id: campaignId } : {}),
            })}`}
          >
            <Plus size={14} /> Додати подію
          </Button>
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
