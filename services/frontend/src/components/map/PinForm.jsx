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

// Sheet for creating a new pin after the owner clicks the map in placement
// mode (`coords`). An existing pin's visibility is edited inline in the
// location's own "Редагувати" window (see LocationEditor) instead.
export default function PinForm({ mapId, coords, lenses, campaigns, activeLensId, myLocations, onSaved, onClose }) {
  const [mode, setMode] = useState('new');
  const [existingId, setExistingId] = useState('');
  const [locBase, setLocBase] = useState(EMPTY_BASE);
  const [locVersion, setLocVersion] = useState(EMPTY_VERSION);
  // Empty means unrestricted (see 61-map-pins-lens-campaign-visibility.sql) —
  // a new pin defaults to the lens it's being placed on, and to every campaign.
  const [lensIds, setLensIds] = useState(() => (activeLensId ? [activeLensId] : []));
  const [visibleCampaignIds, setVisibleCampaignIds] = useState([]);
  // Optional [start, end] year window — blank means unbounded that side.
  const [startYear, setStartYear] = useState('');
  const [endYear, setEndYear] = useState('');
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
      setError(err.response?.data?.message || 'Не вдалось створити мітку');
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Нова мітка">
      <div className="flex flex-col gap-4">
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
          <Button onClick={save} disabled={saving}>{saving ? 'Збереження…' : 'Створити мітку'}</Button>
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
        </div>
      </div>
    </Sheet>
  );
}
