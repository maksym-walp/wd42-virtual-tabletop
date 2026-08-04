import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';

const SHOW_THRESHOLD = 400;

// Global, not per-page: #app-scroll is the one shared scroll container (see
// scrollLock.js), so a single listener here covers every route for free.
// Pages that don't actually scroll #app-scroll (SkillTree's canvas, MapView's
// Leaflet map) just never cross the threshold and the button stays hidden.
export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const el = document.getElementById('app-scroll');
    if (!el) return undefined;
    const onScroll = () => setVisible(el.scrollTop > SHOW_THRESHOLD);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pathname]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => document.getElementById('app-scroll')?.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Прокрутити нагору"
      // Opposite corner from the catalog "+" FAB (right-4) on mobile and from
      // DiceWidget's floating trigger (left-4) on desktop, so neither overlaps.
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface text-text-dim shadow-lg md:bottom-6 md:left-auto md:right-6"
    >
      <ArrowUp size={20} strokeWidth={2} />
    </button>
  );
}
