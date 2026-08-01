// The app's real scrollable region is the `#app-scroll` div in App.jsx, not
// document.body (the layout never scrolls body itself) — so a fixed overlay
// (Sheet, Lightbox) must lock that element to actually stop iOS Safari from
// letting background content scroll/bleed through underneath it.
const SCROLL_CONTAINER_ID = 'app-scroll';

export function lockPageScroll() {
  const el = document.getElementById(SCROLL_CONTAINER_ID) || document.body;
  const previousOverflow = el.style.overflow;
  el.style.overflow = 'hidden';
  return () => { el.style.overflow = previousOverflow; };
}
