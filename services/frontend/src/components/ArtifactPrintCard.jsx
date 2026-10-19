import { useLayoutEffect, useRef } from 'react';
import { RARITIES, ARTIFACT_TYPE, CARD_W_MM, CARD_H_MM } from '../constants/artifacts';
import CroppedImage from './ui/CroppedImage';
import SmartTextReader from './SmartTextReader';

// Друк завжди на білому папері, тож картка не залежить від теми застосунку:
// перевизначаємо змінні "Пергаменту" локально, і Tailwind-класи (text-text,
// bg-surface...) усередині картки дають чорнило на пергаменті навіть у темній темі.
const PARCHMENT_VARS = {
  '--color-bg': '#f4efe4',
  '--color-surface': '#ede4ca',
  '--color-surface-hover': '#e1d6b0',
  '--color-border': '#5b440a',
  '--color-text': '#3b2d08',
  '--color-text-muted': '#6b5530',
  '--color-text-dim': '#7a6a45',
  '--color-accent': '#5b440a',
  '--color-gold': '#8a5a2b',
};

const MIN_FONT_PT = 5.5;
const MAX_FONT_PT = 8.5;

// Опис може бути довільної довжини, а картка — фіксована: зменшуємо кегль
// кроками, доки текст не влізе (нижче MIN_FONT_PT решта просто обрізається).
// Вміст TipTap монтується пізніше за перший рендер, тож перевіряємо ще й
// MutationObserver-ом та після завантаження шрифтів.
function useFitText(ref, deps) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const fit = () => {
      let size = MAX_FONT_PT;
      el.style.fontSize = `${size}pt`;
      while (el.scrollHeight > el.clientHeight + 1 && size > MIN_FONT_PT) {
        size -= 0.25;
        el.style.fontSize = `${size}pt`;
      }
    };

    fit();
    const observer = new MutationObserver(fit);
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function ArtifactPrintCard({ artifact }) {
  const bodyRef = useRef(null);
  useFitText(bodyRef, [artifact.description, artifact.image_url]);
  const rarity = RARITIES[artifact.rarity];

  return (
    <div
      className="flex flex-col overflow-hidden bg-bg text-text"
      style={{
        ...PARCHMENT_VARS,
        width: `${CARD_W_MM}mm`,
        height: `${CARD_H_MM}mm`,
        border: '0.5mm solid #5b440a',
        outline: '0.5mm solid #f4efe4',
        outlineOffset: '-1.5mm',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div className="flex items-center justify-between px-[3.5mm] pb-[0.5mm] pt-[3mm]">
        <span className="text-[5.5pt] font-bold uppercase tracking-widest text-text-muted">{ARTIFACT_TYPE.label}</span>
        {rarity && <span className="text-[5.5pt] font-bold uppercase tracking-widest text-gold">{rarity.label}</span>}
      </div>

      <h2 className="px-[3.5mm] font-display text-[12pt] font-bold leading-tight text-accent">{artifact.name}</h2>
      {artifact.creator && (
        <p className="px-[3.5mm] pt-[0.5mm] text-[6.5pt] italic leading-tight text-text-muted">Творець: {artifact.creator}</p>
      )}

      {artifact.image_url && (
        <div
          className="mx-[3.5mm] mt-[2mm] shrink-0 overflow-hidden"
          style={{ height: '44mm', border: '0.3mm solid #5b440a' }}
        >
          <CroppedImage src={artifact.image_url} crop={artifact.image_crop} alt={artifact.name} />
        </div>
      )}

      <div className="mx-[3.5mm] mt-[2mm] min-h-0 flex-1 overflow-hidden" ref={bodyRef} style={{ lineHeight: 1.3 }}>
        <SmartTextReader text={artifact.description} />
      </div>

      <div className="mx-[3.5mm] mb-[3mm] mt-[1.5mm] flex shrink-0 items-center justify-between border-t border-border pt-[1.2mm]">
        <span className="text-[6pt] uppercase tracking-wide text-text-muted">Ціна</span>
        <span className="font-display text-[9pt] font-bold text-accent">{artifact.price != null ? Number(artifact.price) : '—'}</span>
      </div>
    </div>
  );
}
