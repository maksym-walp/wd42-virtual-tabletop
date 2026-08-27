import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, ImageOverlay, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { levelThreshold, isIconUrl, DEFAULT_MARKER_LEVEL } from '../../constants/maps';

// Flat images use L.CRS.Simple: [lat, lng] = [y, x], latitude grows upward.
// Pins are stored normalized (0..1), y measured from the TOP, so we flip y.
function toLatLng(pin, dims) {
  return [dims.h * (1 - pin.y_coordinate), dims.w * pin.x_coordinate];
}

// The marker icon is either an uploaded image URL or an emoji. Both are
// user-supplied, so escape before injecting into the divIcon HTML. Cached by value.
const ICON_CACHE = new Map();
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function buildIcon(iconValue) {
  const value = iconValue || '📍';
  if (!ICON_CACHE.has(value)) {
    const inner = isIconUrl(value)
      ? `<img src="${esc(value)}" class="walp-pin__img" alt=""/>`
      : `<span class="walp-pin__glyph">${esc(value)}</span>`;
    ICON_CACHE.set(value, L.divIcon({ className: 'walp-pin', html: inner, iconSize: [32, 32], iconAnchor: [16, 30] }));
  }
  return ICON_CACHE.get(value);
}

// Fits the image and pins the zoom scale so the fully-zoomed-out view is the
// map's minimum zoom — the basis for the 0..1 zoom fraction used by levels.
//
// MapContainer's `bounds`/`maxBounds` props only seed the Leaflet map at
// construction — react-leaflet v4 never re-applies them on prop change, so
// switching to a lens with different pixel dimensions left the OLD image's
// maxBounds in effect: the view would re-fit to the new image (fitBounds
// below), but panning stayed clamped to the previous, differently-sized
// rectangle, cropping the new image or blocking scroll into parts of it.
// map.setMaxBounds(bounds) is the one call that actually updates it.
function MapController({ bounds }) {
  const map = useMap();
  useEffect(() => {
    const apply = () => {
      map.invalidateSize();
      map.setMaxBounds(bounds);
      const fit = map.getBoundsZoom(bounds, false);
      map.setMinZoom(fit);
      map.setMaxZoom(fit + 8);
      map.fitBounds(bounds, { animate: false });
    };
    apply();
    map.on('resize', apply);
    return () => { map.off('resize', apply); };
  }, [map, bounds]);
  return null;
}

// Visibility is driven by each pin's LEVEL (1..4): level 4 shows at any zoom;
// each lower level needs more of the zoom range.
function PinMarkers({ pins, dims, onSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoom: () => setZoom(map.getZoom()), zoomend: () => setZoom(map.getZoom()) });

  const min = map.getMinZoom();
  const range = map.getMaxZoom() - min;
  const frac = range > 0 ? Math.min(1, Math.max(0, (zoom - min) / range)) : 0;

  return pins
    .filter((p) => frac >= levelThreshold(p.location_marker_level ?? DEFAULT_MARKER_LEVEL))
    .map((p) => (
      <Marker
        key={p.id}
        position={toLatLng(p, dims)}
        icon={buildIcon(p.location_marker_icon)}
        keyboard
        eventHandlers={{ click: () => onSelect(p.location_id) }}
      />
    ));
}

// Centers on a pin when the selected location changes (click or deep-link), and
// zooms in enough to reveal that marker's level. Guarded to fly once per id.
function FocusController({ focusLocationId, pins, dims }) {
  const map = useMap();
  const flownFor = useRef(null);
  useEffect(() => {
    if (!focusLocationId) { flownFor.current = null; return; }
    if (flownFor.current === focusLocationId) return;
    const pin = pins.find((p) => p.location_id === focusLocationId);
    if (!pin) return; // pins not loaded yet — re-runs when `pins` changes
    flownFor.current = focusLocationId;
    const min = map.getMinZoom();
    const range = map.getMaxZoom() - min;
    const level = pin.location_marker_level ?? DEFAULT_MARKER_LEVEL;
    const revealZoom = min + (levelThreshold(level) + 0.05) * range;
    map.flyTo(toLatLng(pin, dims), Math.max(map.getZoom(), revealZoom), { duration: 0.6 });
  }, [focusLocationId, pins, dims, map]);
  return null;
}

// In placement mode, a map click becomes normalized (0..1) coordinates.
function ClickToPlace({ enabled, dims, onPick }) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      const x = Math.min(1, Math.max(0, e.latlng.lng / dims.w));
      const y = Math.min(1, Math.max(0, 1 - e.latlng.lat / dims.h));
      onPick({ x, y });
    },
  });
  return null;
}

export default function MapCanvas({ imageUrl, pins, focusLocationId, onSelect, placing = false, onMapClick }) {
  const [dims, setDims] = useState(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!imageUrl) return undefined;
    let alive = true;
    setImgError(false);
    const img = new Image();
    img.onload = () => { if (alive) setDims({ w: img.naturalWidth || 1000, h: img.naturalHeight || 1000 }); };
    img.onerror = () => { if (alive) setImgError(true); };
    img.src = imageUrl;
    return () => { alive = false; };
  }, [imageUrl]);

  const bounds = useMemo(() => (dims ? [[0, 0], [dims.h, dims.w]] : null), [dims?.w, dims?.h]);

  if (imgError) {
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-danger">Не вдалось завантажити зображення мапи</div>;
  }
  if (!dims || !bounds) {
    return <div className="grid h-full place-items-center text-sm text-text-dim">Завантаження мапи…</div>;
  }

  return (
    <MapContainer
      crs={L.CRS.Simple}
      bounds={bounds}
      maxBounds={bounds}
      maxBoundsViscosity={1.0}
      minZoom={-8}
      maxZoom={8}
      zoomSnap={0}
      zoomDelta={0.6}
      attributionControl={false}
      className="h-full w-full"
    >
      {/* Keyed by url: react-leaflet v4's ImageOverlay updater doesn't call
          setUrl on prop change, so switching lenses must remount the overlay. */}
      <ImageOverlay key={imageUrl} url={imageUrl} bounds={bounds} />
      <MapController bounds={bounds} />
      <PinMarkers pins={pins} dims={dims} onSelect={onSelect} />
      <FocusController focusLocationId={focusLocationId} pins={pins} dims={dims} />
      {onMapClick && <ClickToPlace enabled={placing} dims={dims} onPick={onMapClick} />}
    </MapContainer>
  );
}
