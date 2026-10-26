import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import chronologyApi from '../api/chronology';
import { useAuth } from '../context/AuthContext';
import useEventLookups from '../hooks/useEventLookups';
import { defaultCalendarId } from '../utils/chronologyEvent';
import EventForm from '../components/chronology/EventForm';

// Сторінка створення/редагування події хронології:
//   /chronology/events/new?calendar=&campaign_id=&year=&month_id=&day=
//   /chronology/:id/events/:eventId/edit
// Дату (year/month_id/day) передає календарна сітка, коли подію додають із дня.
export default function ChronologyEventForm() {
  const { id: routeCalendarId, eventId } = useParams();
  const isEdit = Boolean(eventId);
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaign_id') || null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';
  const { locations, characterOptions, loading: lookupsLoading } = useEventLookups();

  const [calendars, setCalendars] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManage) { navigate('/chronology/events', { replace: true }); return undefined; }
    let alive = true;
    setLoading(true);
    Promise.all([
      chronologyApi.list(),
      isEdit ? chronologyApi.getEvent(routeCalendarId, eventId, campaignId) : Promise.resolve(null),
    ])
      .then(([list, ev]) => { if (alive) { setCalendars(list); setEvent(ev); } })
      .catch(() => { if (alive) navigate('/chronology/events', { replace: true }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [routeCalendarId, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || lookupsLoading || !calendars) {
    return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  }

  const calendarId = isEdit
    ? event.calendar_id
    : (searchParams.get('calendar') || defaultCalendarId(calendars) || calendars[0]?.id);

  if (!calendarId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-text-dim">
        Події належать календарям — спершу створіть календар у вкладці «Календарі».
      </div>
    );
  }

  const qYear = searchParams.get('year');
  const qMonth = searchParams.get('month_id');
  const qDay = searchParams.get('day');
  const initialDate = !isEdit && qYear && qMonth && qDay
    ? { year: Number(qYear), monthId: qMonth, day: Number(qDay) }
    : undefined;

  const backTo = isEdit
    ? `/chronology/${event.calendar_id}/events/${event.id}${campaignId ? `?campaign_id=${campaignId}` : ''}`
    : '/chronology/events';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to={backTo} className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> {isEdit ? event.name : 'Події'}
      </Link>
      <h1 className="mb-4 font-display text-2xl text-accent sm:text-3xl">
        {isEdit ? 'Редагувати подію' : 'Нова подія'}
      </h1>

      <EventForm
        calendarId={calendarId}
        calendars={calendars}
        campaignId={isEdit ? (event.campaign_id || campaignId) : campaignId}
        locations={locations}
        characterOptions={characterOptions}
        event={event || undefined}
        initialDate={initialDate}
        onCancel={() => navigate(backTo)}
        onSaved={(saved) => navigate(
          `/chronology/${saved?.calendar_id || calendarId}/events/${saved?.id || eventId}${campaignId ? `?campaign_id=${campaignId}` : ''}`,
          { replace: true },
        )}
      />
    </div>
  );
}
