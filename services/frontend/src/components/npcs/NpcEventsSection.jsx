import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import chronologyApi from '../../api/chronology';
import { useAuth } from '../../context/AuthContext';
import { eventDateRangeLabel } from '../../utils/chronologyEvent';
import { inputClass } from '../ui/Field';
import Button from '../ui/Button';

// "Події" on an NPC's page: chronology events this NPC took part in. The
// participant list itself lives in the chronology service
// (calendar_event_participants) — the same list the event form edits — so
// adding the NPC here makes it show up as a participant there and vice versa.
// Managing events is a chronology-manager action (admin/game_master).
export default function NpcEventsSection({ npcId, Section }) {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';
  const [events, setEvents] = useState([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const reload = () => chronologyApi.listEventsByParticipant(npcId).then(setEvents).catch(() => setEvents([]));

  useEffect(() => { reload(); }, [npcId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (action) => {
    setError('');
    try {
      await action();
      await reload();
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалося зберегти');
      return false;
    }
  };

  if (!events.length && !canManage) return null;

  return (
    <Section title="Події">
      {events.length === 0 && !adding && <p className="text-sm text-text-dim">Не брав участі в жодній події</p>}
      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <li key={event.id} className="flex items-center gap-3 rounded-md border border-border bg-bg px-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: event.color }} />
            <div className="min-w-0 flex-1">
              <Link to={`/chronology/${event.calendar_id}/events`} className="text-sm font-semibold text-text hover:text-accent">
                {event.name}
              </Link>
              <p className="text-xs text-text-dim">{participantEventDate(event)} · {event.calendar_name}</p>
            </div>
            {canManage && (
              <button
                type="button" className="flex h-8 w-8 items-center justify-center text-sm text-danger" title="Прибрати з учасників"
                onClick={() => {
                  if (confirm(`Прибрати НІПа з учасників події «${event.name}»?`)) {
                    run(() => chronologyApi.removeEventParticipant(event.calendar_id, event.id, npcId));
                  }
                }}
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        adding ? (
          <AddEventForm
            takenIds={new Set(events.map((e) => e.id))}
            onCancel={() => setAdding(false)}
            onSubmit={async (calendarId, eventId) => {
              if (await run(() => chronologyApi.addEventParticipant(calendarId, eventId, npcId))) setAdding(false);
            }}
          />
        ) : (
          <button type="button" className="mt-3 text-sm text-accent" onClick={() => setAdding(true)}>+ Додати подію</button>
        )
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Section>
  );
}

// The by-participant endpoint carries month names instead of a calendar's
// full month list — enough for eventDateRangeLabel, which only looks months
// up by id.
function participantEventDate(event) {
  const months = [
    { id: event.month_id, name: event.month_name },
    { id: event.end_month_id, name: event.end_month_name },
  ].filter((m) => m.id);
  return eventDateRangeLabel(event, months, event.current_era_name, event.previous_era_name);
}

function AddEventForm({ takenIds, onSubmit, onCancel }) {
  const [calendars, setCalendars] = useState([]);
  const [calendarId, setCalendarId] = useState('');
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [months, setMonths] = useState([]);
  const [eventId, setEventId] = useState('');

  useEffect(() => { chronologyApi.list().then(setCalendars).catch(() => {}); }, []);

  useEffect(() => {
    setEventId('');
    if (!calendarId) { setCalendarEvents([]); setMonths([]); return; }
    chronologyApi.listEvents(calendarId).then(setCalendarEvents).catch(() => setCalendarEvents([]));
    chronologyApi.listMonths(calendarId).then(setMonths).catch(() => setMonths([]));
  }, [calendarId]);

  const calendar = calendars.find((c) => c.id === calendarId);
  const available = calendarEvents.filter((e) => !takenIds.has(e.id));

  const submit = (e) => {
    e.preventDefault();
    if (calendarId && eventId) onSubmit(calendarId, eventId);
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-2 rounded-md border border-border bg-bg p-3">
      <select className={inputClass} value={calendarId} onChange={(e) => setCalendarId(e.target.value)} required>
        <option value="">Оберіть календар</option>
        {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {calendarId && (
        <select className={inputClass} value={eventId} onChange={(e) => setEventId(e.target.value)} required>
          <option value="">{available.length ? 'Оберіть подію' : 'Немає доступних подій'}</option>
          {available.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name} — {eventDateRangeLabel(ev, months, calendar?.current_era_name, calendar?.previous_era_name)}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!eventId}>Додати</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Скасувати</Button>
      </div>
    </form>
  );
}
