import { useState } from 'react';
import mapsApi from '../../api/maps';
import Sheet from '../ui/Sheet';
import ImageUploadField from '../ui/ImageUploadField';

// Обкладинка мапи для карток у каталозі /maps і в кампаніях. Окрема від
// шарів: шари — повнорозмірні зображення мапи, а прев'ю — легка картинка,
// яку власник обирає сам. Зберігається одразу після завантаження/видалення.
export default function MapPreviewSheet({ map, onSaved, onClose }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleChange = async (imageUrl, thumbnailUrl) => {
    setSaving(true);
    setError('');
    try {
      const updated = await mapsApi.updateMap(map.id, {
        preview_image_url: imageUrl || null,
        preview_thumbnail_url: imageUrl ? thumbnailUrl : null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось зберегти прев\'ю');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Прев'ю мапи">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-text-dim">
          Зображення, яке показується на картці мапи в каталозі та в кампаніях.
        </p>
        <ImageUploadField
          label="Зображення прев'ю"
          value={map.preview_image_url || ''}
          onChange={handleChange}
          entityType="map-preview"
          entityId={map.id}
          disabled={saving}
        />
        {saving && <p className="text-xs text-text-dim">Збереження...</p>}
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
