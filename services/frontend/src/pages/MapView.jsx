import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Layers, SlidersHorizontal, Eye, EyeOff, Upload, Trash2, Globe, Lock, Pencil, Check, X as XIcon, MapPin, Plus, Clock } from 'lucide-react';
import mapsApi from '../api/maps';
import campaignApi from '../api/campaigns';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import { datedYears, resolveLensImage, pinVisibleInYear, pinExistsInYear, resolvePinTypeKeys } from '../constants/maps';
import useMediaQuery from '../hooks/useMediaQuery';
import MapCanvas from '../components/map/MapCanvas';
import LensSwitcher from '../components/map/LensSwitcher';
import MapControlMenu from '../components/map/MapControlMenu';
import LocationDrawer from '../components/map/LocationDrawer';
import PinForm from '../components/map/PinForm';
import TimelineSlider from '../components/map/TimelineSlider';
import LensVersionsSheet from '../components/map/LensVersionsSheet';
import EmptyState from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { inputClass } from '../components/ui/Field';

export default function MapView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedLocationId = searchParams.get('location');
  // Opened from a campaign: no timeline slider — the view is pinned to the
  // campaign's in-fiction year (resolved to the closest lens version).
  const campaignId = searchParams.get('campaign_id');

  const [map, setMap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [lenses, setLenses] = useState([]);
  const [activeLensId, setActiveLensId] = useState(null);
  const [pins, setPins] = useState([]);
  const [hiddenTypes, setHiddenTypes] = useState(() => new Set());

  // Timeline. `year` drives the slider (standalone view); `campaignYear` is the
  // fixed year when opened from a campaign.
  const [year, setYear] = useState(null);
  const [campaignYear, setCampaignYear] = useState(null);
  const [versionsLensId, setVersionsLensId] = useState(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  // Pin authoring (owner only)
  const [placing, setPlacing] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);
  const [editingPin, setEditingPin] = useState(null);
  const [myLocations, setMyLocations] = useState([]);
  const [myCampaigns, setMyCampaigns] = useState([]);

  const isOwner = Boolean(map?.is_owner);
  // Wide layout: lens switcher goes in the header, timeline is a vertical rail
  // on the left. Narrow: lens switcher + type filter share a row, timeline
  // stays a horizontal bar at the bottom.
  const wide = useMediaQuery('(min-width: 768px)');

  const refreshPins = () => mapsApi.listPins(id).then(setPins).catch(() => {});
  const refreshLenses = () => mapsApi.listLenses(id).then(setLenses).catch(() => {});
  const refreshMyLocations = () => mapsApi.listLocations().then(setMyLocations).catch(() => {});

  // Campaign context: pin the view to the campaign's current in-fiction year.
  useEffect(() => {
    if (!campaignId) { setCampaignYear(null); return; }
    campaignApi.getOne(campaignId)
      .then((c) => setCampaignYear(c?.current_year ?? null))
      .catch(() => setCampaignYear(null));
  }, [campaignId]);

  // The owner's location library powers the "pick existing location" option;
  // their own campaigns (is_gm — not ones they merely play in) power the pin
  // form's "Visible in campaigns" picker.
  useEffect(() => {
    if (!isOwner) return;
    refreshMyLocations();
    campaignApi.list().then((all) => setMyCampaigns(all.filter((c) => c.is_gm))).catch(() => {});
  }, [isOwner]); // eslint-disable-line react-hooks/exhaustive-deps

  // The pin (if any) for the currently open location on THIS map — lets the
  // drawer offer "remove pin".
  const selectedPin = useMemo(
    () => (selectedLocationId ? pins.find((p) => p.location_id === selectedLocationId) : null),
    [pins, selectedLocationId],
  );

  // One load per map id: fetch the map, then its lenses + pins. Kept off `map`
  // state so later setMap (rename / public toggle) doesn't refetch or reset filters.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setHiddenTypes(new Set());
    setActiveLensId(null);
    mapsApi.getMap(id)
      .then((m) => {
        if (!alive) return null;
        setMap(m);
        return Promise.all([mapsApi.listLenses(id), mapsApi.listPins(id)]);
      })
      .then((res) => {
        if (!alive || !res) return;
        const [ls, ps] = res;
        setLenses(ls);
        setActiveLensId(ls[0]?.id ?? null);
        setPins(ps);
      })
      .catch((err) => {
        if (alive) setError(err.response?.status === 403 ? 'У вас немає доступу до цієї мапи' : 'Не вдалось завантажити мапу');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const activeLens = useMemo(
    () => lenses.find((l) => l.id === activeLensId) || lenses[0] || null,
    [lenses, activeLensId],
  );

  // Years that have a version image on the active lens, ascending.
  const timelineYears = useMemo(() => datedYears(activeLens?.versions), [activeLens?.versions]);
  const campaignMode = Boolean(campaignId);
  // The slider shows only in the standalone view, and only when the lens spans
  // more than one year.
  const hasTimeline = !campaignMode && timelineYears.length >= 2;

  // When the active lens changes, snap the slider to its latest year.
  useEffect(() => {
    setYear(timelineYears.length ? timelineYears[timelineYears.length - 1] : null);
  }, [activeLens?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // The year the map is currently showing: fixed campaign year, slider year, or
  // none (a lens with no timeline).
  const currentYear = campaignMode ? campaignYear : hasTimeline ? year : null;
  const activeImageUrl = useMemo(
    () => resolveLensImage(activeLens?.versions, currentYear),
    [activeLens?.versions, currentYear],
  );
  // Pin year-window filtering only kicks in when a year is actually active.
  const filterYear = (hasTimeline || (campaignMode && campaignYear != null)) ? currentYear : null;

  // Empty lens_ids means "not restricted to specific lenses" (see
  // 61-map-pins-lens-campaign-visibility.sql) — a pin with none set still
  // renders on every lens, only an explicit, non-matching list hides it.
  // A pin also drops out when the active year falls outside its own
  // [start_year, end_year] window, or outside its location's existence
  // (before the earliest dated version / after a version's end_year).
  // filterYear === null disables all year checks.
  const pinsOnActiveLens = useMemo(
    () => pins.filter((p) =>
      (!p.lens_ids?.length || p.lens_ids.includes(activeLens?.id))
      && pinVisibleInYear(p, filterYear)
      && pinExistsInYear(p, filterYear)),
    [pins, activeLens?.id, filterYear],
  );

  // A location can carry several types (and they can change per version), so
  // each pin lands in every one of its resolved type buckets.
  const typeBuckets = useMemo(() => {
    const acc = new Map();
    for (const p of pinsOnActiveLens) {
      for (const key of resolvePinTypeKeys(p, filterYear)) {
        acc.set(key, (acc.get(key) || 0) + 1);
      }
    }
    return [...acc.entries()].map(([key, count]) => ({ key, count }));
  }, [pinsOnActiveLens, filterYear]);

  // Shown unless every one of the pin's types is hidden.
  const visiblePins = useMemo(
    () => pinsOnActiveLens.filter((p) =>
      resolvePinTypeKeys(p, filterYear).some((k) => !hiddenTypes.has(k))),
    [pinsOnActiveLens, hiddenTypes, filterYear],
  );

  const toggleType = (key) => setHiddenTypes((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const selectLocation = (locationId) => setSearchParams(locationId ? { location: locationId } : {}, { replace: false });

  const saveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === map.name) { setEditingName(false); return; }
    try {
      const updated = await mapsApi.updateMap(id, { name: trimmed });
      setMap(updated);
      setEditingName(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при перейменуванні');
    }
  };

  const togglePublic = async () => {
    try {
      const updated = await mapsApi.updateMap(id, { is_public: !map.is_public });
      setMap(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось змінити видимість');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити мапу «${map.name}»? Шари та мітки буде видалено. Це незворотно.`)) return;
    try {
      await mapsApi.removeMap(id);
      navigate('/maps');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні мапи');
    }
  };

  const handleUploadLens = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий — максимум 25 МБ'); return; }

    const name = (prompt('Назва шару (напр. Політична, Географічна):', `Шар ${lenses.length + 1}`) || '').trim();
    if (!name) return;

    // Optional year for the first version — blank means a "timeless" image.
    const yearRaw = (prompt('Рік цього зображення (необовʼязково — залиште порожнім):', '') || '').trim();
    let firstYear;
    if (yearRaw !== '') {
      firstYear = Number(yearRaw);
      if (!Number.isInteger(firstYear)) { setError('Рік має бути цілим числом'); return; }
    }

    setError('');
    setUploading(true);
    try {
      const image_url = await mediaApi.upload(file, { entityType: 'map-lenses', entityId: id });
      const lens = await mapsApi.addLens(id, { name, image_url, year: firstYear });
      setLenses((prev) => [...prev, lens]);
      setActiveLensId(lens.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось завантажити шар');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLens = async (lensId) => {
    if (!confirm('Видалити цей шар?')) return;
    const previous = lenses;
    setLenses((prev) => prev.filter((l) => l.id !== lensId));
    if (activeLensId === lensId) setActiveLensId(null);
    try {
      await mapsApi.removeLens(id, lensId);
    } catch {
      setLenses(previous);
      setError('Не вдалось видалити шар');
    }
  };

  // Click on the map (in placement mode) → open the pin form at those coords.
  const handleMapClick = (coords) => {
    setPlacing(false);
    setPendingCoords(coords);
  };

  const handlePinSaved = async () => {
    setPendingCoords(null);
    setEditingPin(null);
    await Promise.all([refreshPins(), refreshMyLocations()]);
  };

  const handleRemovePin = async (pinId) => {
    try {
      await mapsApi.removePin(id, pinId);
      setPins((prev) => prev.filter((p) => p.id !== pinId));
      selectLocation(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось прибрати мітку');
    }
  };

  const handleDeleteLocation = async (locationId) => {
    try {
      await mapsApi.removeLocation(locationId);
      setPins((prev) => prev.filter((p) => p.location_id !== locationId));
      selectLocation(null);
      refreshMyLocations();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось видалити локацію');
    }
  };

  // Shared by both LensSwitcher slots (header tabs on wide, dropdown on narrow).
  const lensSwitcherProps = {
    lenses,
    activeLensId: activeLens?.id ?? null,
    isOwner,
    uploading,
    onSelect: setActiveLensId,
    onManageVersions: setVersionsLensId,
    onRemoveLens: handleRemoveLens,
    onAddLens: () => fileRef.current?.click(),
  };

  // The type-filter toggle list — reused in the wide left rail (wrapped in a
  // card) and the narrow dropdown menu (bare).
  const typeFilterList = (
    <div className="flex flex-col gap-1">
      {typeBuckets.map(({ key, count }) => {
        const on = !hiddenTypes.has(key);
        return (
          <button key={key} onClick={() => toggleType(key)} aria-pressed={on}
            className={`flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-surface-hover ${on ? 'text-text' : 'text-text-dim line-through'}`}>
            {on ? <Eye size={13} /> : <EyeOff size={13} />}
            <span className="flex-1 text-left">{key === 'other' ? 'Без типу' : key}</span>
            <span className="tabular-nums text-text-dim">{count}</span>
          </button>
        );
      })}
    </div>
  );
  const typeFilterPanel = typeBuckets.length > 0 ? (
    <div className="pointer-events-auto rounded-lg border border-border bg-surface/95 p-2 shadow-lg backdrop-blur">
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-dim">
        <SlidersHorizontal size={13} /> Типи локацій
      </div>
      {typeFilterList}
    </div>
  ) : null;

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження…</div>;
  if (error && !map) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4 text-danger">{error}</p>
        <Link to="/maps" className="text-sm text-accent">← До списку мап</Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header — single row: back · title · (spacer) · public · delete */}
      <div className="shrink-0 border-b border-border px-4 py-2.5 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link to="/maps" className="inline-flex items-center gap-1 text-sm text-accent">
            <ArrowLeft size={15} /> Мапи
          </Link>
          <div className="flex items-center gap-2">
            {editingName ? (
              <>
                <input
                  autoFocus
                  className={`${inputClass} font-display text-lg`}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  maxLength={200}
                />
                <button onClick={saveName} aria-label="Зберегти" className="p-1.5 text-sage"><Check size={18} /></button>
                <button onClick={() => setEditingName(false)} aria-label="Скасувати" className="p-1.5 text-text-dim"><XIcon size={18} /></button>
              </>
            ) : (
              <>
                <h1 className="m-0 font-display text-xl font-bold text-text">{map.name}</h1>
                {isOwner && (
                  <button onClick={() => { setNameDraft(map.name); setEditingName(true); }} aria-label="Перейменувати" className="p-1 text-text-dim hover:text-accent">
                    <Pencil size={15} />
                  </button>
                )}
              </>
            )}
          </div>
          {/* Wide screens: the lenses live here in the header as a tab strip
              that stretches across the free space. */}
          {wide && activeLens && (
            <div className="min-w-0 flex-1">
              <LensSwitcher {...lensSwitcherProps} variant="tabs" />
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {isOwner && activeLens && !placing && (
              <Button size="sm" onClick={() => setPlacing(true)}>
                <Plus size={15} /> Додати мітку
              </Button>
            )}
            {isOwner ? (
              <button
                onClick={togglePublic}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text-muted hover:bg-surface-hover"
                title="Перемкнути видимість"
              >
                {map.is_public ? <Globe size={13} /> : <Lock size={13} />}
                {map.is_public ? 'Публічна' : 'Приватна'}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-dim">
                {map.is_public ? <Globe size={13} /> : <Lock size={13} />}
                {map.is_public ? 'Публічна' : 'Приватна'}
              </span>
            )}
            {isOwner && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 size={14} /> Видалити
              </Button>
            )}
          </div>
        </div>
        {error && map && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {/* Map area */}
      <div className={`relative isolate flex-1 min-h-0 ${placing ? 'map-placing' : ''}`}>
        {!activeLens ? (
          <div className="grid h-full place-items-center p-6">
            <EmptyState icon="🖼" title="У цієї мапи немає шарів-зображень"
              action={isOwner ? (
                <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  <Upload size={14} /> {uploading ? 'Завантаження…' : 'Додати шар'}
                </Button>
              ) : null}>
              {isOwner ? 'Завантажте зображення мапи як перший шар.' : 'Власник ще не додав зображення мапи.'}
            </EmptyState>
          </div>
        ) : (
          <>
            <MapCanvas
              key={id}
              imageUrl={activeImageUrl}
              pins={visiblePins}
              year={filterYear}
              focusLocationId={selectedLocationId}
              onSelect={selectLocation}
              placing={placing}
              onMapClick={isOwner ? handleMapClick : undefined}
            />

            {/* Placement hint — floating, centred at the top */}
            {isOwner && placing && (
              <div className="pointer-events-auto absolute left-1/2 top-3 z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-gold/60 bg-surface/95 px-3 py-2 text-sm text-text shadow-lg backdrop-blur">
                <MapPin size={15} className="text-gold" />
                Клікніть на мапі…
                <button onClick={() => setPlacing(false)} className="ml-1 text-text-dim hover:text-danger" aria-label="Скасувати">
                  <XIcon size={15} />
                </button>
              </div>
            )}

            {/* Narrow: two dropdown buttons instead of the full panels. */}
            {!wide && (activeLens || typeBuckets.length > 0) && (
              <div className="pointer-events-none absolute inset-x-2 top-2 z-[1000] flex justify-end gap-2">
                {activeLens && (
                  <MapControlMenu icon={Layers} label="Шари">
                    <LensSwitcher {...lensSwitcherProps} variant="menu" />
                  </MapControlMenu>
                )}
                {typeBuckets.length > 0 && (
                  <MapControlMenu icon={SlidersHorizontal} label="Типи">
                    {typeFilterList}
                  </MapControlMenu>
                )}
              </div>
            )}

            {/* Wide: a left rail — vertical timeline over the type filter. */}
            {wide && (hasTimeline || typeBuckets.length > 0) && (
              <div className="no-scrollbar pointer-events-auto absolute left-3 top-1/2 z-[1000] flex max-h-[calc(100%-1.5rem)] -translate-y-1/2 flex-col gap-2 overflow-y-auto">
                {hasTimeline && (
                  <TimelineSlider
                    min={timelineYears[0]}
                    max={timelineYears[timelineYears.length - 1]}
                    value={year}
                    ticks={timelineYears}
                    onChange={setYear}
                    orientation="vertical"
                  />
                )}
                {typeFilterPanel}
              </div>
            )}

            {/* Narrow: horizontal timeline pinned to the bottom. */}
            {!wide && hasTimeline && (
              <TimelineSlider
                min={timelineYears[0]}
                max={timelineYears[timelineYears.length - 1]}
                value={year}
                ticks={timelineYears}
                onChange={setYear}
                orientation="horizontal"
              />
            )}

            {campaignMode && campaignYear != null && (
              <div className="pointer-events-none absolute bottom-4 left-1/2 z-[1000] -translate-x-1/2 rounded-lg border border-border bg-surface/95 px-3 py-1.5 text-xs font-semibold text-text-dim shadow-lg backdrop-blur">
                <span className="flex items-center gap-1.5"><Clock size={12} /> Рік кампанії: <span className="tabular-nums text-gold">{campaignYear}</span></span>
              </div>
            )}
          </>
        )}
      </div>

      {versionsLensId && (
        <LensVersionsSheet
          mapId={id}
          lens={lenses.find((l) => l.id === versionsLensId) || { id: versionsLensId, name: '', versions: [] }}
          onChanged={refreshLenses}
          onClose={() => setVersionsLensId(null)}
        />
      )}

      {selectedLocationId && (
        <LocationDrawer
          locationId={selectedLocationId}
          isGm={isOwner}
          year={filterYear}
          pin={selectedPin}
          onEditPin={setEditingPin}
          onRemovePin={handleRemovePin}
          onDeleteLocation={handleDeleteLocation}
          onLocationUpdated={refreshPins}
          onClose={() => selectLocation(null)}
        />
      )}

      {(pendingCoords || editingPin) && (
        <PinForm
          mapId={id}
          coords={pendingCoords}
          pin={editingPin}
          lenses={lenses}
          campaigns={myCampaigns}
          activeLensId={activeLens?.id}
          myLocations={myLocations}
          onSaved={handlePinSaved}
          onClose={() => { setPendingCoords(null); setEditingPin(null); }}
        />
      )}

      <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleUploadLens} />
    </div>
  );
}
