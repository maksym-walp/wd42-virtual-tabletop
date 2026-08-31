import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import mapsApi from '../api/maps';
import { resolveLocationVersion } from '../constants/maps';
import Badge from '../components/ui/Badge';
import MarkerIcon from '../components/map/MarkerIcon';
import SmartTextReader from '../components/SmartTextReader';

// Standalone, read-only location page — locations previously had no URL of
// their own (only reachable via a map's ?location= query param, see
// MapView.jsx/LocationDrawer.jsx). This is what a chronology event's
// "Відкрити" link opens in a new tab when it has a location_id, so it needs
// to work without any map context at all. Shows the base/latest version
// (no map "current year" to resolve a dated version against here).
export default function LocationDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isGm = user?.role === 'admin' || user?.role === 'game_master';

  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    mapsApi.getLocation(id)
      .then((l) => { if (alive) setLocation(l); })
      .catch(() => { if (alive) setError('Не вдалось завантажити локацію — можливо, вона недоступна вам'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  const version = resolveLocationVersion(location?.versions, null);
  const displayName = version?.name || location?.name || 'Локація';
  const displayIcon = version?.marker_icon ?? location?.marker_icon;
  const displayTypes = (version && version.types != null) ? version.types : (location?.types || []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/maps/locations" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Локації
      </Link>

      {error && <p className="text-sm text-danger">{error}</p>}

      {location && (
        <div className="overflow-hidden rounded-lg border border-border bg-surface">
          {version?.image_url && (
            <img src={version.image_url} alt="" loading="lazy" className="h-56 w-full object-cover" />
          )}
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl text-text">{displayName}</h1>
              <Badge className="inline-flex items-center gap-1.5 border border-border text-text-muted">
                <MarkerIcon icon={displayIcon} size={14} />
                {displayTypes.length ? displayTypes.join(' · ') : 'Локація'}
              </Badge>
            </div>

            {version?.description ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                <SmartTextReader text={version.description} />
              </div>
            ) : (
              <p className="text-sm text-text-dim">Опис відсутній.</p>
            )}

            {isGm && version?.gm_note && (
              <div className="rounded-lg border border-gold/50 bg-gold/10 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold">Нотатка майстра</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{version.gm_note}</p>
              </div>
            )}

            {(location.versions || []).filter((v) => v.start_year != null).length > 0 && (
              <p className="flex items-center gap-1 text-xs text-text-dim">
                <Clock size={12} /> Показано останню відому версію лору цієї локації.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
