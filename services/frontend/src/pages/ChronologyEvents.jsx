import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Settings, Plus, Trash2, Pencil, ArrowUpDown, Download, MapPin, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import useEventLookups from '../hooks/useEventLookups';
import useEventTypes from '../hooks/useEventTypes';
import { eventDateRangeLabel, eventPlaceLabel, defaultCalendarId } from '../utils/chronologyEvent';
import {
  eventInCalendar, eventWorldSortKey, equivalentDatesText, buildEventsExport, monthsOf,
} from '../utils/chronologySync';
import { makeTimeline } from '../utils/chronologyEras';
import { totalDaysSinceEpoch, yearLabel } from '../utils/chronologyMath';
import { htmlToPreviewText } from '../utils/richText';
import Tooltip from '../components/ui/Tooltip';
import ChronologyTabs from '../components/chronology/ChronologyTabs';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import { MobileFab } from '../components/catalog/CatalogLayout';
import useMediaQuery from '../hooks/useMediaQuery';
import EmptyState from '../components/ui/EmptyState';
import { inputClass } from '../components/ui/Field';

const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };
const NO_TYPE = '__none__';
const MAX_PARTICIPANT_CHIPS = 4;

// Вкладка «Події» сервісу «Хронологія» — стрічка часу: вісь — вертикальна лінія
// посередині з роками, події — картки по обидва її боки. Осей може бути
// кілька водночас, по одній на календар (вибираються чипами: ?calendar=a,b);
// кожна показує події календаря в його власних датах (події синхронізованих
// календарів — перераховані через спільну вісь). Події фільтруються (пошук,
// тип, місце, персонаж), сортуються в обох напрямках і відкриваються окремою
// сторінкою (/chronology/:id/events/:eventId). Старі посилання
// /chronology/:id/events ведуть сюди через редірект у App.jsx.
export default function ChronologyEvents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign_id') || null;
  // ?event=<id> — посилання на конкретну подію: прокручуємо до неї й підсвічуємо.
  const highlightId = searchParams.get('event') || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';
  const { locationsById, charactersById } = useEventLookups();
  const { eventTypes, eventTypesMap } = useEventTypes();

  const [calendars, setCalendars] = useState(null); // null — ще вантажиться
  const [axes, setAxes] = useState([]); // [{ calendar, months, events }] у порядку вибору
  const [loading, setLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false); // лише для вузьких екранів

  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]); // ключі типів (NO_TYPE — події без типу); порожньо — усі
  const [placeFilter, setPlaceFilter] = useState(''); // 'loc:<id>' | 'reg:<назва>'
  const [participantFilter, setParticipantFilter] = useState('');

  useEffect(() => {
    chronologyApi.list()
      .then(setCalendars)
      .catch(() => navigate('/chronology'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Вибрані осі: ?calendar=a,b (лише наявні календарі), інакше календар за
  // замовчуванням, інакше перший зі списку.
  const selectedIds = useMemo(() => {
    if (!calendars) return [];
    const known = new Set(calendars.map((c) => c.id));
    const fromUrl = (searchParams.get('calendar') || '').split(',').filter((v) => known.has(v));
    if (fromUrl.length) return [...new Set(fromUrl)];
    const fallback = defaultCalendarId(calendars) || calendars[0]?.id;
    return fallback ? [fallback] : [];
  }, [calendars, searchParams]);
  const selectedKey = selectedIds.join(',');

  useEffect(() => {
    if (calendars === null) return undefined;
    if (!selectedIds.length) { setAxes([]); setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    Promise.all(selectedIds.map((calId) => Promise.all([
      chronologyApi.getOne(calId),
      chronologyApi.listMonths(calId),
      chronologyApi.listEvents(calId, campaignId, { synced: true }),
    ]).then(([calendar, months, events]) => ({ calendar, months, events }))))
      .then((list) => { if (alive) setAxes(list); })
      .catch(() => { if (alive) navigate('/chronology'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [selectedKey, campaignId, calendars, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSelected = (ids) => {
    const next = new URLSearchParams(searchParams);
    next.set('calendar', ids.join(','));
    next.delete('event');
    setSearchParams(next, { replace: true });
  };

  const toggleCalendar = (calId) => {
    if (selectedIds.includes(calId)) {
      if (selectedIds.length > 1) setSelected(selectedIds.filter((x) => x !== calId));
    } else {
      setSelected([...selectedIds, calId]);
    }
  };

  useEffect(() => {
    if (loading || !highlightId) return;
    document.querySelector(`[data-event-id="${highlightId}"]`)?.scrollIntoView({ block: 'center' });
  }, [loading, highlightId]);

  const calendarsById = useMemo(() => new Map((calendars || []).map((c) => [c.id, c])), [calendars]);

  const handleDelete = async (event) => {
    if (!confirm(`Видалити подію «${event.name}»?`)) return;
    await chronologyApi.removeEvent(event.calendar_id, event.id);
    setReloadTick((t) => t + 1);
  };

  // Експорт подій усіх календарів з прив'язкою до календаря за замовчуванням.
  const handleExport = async () => {
    try {
      const perCalendar = await Promise.all(calendars.map((c) => chronologyApi.listEvents(c.id, campaignId)));
      const data = buildEventsExport({
        calendars,
        events: perCalendar.flat(),
        locationsById,
        charactersById: new Map([...charactersById].map(([k, v]) => [k, v.label])),
        plainText: (html) => htmlToPreviewText(html),
      });
      const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chronology-events.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Не вдалося експортувати події');
    }
  };

  // Усе, за чим можна відфільтрувати, беремо з уже завантажених подій — щоб у
  // списках були лише значення, які реально трапляються.
  const allEvents = useMemo(() => axes.flatMap((a) => a.events), [axes]);
  const placeOptions = useMemo(() => {
    const out = new Map();
    for (const e of allEvents) {
      if (e.location_id) out.set(`loc:${e.location_id}`, locationsById.get(e.location_id)?.name || 'Локація (недоступна)');
      else if (e.region) out.set(`reg:${e.region}`, e.region);
    }
    return [...out].sort((a, b) => a[1].localeCompare(b[1], 'uk'));
  }, [allEvents, locationsById]);
  const participantOptions = useMemo(() => {
    const ids = new Set(allEvents.flatMap((e) => e.participant_ids || []));
    return [...ids]
      .map((pid) => [pid, charactersById.get(pid)?.label || 'Невідомий персонаж'])
      .sort((a, b) => a[1].localeCompare(b[1], 'uk'));
  }, [allEvents, charactersById]);

  const matches = (e) => {
    if (typeFilter.length) {
      const key = eventTypesMap[e.event_type] ? e.event_type : NO_TYPE;
      if (!typeFilter.includes(key)) return false;
    }
    if (placeFilter) {
      const key = e.location_id ? `loc:${e.location_id}` : e.region ? `reg:${e.region}` : '';
      if (key !== placeFilter) return false;
    }
    if (participantFilter && !(e.participant_ids || []).includes(participantFilter)) return false;
    const needle = search.trim().toLowerCase();
    if (needle) {
      const haystack = [e.name, htmlToPreviewText(e.description || ''), eventPlaceLabel(e, locationsById) || '']
        .join(' ').toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  };

  const hasFilters = Boolean(search || typeFilter.length || placeFilter || participantFilter);
  const resetFilters = () => { setSearch(''); setTypeFilter([]); setPlaceFilter(''); setParticipantFilter(''); };
  const toggleType = (key) => setTypeFilter((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));

  if (calendars === null || (selectedIds.length > 0 && loading && axes.length === 0)) {
    return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  }

  if (!selectedIds.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
        <PageHeader title="🗓️ Хронологія" />
        <ChronologyTabs />
        <EmptyState icon="📜" title="Ще немає жодного календаря">
          Події належать календарям — спершу створіть календар у вкладці «Календарі».
        </EmptyState>
      </div>
    );
  }

  const newEventLink = `/chronology/events/new?calendar=${selectedIds[0]}${campaignId ? `&campaign_id=${campaignId}` : ''}`;
  const showTypeFilter = eventTypes.length > 0;

  return (
    <div className={`mx-auto px-4 py-6 pb-24 sm:px-6 md:pb-8 ${selectedIds.length > 1 ? 'max-w-[100rem]' : 'max-w-[90rem]'}`}>
      {/* Компактна шапка: назва й вкладки ліворуч, осі часу праворуч — щоб
          стрічка отримала якомога більше місця. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <h1 className="font-display text-2xl text-accent">🗓️ Хронологія</h1>
        <ChronologyTabs compact />
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Осі часу</span>
          {calendars.map((c) => {
            const on = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCalendar(c.id)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  on ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim hover:bg-surface-hover'
                }`}
              >
                {c.name}{c.is_default ? ' ★' : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
        {/* Ліва панель: дії, сортування й фільтри подій. Нижче lg згортається. */}
        <aside className="mb-4 lg:sticky lg:top-4 lg:mb-0 lg:self-start">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            className="mb-2 flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm font-semibold text-text-dim lg:hidden"
          >
            Фільтри та дії {hasFilters && '•'}
          </button>
          <div className={`${filtersOpen ? 'flex' : 'hidden'} flex-col gap-3 lg:flex`}>
            {canManage && (
              <Button to={newEventLink} className="hidden w-full md:inline-flex">
                <Plus size={14} /> Додати подію
              </Button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-2 text-xs font-semibold text-text-dim hover:bg-surface-hover"
                title={sortDir === 'asc' ? 'Від давніх до нових' : 'Від нових до давніх'}
              >
                <ArrowUpDown size={13} /> {sortDir === 'asc' ? 'Давні → нові' : 'Нові → давні'}
              </button>
              <Button size="sm" variant="ghost" onClick={handleExport} title="Експорт JSON" aria-label="Експорт JSON">
                <Download size={14} />
              </Button>
            </div>

            <input
              className={inputClass} type="search" placeholder="Пошук подій..."
              value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Пошук подій"
            />
            <select className={inputClass} value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)} aria-label="Місце">
              <option value="">Усі місця</option>
              {placeOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            <select className={inputClass} value={participantFilter} onChange={(e) => setParticipantFilter(e.target.value)} aria-label="Персонаж">
              <option value="">Усі персонажі</option>
              {participantOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
            {showTypeFilter && (
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-dim">Тип</span>
                <div className="flex flex-wrap gap-1.5">
                  {[...eventTypes, { key: NO_TYPE, label: 'Без типу', color: null }].map((t) => {
                    const on = typeFilter.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleType(t.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                          on ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim hover:bg-surface-hover'
                        }`}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-border"
                          style={t.color ? { backgroundColor: t.color, borderColor: t.color } : undefined}
                        />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 self-start text-xs font-semibold text-accent hover:underline">
                <X size={12} /> Скинути фільтри
              </button>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <Timeline
            axes={axes}
            matches={matches}
            filtered={hasFilters}
            sortDir={sortDir}
            calendars={calendars}
            calendarsById={calendarsById}
            eventTypesMap={eventTypesMap}
            locationsById={locationsById}
            charactersById={charactersById}
            canManage={canManage}
            campaignId={campaignId}
            highlightId={highlightId}
            onDelete={handleDelete}
          />
        </div>
      </div>
      {canManage && <MobileFab to={newEventLink} label="Додати подію" />}
    </div>
  );
}

const AXIS_GAP = 28; // px між паралельними осями

// Стрічка часу: осі всіх вибраних календарів ідуть поряд посередині, а події
// усіх цих календарів — разом по боках від них, чергуючись. Дата, порядок і
// підписи років — за основним календарем (за замовчуванням, якщо він вибраний,
// інакше першим із вибраних); подія стоїть на осі свого календаря. На вузьких
// екранах осі зліва, а всі картки — праворуч від них.
function Timeline({
  axes, matches, filtered, sortDir, calendars, calendarsById, eventTypesMap,
  locationsById, charactersById, canManage, campaignId, highlightId, onDelete,
}) {
  const wide = useMediaQuery('(min-width: 768px)');
  const n = axes.length;
  const main = axes.find((a) => a.calendar.is_default) || axes[0];
  const mainCalendar = main.calendar;
  const mainTimeline = useMemo(() => makeTimeline({ ...mainCalendar, months: main.months }), [mainCalendar, main.months]);

  // Усі події разом (одна й та сама подія може прийти з кількох осей через
  // синхронізацію): на осі власного календаря, якщо він вибраний, інакше — на
  // першій осі, що її отримала.
  const merged = useMemo(() => {
    const ids = axes.map((a) => a.calendar.id);
    const byId = new Map();
    axes.forEach((a, i) => a.events.forEach((e) => {
      if (!byId.has(e.id)) byId.set(e.id, { event: e, axis: ids.includes(e.calendar_id) ? ids.indexOf(e.calendar_id) : i });
    }));
    return [...byId.values()];
  }, [axes]);

  // Подія в датах основного календаря; якщо перерахувати не вдалося
  // (несинхронізований календар, неповна дата) — у власних.
  const viewOf = (e) => {
    const owner = calendarsById.get(e.calendar_id);
    if (!owner || owner.id === mainCalendar.id) return { owner: owner || mainCalendar, shown: e, foreign: false };
    const shown = eventInCalendar(e, owner, mainCalendar);
    return { owner, shown: shown || e, foreign: true, converted: Boolean(shown) };
  };

  const visible = merged.filter(({ event }) => matches(event));
  // Сортування на світовій осі, а не за датою власного календаря. Без дати —
  // завжди в кінець.
  const sorted = [...visible].sort((x, y) => {
    const ka = eventWorldSortKey(x.event, calendarsById);
    const kb = eventWorldSortKey(y.event, calendarsById);
    if (ka === kb) return 0; // Infinity - Infinity = NaN
    if (ka === Infinity) return 1;
    if (kb === Infinity) return -1;
    return sortDir === 'asc' ? ka - kb : kb - ka;
  });

  // Підряд ідучі події одного року — одна позначка на осях.
  const groups = [];
  for (const item of sorted) {
    const { owner, shown, foreign, converted } = viewOf(item.event);
    const own = foreign && converted === false;
    const label = yearOf(shown, own ? owner : mainCalendar, own ? makeTimeline(owner) : mainTimeline);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const pad = wide ? 24 : 12;
  const axesW = (n - 1) * AXIS_GAP + 2 * pad;
  // Позиція осі i: від центру колонки осей (широкий макет) або від її лівого краю (вузький).
  const axisX = (i) => (wide ? `calc(50% + ${(i - (n - 1) / 2) * AXIS_GAP}px)` : `${pad + i * AXIS_GAP}px`);
  const columns = wide ? `minmax(0,1fr) ${axesW}px minmax(0,1fr)` : `${axesW}px minmax(0,1fr)`;

  const total = merged.length;
  let index = 0; // наскрізний індекс — чергуємо боки по всій стрічці
  return (
    <section aria-label="Стрічка подій" className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1">
        {axes.map(({ calendar }, i) => (
          <div key={calendar.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            {n > 1 && (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-[0.65rem] font-bold text-text-dim">
                {i + 1}
              </span>
            )}
            <h2 className="font-display text-xl text-accent">{calendar.name}</h2>
            <Link
              to={`/chronology/${calendar.id}${campaignId ? `?campaign_id=${campaignId}` : ''}`}
              className="text-sm text-text-dim hover:text-text"
            >
              Відкрити календар
            </Link>
            {canManage && (
              <Link to={`/chronology/${calendar.id}/build`} className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
                <Settings size={14} /> Структура
              </Link>
            )}
          </div>
        ))}
        <span className="text-xs text-text-dim">
          {filtered ? `${visible.length} з ${total}` : total} {pluralEvents(filtered ? visible.length : total)}
          {n > 1 && ` · дати за календарем «${mainCalendar.name}»`}
        </span>
      </div>

      {total === 0 ? (
        <EmptyState icon="📜" title="Ще немає жодної події">
          {canManage ? 'Додайте першу, щоб почати вести хроніку.' : 'Майстер ще не додав жодної події.'}
        </EmptyState>
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-text-dim">
          За цими фільтрами подій немає.
        </p>
      ) : (
        <div className={`relative ${n > 1 ? 'mt-7' : ''}`}>
          {/* Осі часу — паралельні вертикальні лінії; над кожною — номер календаря. */}
          {axes.map(({ calendar }, i) => (
            <div key={calendar.id} aria-hidden>
              <div
                className="absolute bottom-0 top-0 w-0 border-l border-border"
                style={{ left: axisX(i), borderLeftStyle: i % 2 ? 'dashed' : 'solid' }}
              />
              {n > 1 && (
                <span
                  className="absolute -top-6 z-10 inline-flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-surface text-[0.65rem] font-bold text-text-dim"
                  style={{ left: axisX(i) }}
                  title={calendar.name}
                >
                  {i + 1}
                </span>
              )}
            </div>
          ))}
          {groups.map((group) => (
            <div key={group.label} className="relative">
              <div className={`relative z-10 mb-3 flex ${wide ? 'justify-center' : 'justify-start'}`}>
                <span className="max-w-full rounded-full border border-accent/60 bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
                  {group.label}
                </span>
              </div>
              <ul className="flex flex-col gap-4 pb-6">
                {group.items.map(({ event: e, axis }) => {
                  const left = wide && index++ % 2 === 0;
                  return (
                    <TimelineItem
                      key={e.id} event={e} left={left} wide={wide} axisX={axisX(axis)} columns={columns}
                      calendar={mainCalendar} months={main.months} calendarTimeline={mainTimeline}
                      calendars={calendars} viewOf={viewOf} multi={n > 1}
                      type={eventTypesMap[e.event_type]}
                      locationsById={locationsById} charactersById={charactersById}
                      canManage={canManage} campaignId={campaignId}
                      highlighted={e.id === highlightId} onDelete={onDelete}
                    />
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const pluralEvents = (n) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'подія';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'події';
  return 'подій';
};

// Підпис року на осі: у локальному відліку календаря (з ерами), для неповної
// дати — просто рік; без року — «Без дати».
function yearOf(shown, dateCal, timeline) {
  if (shown.year == null) return 'Без дати';
  if (shown.month_id && shown.day != null) {
    const mi = timeline.months.findIndex((m) => m.id === shown.month_id);
    if (mi !== -1) {
      const loc = timeline.locate(totalDaysSinceEpoch(timeline.months, Number(shown.year), mi, Number(shown.day)));
      if (loc) return timeline.yearText(loc);
    }
  }
  return yearLabel(Number(shown.year), dateCal.current_era_name, dateCal.previous_era_name);
}

function TimelineItem({
  event: e, left, wide, axisX, columns, calendar, months, calendarTimeline, calendars, viewOf, multi, type,
  locationsById, charactersById, canManage, campaignId, highlighted, onDelete,
}) {
  const place = eventPlaceLabel(e, locationsById);
  const { owner, shown, foreign, converted } = viewOf(e);
  // Підпис дати — у основному календарі (якщо вдалося перерахувати), інакше у
  // власному; підказка при наведенні показує ту саму мить в усіх календарях.
  const own = foreign && converted === false;
  const dateMonths = own ? monthsOf(owner) : months;
  const dateCal = own ? owner : calendar;
  const dateTimeline = own ? makeTimeline(owner) : calendarTimeline;
  const equivalents = owner && e.year != null && e.month_id && e.day != null
    ? equivalentDatesText(calendars, owner, { year: Number(e.year), monthId: e.month_id, day: Number(e.day) })
    : '';
  const participants = e.participant_ids || [];
  const qs = campaignId ? `?campaign_id=${campaignId}` : '';

  // Колонка осей посередині (широкий макет) або зліва (вузький); картка — з
  // боку left/справа. Точка стоїть на осі свого календаря, відросток тягнеться
  // від неї до картки.
  const cardCol = wide ? (left ? 'col-start-1' : 'col-start-3') : 'col-start-2';
  const axesCol = wide ? 'col-start-2' : 'col-start-1';
  const connectorStyle = left ? { left: 0, width: axisX } : { left: axisX, right: 0 };

  return (
    <li data-event-id={e.id} className="grid items-start" style={{ gridTemplateColumns: columns }}>
      <div className={`relative row-start-1 self-stretch ${axesCol}`} aria-hidden>
        <span className="absolute top-[1.65rem] h-px bg-border" style={connectorStyle} />
        <span
          className="absolute top-5 z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full ring-4 ring-bg"
          style={{ left: axisX, backgroundColor: e.color }}
        />
      </div>

      <article
        className={`row-start-1 min-w-0 rounded-lg border bg-surface p-3 ${cardCol} ${
          highlighted ? 'border-accent ring-2 ring-accent/50' : 'border-border'
        }`}
        style={{ borderLeft: `4px solid ${e.color}` }}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link to={`/chronology/${e.calendar_id}/events/${e.id}${qs}`} className="text-sm font-semibold text-text hover:text-accent">
                {e.name}
              </Link>
              {type && (
                <span className="rounded-full border px-1.5 py-0.5 text-[0.65rem] font-semibold" style={{ borderColor: e.color, color: e.color }}>
                  {type.label}
                </span>
              )}
              {e.recurrence !== 'none' && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                  {RECURRENCE_LABELS[e.recurrence] || e.recurrence}
                </span>
              )}
              {e.campaign_id && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">Кампанія</span>
              )}
              {(foreign || multi) && (
                <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">{owner.name}</span>
              )}
            </div>
            <p className="mt-1 text-xs text-text-dim">
              <Tooltip text={equivalents}>
                <span className={equivalents ? 'cursor-help underline decoration-dotted underline-offset-2' : undefined}>
                  {eventDateRangeLabel(shown, dateMonths, dateCal.current_era_name, dateCal.previous_era_name, dateTimeline)}
                </span>
              </Tooltip>
            </p>
            {place && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-text-dim"><MapPin size={11} /> {place}</p>
            )}
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Link
                to={`/chronology/${e.calendar_id}/events/${e.id}/edit${qs}`}
                aria-label="Редагувати" title="Редагувати"
                className="rounded p-1 text-text-dim hover:bg-surface-hover hover:text-text"
              >
                <Pencil size={15} />
              </Link>
              <button type="button" onClick={() => onDelete(e)} aria-label="Видалити" title="Видалити" className="rounded p-1 text-danger hover:bg-surface-hover">
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </div>

        {e.description && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-text-dim">{htmlToPreviewText(e.description)}</p>
        )}
        {participants.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {participants.slice(0, MAX_PARTICIPANT_CHIPS).map((pid) => (
              <span key={pid} className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                {charactersById.get(pid)?.label || 'Невідомий персонаж'}
              </span>
            ))}
            {participants.length > MAX_PARTICIPANT_CHIPS && (
              <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                +{participants.length - MAX_PARTICIPANT_CHIPS}
              </span>
            )}
          </div>
        )}
      </article>
    </li>
  );
}
