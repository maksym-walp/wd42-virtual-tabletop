import { useState } from 'react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import Field, { inputClass } from '../ui/Field';
import MultiSelectDropdown from '../ui/MultiSelectDropdown';
import mapsApi from '../../api/maps';
import LocationFields from './LocationFields';

const EMPTY_LOCATION = { name: '', type: null, description: '', gm_note: '', image_urls: [], marker_icon: null, marker_level: null };

// Sheet for both creating a pin (after the owner clicks the map in placement
// mode — pass `coords`) and editing an existing one's visibility (pass `pin`
// instead — its location/position/zoom are fixed, only lens_ids/
// visible_campaign_ids are editable). Exactly one of coords/pin is given.
export default function PinForm({ mapId, coords, pin, lenses, campaigns, activeLensId, myLocations, onSaved, onClose }) {
  const isEdit = Boolean(pin);
  const [mode, setMode] = useState('new');
  const [existingId, setExistingId] = useState('');
  const [loc, setLoc] = useState(EMPTY_LOCATION);
  // Empty means unrestricted (see 61-map-pins-lens-campaign-visibility.sql) —
  // a new pin defaults to the lens it's being placed on, and to every campaign.
  const [lensIds, setLensIds] = useState(() => (isEdit ? pin.lens_ids || [] : (activeLensId ? [activeLensId] : [])));
  const [visibleCampaignIds, setVisibleCampaignIds] = useState(() => (isEdit ? pin.visible_campaign_ids || [] : []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const lensOptions = (lenses || []).map((l) => ({ key: l.id, label: l.name }));
  const campaignOptions = (campaigns || []).map((c) => ({ key: c.id, label: c.name }));

  const tabClass = (active) => `flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
    active ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border text-text-dim'
  }`;

  const save = async () => {
    setError('');
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
        });
        onSaved();
        return;
      }

      let locationId = existingId;
      if (mode === 'new') {
        if (!loc.name.trim()) { setError('Вкажіть назву локації'); setSaving(false); return; }
        const created = await mapsApi.createLocation({
          name: loc.name.trim(),
          type: loc.type || undefined,
          description: loc.description || undefined,
          gm_note: loc.gm_note || undefined,
          image_urls: loc.image_urls?.length ? loc.image_urls : undefined,
          marker_icon: loc.marker_icon || undefined,
          marker_level: loc.marker_level ?? undefined,
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
              <LocationFields value={loc} onChange={setLoc} />
            )}
          </>
        )}

        <Field label="Видима на шарах" hint="Порожньо — видима на всіх шарах мапи.">
          <MultiSelectDropdown options={lensOptions} value={lensIds} onChange={setLensIds} placeholder="Усі шари" />
        </Field>

        <Field label="Видима в кампаніях" hint="Порожньо — видима в будь-якій кампанії, що має доступ до мапи.">
          <MultiSelectDropdown options={campaignOptions} value={visibleCampaignIds} onChange={setVisibleCampaignIds} placeholder="Усі кампанії" />
        </Field>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Збереження…' : (isEdit ? 'Зберегти' : 'Створити мітку')}</Button>
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
        </div>
      </div>
    </Sheet>
  );
}
