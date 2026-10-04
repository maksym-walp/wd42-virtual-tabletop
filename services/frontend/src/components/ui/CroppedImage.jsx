import { useLayoutEffect, useRef, useState } from 'react';

// Зображення запису, обрізане під форму контейнера з урахуванням кадру
// користувача (image_crop: { x, y, zoom, ratio } — див. ImageCropDialog).
// Заповнює батьківський блок (той задає форму: aspect-[4/3], h-24 w-24...).
//
// Кадр зберігається незалежно від форми, тож той самий image_crop працює і для
// карток 4:3, і для банера 16:9, і для квадратного портрета:
//   1. базова область — найбільший прямокутник форми контейнера, що влазить у
//      зображення (як object-fit: cover);
//   2. zoom зменшує її (наближення);
//   3. область центрується на точці x/y і зсувається, щоб не вийти за край.
// Ця сама логіка в react-easy-crop, тож у формі редактора результат збігається
// з тим, що користувач бачив під час кадрування.
export function cropRegion(crop, containerAspect) {
  const { ratio, zoom } = crop;
  const baseW = containerAspect > ratio ? ratio : containerAspect;
  const baseH = containerAspect > ratio ? ratio / containerAspect : 1;
  const w = baseW / zoom;
  const h = baseH / zoom;
  const clamp = (v, max) => Math.min(Math.max(v, 0), max);
  const left = clamp((crop.x / 100) * ratio - w / 2, ratio - w);
  const top = clamp(crop.y / 100 - h / 2, 1 - h);
  // Усе в одиницях, де висота зображення = 1, а ширина = ratio.
  return { left, top, w, h };
}

export default function CroppedImage({ src, crop, alt = '', loading, className = '' }) {
  const boxRef = useRef(null);
  const [aspect, setAspect] = useState(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || !crop) return undefined;
    const measure = () => {
      const { width, height } = box.getBoundingClientRect();
      if (width > 0 && height > 0) setAspect(width / height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [crop]);

  let style;
  if (crop && aspect) {
    const { left, top, w, h } = cropRegion(crop, aspect);
    style = {
      position: 'absolute',
      maxWidth: 'none',
      width: `${(crop.ratio / w) * 100}%`,
      height: `${(1 / h) * 100}%`,
      left: `${(-left / w) * 100}%`,
      top: `${(-top / h) * 100}%`,
    };
  } else if (crop) {
    // До першого виміру — хоча б фокус на потрібній точці.
    style = { objectPosition: `${crop.x}% ${crop.y}%` };
  }

  return (
    <div ref={boxRef} className={`relative h-full w-full overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        loading={loading}
        draggable={false}
        className={crop && aspect ? '' : 'h-full w-full object-cover'}
        style={style}
      />
    </div>
  );
}
