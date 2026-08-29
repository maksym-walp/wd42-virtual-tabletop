import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Settings, Plus, Trash2, Pencil, ExternalLink, ArrowUpDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import mapsApi from '../api/maps';
import compendiumApi from '../api/compendium';
import { eventDateRangeLabel, eventPlaceLabel, eventSortKey } from '../utils/chronologyEvent';
import CatalogTabs from '../components/CatalogTabs';
import EventForm from '../components/chronology/EventForm';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import Sheet from '../components/ui/Sheet';
import { inputClass } from '../components/ui/Field';

const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };
const GROUP_NONE = 'none';
const GROUP_LOCATION = 'location';
const GROUP_CHARACTER = 'character';

// The "Події" sub-tab of a calendar (see ChronologyView.jsx for the "Сітка"
// sub-tab it pairs with, via the same CatalogTabs bar) — a flat, sortable,
// groupable list of every event visible to the viewer, since the grid only
// ever surfaces one day's events at a time.
export default function ChronologyEvents() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign_id') || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';

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
    chronologyApi.listEvents(id, campaignId),
    mapsApi.listLocations(),
    Promise.all([compendiumApi.listEntries('npc'), compendiumApi.listEntries('creature')]),
  ]).then(([cal, monthsList, eventsList, locationsList, [npcs, creatures]]) => {
    setCalendar(cal);
    setMonths(monthsList);
    setEvents(eventsList);
    setLocations(locationsList);
    setCharacterOptions([
      ...npcs.map((n) => ({ key: n.id, label: `${n.name} (НІП)` })),
      ...creatures.map((c) => ({ key: c.id, label: `${c.name} (Істота)` })),
    ]);
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    load()
      .catch(() => { if (alive) navigate('/chronology'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, campaignId]);

  const locationsById = new Map(locations.map((l) => [l.id, l]));
  const charactersById = new Map(characterOptions.map((c) => [c.key, c.label]));

  const handleDelete = async (event) => {
    if (!confirm(`Видалити подію «${event.name}»?`)) return;
    await chronologyApi.removeEvent(id, event.id);
    load();
  };

  const openInNewTab = (event) => {
    if (event.location_id) {
      window.open(`/locations/${event.location_id}`, '_blank', 'noopener');
      return;
    }
    if (event.year != null && event.month_id && event.day != null) {
      const params = new URLSearchParams({ year: event.year, month_id: event.month_id, day: event.day });
      if (campaignId) params.set('campaign_id', campaignId);
      window.open(`/chronology/${id}?${params}`, '_blank', 'noopener');
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const sorted = [...events].sort((a, b) => {
    const diff = eventSortKey(a, months) - eventSortKey(b, months);
    return sortDir === 'asc' ? diff : -diff;
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
        {canManage && (
          <Button size="sm" className="ml-auto" onClick={() => setFormTarget('new')}>
            <Plus size={14} /> Додати подію
          </Button>
        )}
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
                events={groupEvents} months={months} calendar={calendar} locationsById={locationsById}
                charactersById={charactersById} canManage={canManage}
                onOpen={openInNewTab} onEdit={setFormTarget} onDelete={handleDelete}
              />
            </div>
          ))}
        </div>
      ) : (
        <EventList
          events={sorted} months={months} calendar={calendar} locationsById={locationsById}
          charactersById={charactersById} canManage={canManage}
          onOpen={openInNewTab} onEdit={setFormTarget} onDelete={handleDelete}
        />
      )}

      {formTarget && (
        <Sheet open onClose={() => setFormTarget(null)} title={formTarget === 'new' ? 'Нова подія' : 'Редагувати подію'}>
          <EventForm
            calendarId={id}
            campaignId={campaignId}
            months={months}
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

function EventList({ events, months, calendar, locationsById, charactersById, canManage, onOpen, onEdit, onDelete }) {
  return (
    <ul className="flex flex-col gap-2">
      {events.map((e) => {
        const place = eventPlaceLabel(e, locationsById);
        const canOpen = Boolean(e.location_id) || (e.year != null && e.month_id && e.day != null);
        return (
          <li key={e.id} className="flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3">
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
              <p className="mt-1 text-xs text-text-dim">
                {eventDateRangeLabel(e, months, calendar.current_era_name, calendar.previous_era_name)}
                {place && ` · ${place}`}
              </p>
              {e.description && <p className="mt-1 text-xs text-text-dim">{e.description}</p>}
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
