import { useMemo, useRef, useState } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';
import mapsApi from '../../api/maps';
import LocationFields from './LocationFields';
import LocationVersionFields from './LocationVersionFields';

const emptyBase = () => ({ name: '', types: [], marker_icon: null, marker_level: null });
const emptyVersion = (key) => ({
  _key: key, id: null, start_year: null, end_year: null, description: '', gm_note: '', image_url: null,
  name: null, marker_icon: null, marker_level: null, types: null,
});

const toYear = (raw) => (raw === '' || raw == null ? null : Number(raw));

// Normalizes a version row for the API.
function versionPayload(v) {
  return {
    start_year: toYear(v.start_year),
    end_year: toYear(v.end_year),
    description: v.description || null,
    gm_note: v.gm_note || null,
    image_url: v.image_url || null,
    name: v.name || null,
    marker_icon: v.marker_icon || null,
    marker_level: v.marker_level ?? null,
    types: v.types == null ? null : v.types,
  };
}

// Shared create/edit modal for a location. `location` is either null (new) or a
// full location object with `.versions`. Renders the base fields once plus a
// list of chronological versions the GM can add/remove.
export default function LocationEditor({ location, onClose, onSaved }) {
  const isEdit = Boolean(location?.id);
  const keySeq = useRef(1);

  const [base, setBase] = useState(() => (isEdit
    ? { name: location.name || '', types: location.types || [], marker_icon: location.marker_icon || null, marker_level: location.marker_level ?? null }
    : emptyBase()));

  const [versions, setVersions] = useState(() => {
    if (isEdit && location.versions?.length) {
      return location.versions.map((v) => ({
        _key: keySeq.current++, id: v.id,
        start_year: v.start_year ?? null, end_year: v.end_year ?? null,
        description: v.description || '', gm_note: v.gm_note || '', image_url: v.image_url || null,
        name: v.name || null, marker_icon: v.marker_icon || null, marker_level: v.marker_level ?? null,
        types: v.types ?? null,
      }));
    }
    return [emptyVersion(keySeq.current++)];
  });

  const originalIds = useMemo(
    () => (isEdit ? (location.versions || []).map((v) => v.id) : []),
    [isEdit, location],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setVersion = (key, next) => setVersions((prev) => prev.map((v) => (v._key === key ? { ...next, _key: key } : v)));
  const addVersion = () => setVersions((prev) => [...prev, emptyVersion(keySeq.current++)]);
  const removeVersion = (key) => setVersions((prev) => prev.filter((v) => v._key !== key));

  const save = async () => {
    if (!base.name.trim()) { setError('Вкажіть назву'); return; }
    for (const v of versions) {
      const s = toYear(v.start_year); const e = toYear(v.end_year);
      if ((v.start_year !== '' && v.start_year != null && !Number.isInteger(s))
        || (v.end_year !== '' && v.end_year != null && !Number.isInteger(e))) {
        setError('Рік має бути цілим числом'); return;
      }
      if (s != null && e != null && s > e) { setError('Рік завершення раніше за рік початку'); return; }
    }
    setError('');
    setSaving(true);
    try {
      const baseFields = {
        name: base.name.trim(),
        types: base.types || [],
        marker_icon: base.marker_icon || null,
        marker_level: base.marker_level ?? null,
      };

      let locationId = location?.id;
      if (isEdit) {
        await mapsApi.updateLocation(locationId, baseFields);
      } else {
        // Create carries the first version's fields flattened.
        const created = await mapsApi.createLocation({ ...baseFields, ...versionPayload(versions[0]) });
        locationId = created.id;
      }

      // Remaining versions: add new, update existing.
      const startIdx = isEdit ? 0 : 1;
      for (let i = startIdx; i < versions.length; i += 1) {
        const v = versions[i];
        if (v.id) await mapsApi.updateLocationVersion(locationId, v.id, versionPayload(v));
        else await mapsApi.addLocationVersion(locationId, versionPayload(v));
      }

      // Deletions (edit only).
      if (isEdit) {
        const keptIds = new Set(versions.filter((v) => v.id).map((v) => v.id));
        for (const id of originalIds) {
          if (!keptIds.has(id)) await mapsApi.removeLocationVersion(locationId, id);
        }
      }

      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось зберегти');
      setSaving(false);
    }
  };

  const del = async () => {
    if (!confirm('Видалити локацію разом з усіма її мітками?')) return;
    setSaving(true);
    try {
      await mapsApi.removeLocation(location.id);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось видалити');
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title={isEdit ? 'Редагувати локацію' : 'Нова локація'}>
      <div className="flex flex-col gap-4">
        <LocationFields value={base} onChange={setBase} />

        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">Хронологічні версії</p>
          {versions.map((v) => {
            const isBase = v.start_year == null || v.start_year === '';
            return (
              <div key={v._key} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
                    <Clock size={13} /> {isBase ? 'Базова версія' : `Від ${v.start_year} р.`}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeVersion(v._key)}
                    disabled={versions.length <= 1}
                    aria-label="Видалити версію"
                    className="p-1 text-text-dim hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <LocationVersionFields value={v} onChange={(next) => setVersion(v._key, next)} />
              </div>
            );
          })}
          <Button type="button" variant="ghost" size="sm" onClick={addVersion} className="self-start">
            <Plus size={14} /> Додати версію
          </Button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? 'Збереження…' : 'Зберегти'}</Button>
            <Button variant="ghost" onClick={onClose}>Скасувати</Button>
          </div>
          {isEdit && (
            <Button variant="danger" size="sm" onClick={del} disabled={saving}>
              <Trash2 size={14} /> Видалити
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
