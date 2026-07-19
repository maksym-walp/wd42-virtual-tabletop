import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Повноекранний перегляд зображень. Окремий від Sheet: той обмежений
 * sm:max-w-md із внутрішнім падингом, що для зображення на весь екран
 * неправильно, і не обробляє Escape.
 *
 * images — масив URL; одиничні виклики передають [url].
 */
export default function Lightbox({ images = [], index = 0, onClose }) {
  const [current, setCurrent] = useState(index);

  // Синхронізуємо, коли відкривають інше зображення того ж набору.
  useEffect(() => setCurrent(index), [index]);

  const count = images.length;

  useEffect(() => {
    if (!count) return undefined;

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      else if (e.key === 'ArrowLeft') setCurrent((i) => (i - 1 + count) % count);
      else if (e.key === 'ArrowRight') setCurrent((i) => (i + 1) % count);
    };

    document.addEventListener('keydown', onKeyDown);
    // Фон не має скролитися під оверлеєм.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [count, onClose]);

  if (!count) return null;

  const go = (delta) => (e) => {
    e.stopPropagation();
    setCurrent((i) => (i + delta + count) % count);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Перегляд зображення"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Закрити"
        className="absolute right-3 top-3 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <X size={24} />
      </button>

      {count > 1 && (
        <>
          <button
            onClick={go(-1)}
            aria-label="Попереднє зображення"
            className="absolute left-2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white sm:left-4"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={go(1)}
            aria-label="Наступне зображення"
            className="absolute right-2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white sm:right-4"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      <img
        src={images[current]}
        alt=""
        className="max-h-[90vh] max-w-[92vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {count > 1 && (
        <div className="absolute bottom-4 rounded-full bg-black/50 px-3 py-1 text-xs text-white/80">
          {current + 1} / {count}
        </div>
      )}
    </div>
  );
}
