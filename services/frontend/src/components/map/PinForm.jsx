import { useState } from 'react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';
import mapsApi from '../../api/maps';
import LocationFields from './LocationFields';
import LocationVersionFields from './LocationVersionFields';

const EMPTY_BASE = { name: '', types: [], marker_icon: null, marker_level: null };
const EMPTY_VERSION = { start_year: null, description: '', gm_note: '', image_url: null };

// Sheet for both creating a pin (after the owner clicks the map in placement
// mode — pass `coords`) and editing an existing one's visibility (pass `pin`
// instead — its location/position/zoom are fixed, only lens_ids/
// visible_campaign_ids are editable). Exactly one of coords/pin is given.
export default function PinForm({ mapId, coords, pin, lenses, campaigns, activeLensId, myLocations, onSaved, onClose }) {
  const isEdit = Boolean(pin);
  const [mode, setMode] = useState('new');
  const [existingId, setExistingId] = useState('');
  const [locBase, setLocBase] = useState(EMPTY_BASE);
  const [locVersion, setLocVersion] = useState(EMPTY_VERSION);
  // Empty means unrestricted (see 61-map-pins-lens-campaign-visibility.sql) —
  // a new pin defaults to the lens it's being placed on, and to every campaign.
  const [lensIds, setLensIds] = useState(() => (isEdit ? pin.lens_ids || [] : (activeLensId ? [activeLensId] : [])));
  const [visibleCampaignIds, setVisibleCampaignIds] = useState(() => (isEdit ? pin.visible_campaign_ids || [] : []));
  // Optional [start, end] year window — blank means unbounded that side.
  const [startYear, setStartYear] = useState(() => (isEdit && pin.start_year != null ? String(pin.start_year) : ''));
  const [endYear, setEndYear] = useState(() => (isEdit && pin.end_year != null ? String(pin.end_year) : ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // '' -> undefined (omitted), else the integer, or NaN when malformed.
  const readYear = (raw) => {
    const s = raw.trim();
    if (s === '') return undefined;
    const n = Number(s);
    return Number.isInteger(n) ? n : NaN;
  };

  const lensOptions = (lenses || []).map((l) => ({ key: l.id, label: l.name }));
  const campaignOptions = (campaigns || []).map((c) => ({ key: c.id, label: c.name }));

  const tabClass = (active) => `flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
    active ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border text-text-dim'
  }`;

  const save = async () => {
    setError('');
    const start = readYear(startYear);
    const end = readYear(endYear);
    if (Number.isNaN(start) || Number.isNaN(end)) { setError('Рік має бути цілим числом'); return; }
    if (start != null && end != null && start > end) { setError('Рік початку пізніший за рік завершення'); return; }
    const yearFields = { start_year: start ?? null, end_year: end ?? null };

    setSaving(true);
    try {
      if (isEdit) {
        await mapsApi.updatePin(mapId, pin.id, {
          x_coordinate: pin.x_coordinate,
          y_coordinate: pin.y_coordinate,
          min_zoom: pin.min_zoom,
          max_zoom: pin.max_zoom,
          lens_ids: lensIds,
          visible_campaign_ids: visibleCampaignIds,
          ...yearFields,
        });
        onSaved();
        return;
      }

      let locationId = existingId;
      if (mode === 'new') {
        if (!locBase.name.trim()) { setError('Вкажіть назву локації'); setSaving(false); return; }
        const created = await mapsApi.createLocation({
          name: locBase.name.trim(),
          types: locBase.types?.length ? locBase.types : undefined,
          marker_icon: locBase.marker_icon || undefined,
          marker_level: locBase.marker_level ?? undefined,
          description: locVersion.description || undefined,
          gm_note: locVersion.gm_note || undefined,
          image_url: locVersion.image_url || undefined,
        });
        locationId = created.id;
      }
      if (!locationId) { setError('Оберіть або створіть локацію'); setSaving(false); return; }

      await mapsApi.addPin(mapId, {
        location_id: locationId,
        x_coordinate: coords.x,
        y_coordinate: coords.y,
        lens_ids: lensIds,
        visible_campaign_ids: visibleCampaignIds,
        ...yearFields,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || (isEdit ? 'Не вдалось зберегти мітку' : 'Не вдалось створити мітку'));
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={isEdit ? 'Редагування мітки' : 'Нова мітка'}>
      <div className="flex flex-col gap-4">
        {isEdit ? (
          <p className="text-sm text-text-dim">
            Локація: <span className="font-semibold text-text">{pin.location_name}</span>
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <button type="button" className={tabClass(mode === 'existing')} onClick={() => setMode('existing')} disabled={!myLocations.length}>
                Існуюча локація
              </button>
              <button type="button" className={tabClass(mode === 'new')} onClick={() => setMode('new')}>
                Нова локація
              </button>
            </div>

            {mode === 'existing' ? (
              <select className={inputClass} value={existingId} onChange={(e) => setExistingId(e.target.value)}>
                <option value="">Оберіть локацію…</option>
                {myLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            ) : (
              <>
                <LocationFields value={locBase} onChange={setLocBase} />
                <LocationVersionFields value={locVersion} onChange={setLocVersion} isBase />
                <p className="text-xs text-text-dim">Це базова версія локації. Хронологічні версії за роками додаються в редакторі локації.</p>
              </>
            )}
          </>
        )}

        <Field label="Видима на шарах" hint="Порожньо — видима на всіх шарах мапи.">
          <MultiSelectDropdown options={lensOptions} value={lensIds} onChange={setLensIds} placeholder="Усі шари" />
        </Field>

        <Field label="Видима в кампаніях" hint="Порожньо — видима в будь-якій кампанії, що має доступ до мапи.">
          <MultiSelectDropdown options={campaignOptions} value={visibleCampaignIds} onChange={setVisibleCampaignIds} placeholder="Усі кампанії" />
        </Field>

        <div className="flex gap-3">
          <Field label="Рік початку" className="flex-1" hint="Порожньо — без нижньої межі.">
            <input type="number" className={inputClass} value={startYear} onChange={(e) => setStartYear(e.target.value)} placeholder="—" />
          </Field>
          <Field label="Рік завершення" className="flex-1" hint="Порожньо — без верхньої межі.">
            <input type="number" className={inputClass} value={endYear} onChange={(e) => setEndYear(e.target.value)} placeholder="—" />
          </Field>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Збереження…' : (isEdit ? 'Зберегти' : 'Створити мітку')}</Button>
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
        </div>
      </div>
    </Sheet>
  );
}
