import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from 'lucide-react';
import chronologyApi from '../api/chronology';
import { useAuth } from '../context/AuthContext';
import useEventLookups from '../hooks/useEventLookups';
import useEventTypes from '../hooks/useEventTypes';
import { eventDateRangeLabel, eventPlaceLabel } from '../utils/chronologyEvent';
import { equivalentDates } from '../utils/chronologySync';
import { makeTimeline } from '../utils/chronologyEras';
import Button from '../components/ui/Button';
import ShareButton from '../components/ShareButton';
import SmartTextReader from '../components/SmartTextReader';

const RECURRENCE_LABELS = { none: 'Одноразова', yearly: 'Щорічна', monthly: 'Щомісячна', weekly: 'Щотижнева' };

// Сторінка однієї події хронології: /chronology/:id/events/:eventId — замість
// вікна поверх списку. Ліворуч — назва, тип, дата, місце, учасники; праворуч —
// опис і дії. Той самий URL відкривають внутрішні посилання на подію в текстах.
export default function ChronologyEventView() {
  const { id: calendarId, eventId } = useParams();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign_id') || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';
  const { locationsById, charactersById } = useEventLookups();
  const { eventTypesMap } = useEventTypes();

  const [event, setEvent] = useState(null);
  const [calendar, setCalendar] = useState(null);
  const [months, setMonths] = useState([]);
  const [calendars, setCalendars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      chronologyApi.getEvent(calendarId, eventId, campaignId),
      chronologyApi.getOne(calendarId),
      chronologyApi.listMonths(calendarId),
      chronologyApi.list().catch(() => []),
    ])
      .then(([ev, cal, monthsList, list]) => {
        if (!alive) return;
        setEvent(ev); setCalendar(cal); setMonths(monthsList); setCalendars(list);
      })
      .catch(() => { if (alive) navigate('/chronology/events', { replace: true }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [calendarId, eventId, campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (!confirm(`Видалити подію «${event.name}»?`)) return;
    setDeleting(true);
    try {
      await chronologyApi.removeEvent(calendarId, eventId);
      navigate(`/chronology/events?calendar=${calendarId}`, { replace: true });
    } catch {
      setDeleting(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (!event || !calendar) return null;

  const type = eventTypesMap[event.event_type];
  const timeline = makeTimeline({ ...calendar, months });
  const owner = calendars.find((c) => c.id === calendar.id) || calendar;
  const dated = event.year != null && event.month_id && event.day != null;
  const equivalents = dated
    ? equivalentDates(calendars, owner, { year: Number(event.year), monthId: event.month_id, day: Number(event.day) })
    : [];
  const place = eventPlaceLabel(event, locationsById);
  const participants = (event.participant_ids || []).map((pid) => ({ id: pid, option: charactersById.get(pid) }));
  const qs = campaignId ? `?campaign_id=${campaignId}` : '';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={`/chronology/events?calendar=${calendarId}${campaignId ? `&campaign_id=${campaignId}` : ''}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Події
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6">
        <div
          className="overflow-hidden rounded-lg border border-border bg-surface lg:sticky lg:top-4 lg:self-start"
          style={{ borderTop: `3px solid ${event.color}` }}
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-surface-hover px-4 py-2.5">
            <span
              className="rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide"
              style={{ borderColor: event.color, color: event.color }}
            >
              {type?.label || 'Подія'}
            </span>
            <span className="text-xs text-text-dim">{RECURRENCE_LABELS[event.recurrence] || event.recurrence}</span>
            {event.campaign_id && <span className="text-xs italic text-text-dim">кампанії</span>}
            <span className="ml-auto text-xs italic text-text-dim">{event.is_public ? 'публічна' : 'приховано'}</span>
          </div>

          <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
            <h1 className="font-display text-3xl text-accent">{event.name}</h1>
            <ShareButton className="mt-1" />
          </div>

          <dl className="flex flex-col gap-3 border-t border-border px-5 py-4 text-sm">
            <Row label="Дата">
              <span className="font-semibold text-text">
                {eventDateRangeLabel(event, months, calendar.current_era_name, calendar.previous_era_name, timeline)}
              </span>
              <span className="text-text-dim"> ({calendar.name})</span>
            </Row>
            {equivalents.length > 0 && (
              <Row label="В інших календарях">
                <ul className="flex flex-col gap-0.5">
                  {equivalents.map((q) => (
                    <li key={q.calendar.id}><span className="text-text">{q.label}</span> <span className="text-text-dim">— {q.calendar.name}</span></li>
                  ))}
                </ul>
              </Row>
            )}
            {place && (
              <Row label="Місце">
                <span className="inline-flex items-center gap-1 text-text">
                  <MapPin size={13} className="text-text-dim" />
                  {event.location_id
                    ? <Link to={`/locations/${event.location_id}`} className="text-accent hover:underline">{place}</Link>
                    : place}
                </span>
              </Row>
            )}
            {participants.length > 0 && (
              <Row label="Учасники">
                <div className="flex flex-wrap gap-1.5">
                  {participants.map(({ id, option }) => (option?.href ? (
                    <Link key={id} to={option.href} className="rounded-full border border-border px-2 py-0.5 text-xs text-accent hover:bg-surface-hover">
                      {option.label}
                    </Link>
                  ) : (
                    <span key={id} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-dim">
                      {option?.label || 'Невідомий персонаж'}
                    </span>
                  )))}
                </div>
              </Row>
            )}
          </dl>
        </div>

        <div className="self-start overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border bg-surface-hover px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-text-dim">
            Опис
          </div>
          <div className="px-5 py-4">
            {event.description
              ? <SmartTextReader text={event.description} className="text-[0.95rem] leading-relaxed text-text" />
              : <p className="text-sm italic text-text-dim">Опису ще немає.</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-4">
            {dated && (
              <Button
                variant="ghost" size="sm"
                to={`/chronology/${calendar.id}?year=${event.year}&month_id=${event.month_id}&day=${event.day}${campaignId ? `&campaign_id=${campaignId}` : ''}`}
              >
                <CalendarDays size={14} /> У календарі
              </Button>
            )}
            {event.location_id && (
              <Button variant="ghost" size="sm" to={`/locations/${event.location_id}`}>
                <ExternalLink size={14} /> Локація
              </Button>
            )}
            {canManage && (
              <>
                <Button variant="ghost" to={`/chronology/${calendar.id}/events/${event.id}/edit${qs}`}>Редагувати</Button>
                <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? 'Видалення...' : 'Видалити'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-text-dim">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
