import { useState } from 'react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import { inputClass } from '../ui/Field';
import mapsApi from '../../api/maps';
import LocationFields from './LocationFields';

const EMPTY_LOCATION = { name: '', type: null, description: '', gm_note: '', image_url: null };

// Sheet shown after the owner clicks the map in placement mode. Creates a pin at
// `coords` (normalized), linked to either a chosen existing location or a new one.
export default function PinForm({ mapId, coords, myLocations, onCreated, onClose }) {
  const [mode, setMode] = useState('new');
  const [existingId, setExistingId] = useState('');
  const [loc, setLoc] = useState(EMPTY_LOCATION);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const tabClass = (active) => `flex-1 rounded-lg border px-3 py-1.5 text-sm font-semibold ${
    active ? 'border-gold/60 bg-gold/10 text-gold' : 'border-border text-text-dim'
  }`;

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      let locationId = existingId;
      if (mode === 'new') {
        if (!loc.name.trim()) { setError('Вкажіть назву локації'); setSaving(false); return; }
        const created = await mapsApi.createLocation({
          name: loc.name.trim(),
          type: loc.type || undefined,
          description: loc.description || undefined,
          gm_note: loc.gm_note || undefined,
          image_url: loc.image_url || undefined,
        });
        locationId = created.id;
      }
      if (!locationId) { setError('Оберіть або створіть локацію'); setSaving(false); return; }

      await mapsApi.addPin(mapId, {
        location_id: locationId,
        x_coordinate: coords.x,
        y_coordinate: coords.y,
      });
      onCreated();
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
          <LocationFields value={loc} onChange={setLoc} />
        )}

        <p className="text-xs text-text-dim">
          Видимість мітки за масштабом визначається рівнем її типу (налаштовується у типах локацій).
        </p>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>{saving ? 'Збереження…' : 'Створити мітку'}</Button>
          <Button variant="ghost" onClick={onClose}>Скасувати</Button>
        </div>
      </div>
    </Sheet>
  );
}
