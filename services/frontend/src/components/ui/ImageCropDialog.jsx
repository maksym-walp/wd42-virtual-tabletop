import { useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import { ZoomIn, ZoomOut } from 'lucide-react';
import Sheet from './Sheet';
import Button from './Button';
import CroppedImage, { cropRegion } from './CroppedImage';

export const MAX_CROP_ZOOM = 5; // = межа в utils/image-crop.js сервісів

// Форми, в яких зображення реально показується: картки каталогу (4:3),
// банер на сторінці запису (16:9), портрет у листі персонажа (1:1).
const PREVIEW_SHAPES = [
  { label: 'Картка', aspect: 4 / 3, className: 'aspect-[4/3] w-24' },
  { label: 'Сторінка', aspect: 16 / 9, className: 'aspect-[16/9] w-28' },
  { label: 'Портрет', aspect: 1, className: 'aspect-square w-16' },
];

const round = (n) => Math.round(n * 100) / 100;

// Збережений кадр → початкова область для react-easy-crop (у % від
// зображення) — та сама геометрія, що й у CroppedImage.
function toAreaPercentages(crop, aspect) {
  const { left, top, w, h } = cropRegion(crop, aspect);
  return {
    x: (left / crop.ratio) * 100,
    y: top * 100,
    width: (w / crop.ratio) * 100,
    height: h * 100,
  };
}

/**
 * Кадрування без зміни файлу: користувач рухає й наближає зображення в рамці
 * основної форми (aspect), а зберігається лише { x, y, zoom, ratio } — центр
 * кадру, наближення й пропорції оригіналу. Унизу — живі прев'ю всіх форм,
 * бо кадр застосовується до кожної з них.
 */
export default function ImageCropDialog({ src, crop: initialCrop, aspect = 4 / 3, onSave, onClose }) {
  const [ratio, setRatio] = useState(initialCrop?.ratio ?? null);
  const [loadError, setLoadError] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1);
  const [draft, setDraft] = useState(initialCrop || null);
  // initialCroppedAreaPercentages читається Cropper'ом лише при завантаженні
  // зображення — фіксуємо його один раз, щоб не «смикати» кадр під час руху.
  const initialArea = useRef(undefined);

  // Пропорції оригіналу потрібні до монтування Cropper'а (щоб відновити
  // збережений кадр) — читаємо їх із самого зображення: збережений ratio міг
  // залишитися від попереднього файлу.
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.onload = () => {
      if (!alive) return;
      const r = img.naturalWidth / img.naturalHeight;
      if (initialCrop && Math.abs(initialCrop.ratio - r) < 0.01) {
        initialArea.current = toAreaPercentages({ ...initialCrop, ratio: r }, aspect);
      }
      setRatio(r);
    };
    img.onerror = () => { if (alive) setLoadError(true); };
    img.src = src;
    return () => { alive = false; };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCropComplete = (area) => {
    if (!ratio) return;
    setDraft({
      x: round(area.x + area.width / 2),
      y: round(area.y + area.height / 2),
      zoom: round(zoom),
      ratio: round(ratio * 1000) / 1000,
    });
  };

  // onCropComplete не спрацьовує на зміну повзунка до наступного руху —
  // підтягуємо zoom у чернетку напряму.
  useEffect(() => {
    setDraft((d) => (d ? { ...d, zoom: round(zoom) } : d));
  }, [zoom]);

  return (
    <Sheet open onClose={onClose} title="Кадрування зображення">
      <div className="flex flex-col gap-4">
        {loadError ? (
          <p className="text-sm text-danger">Не вдалось завантажити зображення.</p>
        ) : !ratio ? (
          <p className="py-16 text-center text-sm text-text-dim">Завантаження...</p>
        ) : (
          <>
            <div className="relative h-72 w-full overflow-hidden rounded-lg bg-black">
              <Cropper
                image={src}
                crop={position}
                zoom={zoom}
                maxZoom={MAX_CROP_ZOOM}
                aspect={aspect}
                onCropChange={setPosition}
                onZoomChange={setZoom}
                onCropComplete={handleCropComplete}
                initialCroppedAreaPercentages={initialArea.current}
                showGrid={false}
                zoomWithScroll
              />
            </div>

            <label className="flex items-center gap-3 text-text-dim">
              <ZoomOut size={16} className="shrink-0" />
              <input
                type="range" min={1} max={MAX_CROP_ZOOM} step={0.01}
                value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-accent" aria-label="Наближення"
              />
              <ZoomIn size={16} className="shrink-0" />
            </label>

            {draft && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Як виглядатиме</p>
                <div className="flex flex-wrap items-end gap-3">
                  {PREVIEW_SHAPES.map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1">
                      <div className={`${s.className} overflow-hidden rounded border border-border bg-bg`}>
                        <CroppedImage src={src} crop={draft} />
                      </div>
                      <span className="text-[0.65rem] text-text-dim">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => onSave(draft)} disabled={!draft}>Зберегти кадр</Button>
          <Button type="button" variant="ghost" onClick={() => onSave(null)}>Скинути</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Скасувати</Button>
        </div>
      </div>
    </Sheet>
  );
}
