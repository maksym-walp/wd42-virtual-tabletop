import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Settings, Plus, Trash2, Pencil, ExternalLink, ArrowUpDown, Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import mapsApi from '../api/maps';
import npcsApi from '../api/npcs';
import bestiaryApi from '../api/bestiary';
import characterApi from '../api/characterSheet';
import { eventDateRangeLabel, eventPlaceLabel, defaultCalendarId } from '../utils/chronologyEvent';
import {
  eventInCalendar, eventWorldSortKey, equivalentDatesText, buildEventsExport, monthsOf,
} from '../utils/chronologySync';
import { makeTimeline } from '../utils/chronologyEras';
import { htmlToPreviewText } from '../utils/richText';
import Tooltip from '../components/ui/Tooltip';
import ChronologyTabs from '../components/chronology/ChronologyTabs';
import EventForm from '../components/chronology/EventForm';
import SmartTextReader from '../components/SmartTextReader';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';

const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };
const GROUP_NONE = 'none';
const GROUP_LOCATION = 'location';
const GROUP_CHARACTER = 'character';

// Вкладка «Події» сервісу «Хронологія» (поряд із каталогом календарів, див.
// ChronologyTabs) — плоский відсортований список усіх подій одного календаря,
// які бачить глядач (сітка показує події лише одного дня за раз). Календар
// обирається селектом: ?calendar=<id>, інакше календар за замовчуванням, інакше
// перший зі списку. Старі посилання /chronology/:id/events ведуть сюди через
// редірект у App.jsx.
export default function ChronologyEvents() {
  const [searchParams, setSearchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign_id') || null;
  // ?event=<id> — посилання на конкретну подію (внутрішні посилання в текстах):
  // прокручуємо до неї й підсвічуємо.
  const highlightId = searchParams.get('event') || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';

  const [calendars, setCalendars] = useState(null); // null — ще вантажиться
  const id = searchParams.get('calendar')
    || (calendars ? (defaultCalendarId(calendars) || calendars[0]?.id || null) : null);

  const [calendar, setCalendar] = useState(null);
  const [months, setMonths] = useState([]);
  const [events, setEvents] = useState([]);
  const [locations, setLocations] = useState([]);
  const [characterOptions, setCharacterOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [sortDir, setSortDir] = useState('asc');
  const [groupBy, setGroupBy] = useState(GROUP_NONE);
  const [formTarget, setFormTarget] = useState(null); // null | 'new' | an event object being edited

  const load = () => Promise.all([
    chronologyApi.getOne(id),
    chronologyApi.listMonths(id),
    chronologyApi.listEvents(id, campaignId, { synced: true }),
    mapsApi.listLocations(),
    // Персонажі гравців теж можуть бути учасниками — їхні події видно на
    // вкладці «Наратив» листа персонажа. Список — власні та прикріплені до
    // кампаній, де користувач майстер (адмін бачить усіх).
    Promise.all([
      npcsApi.list(),
      bestiaryApi.list(),
      characterApi.list({ includeGmCampaigns: true }).catch(() => []),
    ]),
  ]).then(([cal, monthsList, eventsList, locationsList, [npcs, creatures, characters]]) => {
    setCalendar(cal);
    setMonths(monthsList);
    setEvents(eventsList);
    setLocations(locationsList);
    setCharacterOptions([
      ...npcs.map((n) => ({ key: n.id, label: `${n.name} (НІП)` })),
      ...creatures.map((c) => ({ key: c.id, label: `${c.name} (Істота)` })),
      ...characters.map((c) => ({ key: c.id, label: `${c.name} (Персонаж)` })),
    ]);
  });

  useEffect(() => {
    chronologyApi.list()
      .then(setCalendars)
      .catch(() => navigate('/chronology'));
  }, []);

  useEffect(() => {
    if (calendars === null) return undefined;
    if (!id) { setLoading(false); return undefined; }
    let alive = true;
    setLoading(true);
    load()
      .catch(() => { if (alive) navigate('/chronology'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, campaignId, calendars]);

  const selectCalendar = (calendarId) => {
    const next = new URLSearchParams(searchParams);
    next.set('calendar', calendarId);
    next.delete('event');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (loading || !highlightId) return;
    document.getElementById(`event-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [loading, highlightId]);

  const locationsById = new Map(locations.map((l) => [l.id, l]));
  const charactersById = new Map(characterOptions.map((c) => [c.key, c.label]));

  const handleDelete = async (event) => {
    if (!confirm(`Видалити подію «${event.name}»?`)) return;
    await chronologyApi.removeEvent(event.calendar_id || id, event.id);
    load();
  };

  const calendarsById = new Map((calendars || []).map((c) => [c.id, c]));

  // Подія іншого (синхронізованого) календаря: показуємо її в датах вибраного,
  // а якщо перерахувати не вдалося (неповна дата) — у власних.
  const viewOf = (e) => {
    const owner = calendarsById.get(e.calendar_id);
    if (!owner || !calendar || owner.id === calendar.id) return { owner: calendar, shown: e, foreign: false };
    const shown = eventInCalendar(e, owner, calendar);
    return { owner, shown: shown || e, foreign: true, converted: Boolean(shown) };
  };

  // Куди веде «Відкрити»: локація, інакше день у сітці того календаря, в чиїх
  // датах подію зараз показано.
  const gridTarget = (e) => {
    const { owner, shown, converted } = viewOf(e);
    if (shown.year == null || !shown.month_id || shown.day == null) return null;
    return { calendarId: converted === false ? owner.id : calendar.id, year: shown.year, month_id: shown.month_id, day: shown.day };
  };

  const openInNewTab = (event) => {
    if (event.location_id) {
      window.open(`/locations/${event.location_id}`, '_blank', 'noopener');
      return;
    }
    const target = gridTarget(event);
    if (target) {
      const params = new URLSearchParams({ year: target.year, month_id: target.month_id, day: target.day });
      if (campaignId) params.set('campaign_id', campaignId);
      window.open(`/chronology/${target.calendarId}?${params}`, '_blank', 'noopener');
    }
  };

  // Експорт подій усіх календарів з прив'язкою до календаря за замовчуванням.
  const handleExport = async () => {
    try {
      const perCalendar = await Promise.all(calendars.map((c) => chronologyApi.listEvents(c.id, campaignId)));
      const data = buildEventsExport({
        calendars,
        events: perCalendar.flat(),
        locationsById,
        charactersById,
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

  if (calendars === null || (id && loading)) {
    return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  }

  if (!id || !calendar) {
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

  // Сортування на світовій осі, а не за датою власного календаря: у списку
  // змішані події різних синхронізованих календарів.
  const calendarTimeline = makeTimeline({ ...calendar, months });

  const sorted = [...events].sort((a, b) => {
    const ka = eventWorldSortKey(a, calendarsById);
    const kb = eventWorldSortKey(b, calendarsById);
    if (ka === kb) return 0; // Infinity - Infinity = NaN
    if (ka === Infinity) return 1;
    if (kb === Infinity) return -1;
    return sortDir === 'asc' ? ka - kb : kb - ka;
  });

  // Grouping is tag-style, not a partition: an event with two participants
  // shows up under both character groups (and one under "location" always
  // lands in exactly one bucket, since a place is at most one location or
  // region).
  let groups = null;
  if (groupBy === GROUP_LOCATION) {
    groups = new Map();
    for (const e of sorted) {
      const key = eventPlaceLabel(e, locationsById) || 'Без місця';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
  } else if (groupBy === GROUP_CHARACTER) {
    groups = new Map();
    for (const e of sorted) {
      if (!e.participant_ids || e.participant_ids.length === 0) {
        if (!groups.has('Без персонажів')) groups.set('Без персонажів', []);
        groups.get('Без персонажів').push(e);
        continue;
      }
      for (const pid of e.participant_ids) {
        const key = charactersById.get(pid) || 'Невідомий персонаж';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(e);
      }
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title="🗓️ Хронологія" />
      <ChronologyTabs />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className={`${inputClass} w-auto min-w-0 max-w-full`}
          value={id}
          onChange={(e) => selectCalendar(e.target.value)}
          aria-label="Календар"
        >
          {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_default ? ' ★' : ''}</option>)}
        </select>
        <Link to={`/chronology/${id}${campaignId ? `?campaign_id=${campaignId}` : ''}`} className="text-sm text-text-dim hover:text-text">
          Відкрити календар
        </Link>
        {canManage && (
          <Link to={`/chronology/${id}/build`} className="inline-flex items-center gap-1.5 text-sm text-text-dim hover:text-text">
            <Settings size={15} /> Редагувати структуру
          </Link>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-text-dim hover:bg-surface-hover"
        >
          <ArrowUpDown size={13} /> Хронологічно {sortDir === 'asc' ? '↑' : '↓'}
        </button>
        <select className={`${inputClass} w-auto`} value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
          <option value={GROUP_NONE}>Без групування</option>
          <option value={GROUP_LOCATION}>Групувати за локацією</option>
          <option value={GROUP_CHARACTER}>Групувати за персонажем</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleExport}>
            <Download size={14} /> Експорт JSON
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setFormTarget('new')}>
              <Plus size={14} /> Додати подію
            </Button>
          )}
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState icon="📜" title="Ще немає жодної події">
          {canManage ? 'Додайте першу, щоб почати вести хроніку.' : 'Майстер ще не додав жодної події.'}
        </EmptyState>
      ) : groups ? (
        <div className="flex flex-col gap-6">
          {[...groups.entries()].map(([groupLabel, groupEvents]) => (
            <div key={groupLabel}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-dim">{groupLabel}</h2>
              <EventList
                events={groupEvents} months={months} calendar={calendar} calendarTimeline={calendarTimeline} calendars={calendars} viewOf={viewOf} gridTarget={gridTarget} locationsById={locationsById}
                charactersById={charactersById} canManage={canManage} highlightId={highlightId}
                onOpen={openInNewTab} onEdit={setFormTarget} onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      ) : (
        <EventList
          events={sorted} months={months} calendar={calendar} calendarTimeline={calendarTimeline} calendars={calendars} viewOf={viewOf} gridTarget={gridTarget} locationsById={locationsById}
          charactersById={charactersById} canManage={canManage} highlightId={highlightId}
          onOpen={openInNewTab} onEdit={setFormTarget} onDelete={handleDelete}
        />
      )}

      {formTarget && (
        <Sheet open onClose={() => setFormTarget(null)} title={formTarget === 'new' ? 'Нова подія' : 'Редагувати подію'}>
          <EventForm
            calendarId={formTarget === 'new' ? id : formTarget.calendar_id}
            calendars={calendars}
            campaignId={campaignId}
            locations={locations}
            characterOptions={characterOptions}
            event={formTarget === 'new' ? undefined : formTarget}
            onCancel={() => setFormTarget(null)}
            onSaved={() => { setFormTarget(null); load(); }}
          />
        </Sheet>
      )}
    </div>
  );
}

function EventList({ events, months, calendar, calendarTimeline, calendars, viewOf, gridTarget, locationsById, charactersById, canManage, highlightId, onOpen, onEdit, onDelete }) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => {
        const place = eventPlaceLabel(e, locationsById);
        const canOpen = Boolean(e.location_id) || Boolean(gridTarget(e));
        const { owner, shown, foreign, converted } = viewOf(e);
        // Підпис дати — у вибраному календарі (якщо вдалося перерахувати), інакше
        // у власному; підказка при наведенні показує ту саму мить в усіх календарях.
        const dateMonths = foreign && converted === false ? monthsOf(owner) : months;
        const dateCal = foreign && converted === false ? owner : calendar;
        const dateTimeline = foreign && converted === false ? makeTimeline(owner) : calendarTimeline;
        const equivalents = owner && e.year != null && e.month_id && e.day != null
          ? equivalentDatesText(calendars, owner, { year: Number(e.year), monthId: e.month_id, day: Number(e.day) })
          : '';
        return (
          <li
            key={e.id}
            id={`event-${e.id}`}
            className={`flex items-start gap-2.5 rounded-lg border bg-surface p-3 ${e.id === highlightId ? 'border-accent ring-2 ring-accent/50' : 'border-border'}`}
          >
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
                {foreign && (
                  <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">{owner.name}</span>
                )}
              </div>
              <p className="mt-1 text-xs text-text-dim">
                <Tooltip text={equivalents}>
                  <span className={equivalents ? 'cursor-help underline decoration-dotted underline-offset-2' : undefined}>
                    {eventDateRangeLabel(shown, dateMonths, dateCal.current_era_name, dateCal.previous_era_name, dateTimeline)}
                  </span>
                </Tooltip>
                {place && ` · ${place}`}
              </p>
              {e.description && <SmartTextReader text={e.description} className="mt-1 text-xs text-text-dim" />}
              {e.participant_ids?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {e.participant_ids.map((pid) => (
                    <span key={pid} className="rounded-full border border-border px-1.5 py-0.5 text-[0.65rem] text-text-dim">
                      {charactersById.get(pid) || 'Невідомий персонаж'}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onOpen(e)}
                disabled={!canOpen}
                aria-label="Відкрити"
                title={e.location_id ? 'Відкрити локацію' : 'Відкрити дату в календарі'}
                className="rounded p-1 text-text-dim hover:bg-surface-hover hover:text-accent disabled:opacity-30"
              >
                <ExternalLink size={15} />
              </button>
              {canManage && (
                <>
                  <button type="button" onClick={() => onEdit(e)} aria-label="Редагувати" className="rounded p-1 text-text-dim hover:bg-surface-hover hover:text-text">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => onDelete(e)} aria-label="Видалити" className="rounded p-1 text-danger hover:bg-surface-hover">
                    <Trash2 size={15} />
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
