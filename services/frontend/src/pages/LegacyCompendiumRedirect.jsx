import { useEffect } from 'react';
import { useParams, useNavigate, useLocation, Navigate } from 'react-router-dom';
import npcsApi from '../api/npcs';
import bestiaryApi from '../api/bestiary';

// Old links to /compendium/entries/:id (before НІПи and Бестіарій became
// their own services) — ids were kept by the split, so the entry is either
// an NPC or a creature now; try both and land on whichever exists.
export function LegacyEntryRedirect({ edit = false }) {
  const { id } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const suffix = edit ? '/edit' : '';
    npcsApi.get(id)
      .then(() => navigate(`/npcs/${id}${suffix}`, { replace: true }))
      .catch(() => bestiaryApi.get(id)
        .then(() => navigate(`/bestiary/${id}${suffix}`, { replace: true }))
        .catch(() => navigate('/npcs', { replace: true })));
  }, [id, edit]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
}

// /compendium/factions/* -> /npcs/factions/* (same ids, same sub-path).
export function LegacyFactionRedirect() {
  const { '*': rest } = useParams();
  const navigate = useNavigate();
  useEffect(() => { navigate(`/npcs/factions${rest ? `/${rest}` : ''}`, { replace: true }); }, [rest]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// /chronology/:id/events -> /chronology/events?calendar=:id — «Події» тепер
// окрема вкладка сервісу, а не підвкладка календаря; ?campaign_id= із
// внутрішніх посилань зберігається, а ?event= веде на сторінку події.
export function LegacyCalendarEventsRedirect() {
  const { id } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  // ?event=<id> — посилання на конкретну подію: тепер вона має власну сторінку.
  const eventId = params.get('event');
  if (eventId) {
    params.delete('event');
    const qs = params.toString();
    return <Navigate to={`/chronology/${id}/events/${eventId}${qs ? `?${qs}` : ''}`} replace />;
  }
  params.set('calendar', id);
  return <Navigate to={`/chronology/events?${params}`} replace />;
}
