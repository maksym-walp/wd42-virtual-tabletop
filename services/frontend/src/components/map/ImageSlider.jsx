import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Lightbox from '../ui/Lightbox';

// Horizontal, swipeable image carousel (scroll-snap, one image per view) with
// prev/next buttons; tapping an image opens the fullscreen Lightbox.
export default function ImageSlider({ images = [] }) {
  const scrollRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  if (!images.length) return null;

  const scrollBy = (dir) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="relative">
      <div ref={scrollRef} className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-lg">
        {images.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setLightbox(i)}
            className="w-full shrink-0 snap-center"
            aria-label={`Зображення ${i + 1}`}
          >
            <img src={url} alt="" loading="lazy" className="h-48 w-full rounded-lg border border-border object-cover" />
          </button>
        ))}
      </div>

      {images.length > 1 && (
        <>
          <button type="button" onClick={() => scrollBy(-1)} aria-label="Попереднє" className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
            <ChevronLeft size={18} />
          </button>
          <button type="button" onClick={() => scrollBy(1)} aria-label="Наступне" className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
            <ChevronRight size={18} />
          </button>
          <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">
            {images.length} фото
          </div>
        </>
      )}

      {lightbox !== null && <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}
