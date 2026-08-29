import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, ImageOverlay, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { levelThreshold, isIconUrl, DEFAULT_MARKER_LEVEL, resolvePinMarker } from '../../constants/maps';

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
    // A second pass on the next frame: right after a remount the container may
    // not have its final size yet, so the first getBoundsZoom() can be wrong
    // (over-zoomed). rAF runs it again once layout has settled.
    const raf = requestAnimationFrame(apply);
    map.on('resize', apply);
    return () => { cancelAnimationFrame(raf); map.off('resize', apply); };
  }, [map, bounds]);
  return null;
}

// Visibility is driven by each pin's LEVEL (1..4): level 4 shows at any zoom;
// each lower level needs more of the zoom range. Icon + level are resolved per
// `year` — a location version can override them for a stretch of history.
function PinMarkers({ pins, dims, year, onSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoom: () => setZoom(map.getZoom()), zoomend: () => setZoom(map.getZoom()) });

  const min = map.getMinZoom();
  const range = map.getMaxZoom() - min;
  const frac = range > 0 ? Math.min(1, Math.max(0, (zoom - min) / range)) : 0;

  return pins
    .map((p) => ({ pin: p, marker: resolvePinMarker(p, year) }))
    .filter(({ marker }) => frac >= levelThreshold(marker.level ?? DEFAULT_MARKER_LEVEL))
    .map(({ pin, marker }) => (
      <Marker
        key={pin.id}
        position={toLatLng(pin, dims)}
        icon={buildIcon(marker.icon)}
        title={marker.name || undefined}
        keyboard
        eventHandlers={{ click: () => onSelect(pin.location_id) }}
      />
    ));
}

// Centers on a pin when the selected location changes (click or deep-link), and
// zooms in enough to reveal that marker's level. Guarded to fly once per id.
function FocusController({ focusLocationId, pins, dims, year }) {
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
    const level = resolvePinMarker(pin, year).level ?? DEFAULT_MARKER_LEVEL;
    const revealZoom = min + (levelThreshold(level) + 0.05) * range;
    map.flyTo(toLatLng(pin, dims), Math.max(map.getZoom(), revealZoom), { duration: 0.6 });
  }, [focusLocationId, pins, dims, year, map]);
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

export default function MapCanvas({ imageUrl, pins, year = null, focusLocationId, onSelect, placing = false, onMapClick }) {
  // url + pixel size are committed together, on load — never a render where the
  // overlay URL and the bounds belong to different images (that mismatch was
  // what left a freshly-scrubbed timeline image drawn inside the previous
  // image's rectangle: over-zoomed and impossible to pan).
  const [img, setImg] = useState(null); // { url, w, h }
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!imageUrl) return undefined;
    let alive = true;
    setImgError(false);
    const probe = new Image();
    probe.onload = () => { if (alive) setImg({ url: imageUrl, w: probe.naturalWidth || 1000, h: probe.naturalHeight || 1000 }); };
    probe.onerror = () => { if (alive) setImgError(true); };
    probe.src = imageUrl;
    return () => { alive = false; };
  }, [imageUrl]);

  // Bounds change only when the pixel size does — so scrubbing between
  // same-size timeline versions keeps the current pan/zoom instead of
  // re-fitting on every drag step.
  const bounds = useMemo(() => (img ? [[0, 0], [img.h, img.w]] : null), [img?.w, img?.h]);

  if (imgError) {
    return <div className="grid h-full place-items-center px-6 text-center text-sm text-danger">Не вдалось завантажити зображення мапи</div>;
  }
  if (!img || !bounds) {
    return <div className="grid h-full place-items-center text-sm text-text-dim">Завантаження мапи…</div>;
  }

  return (
    <MapContainer
      // Remount on a pixel-size change: react-leaflet v4 reads bounds / maxBounds
      // / min-max zoom only at construction, and re-applying them by hand after a
      // big size jump (e.g. a 1024px timeline version to a 12288px one) left the
      // map fitted for the old image — over-zoomed, unpannable. A fresh mount
      // seeds Leaflet with the right bounds; same-size scrubbing keeps the key
      // stable, so pan/zoom is preserved there.
      key={`${img.w}x${img.h}`}
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
          setUrl on prop change, so switching image must remount the overlay. */}
      <ImageOverlay key={img.url} url={img.url} bounds={bounds} />
      <MapController bounds={bounds} />
      <PinMarkers pins={pins} dims={img} year={year} onSelect={onSelect} />
      <FocusController focusLocationId={focusLocationId} pins={pins} dims={img} year={year} />
      {onMapClick && <ClickToPlace enabled={placing} dims={img} onPick={onMapClick} />}
    </MapContainer>
  );
}
