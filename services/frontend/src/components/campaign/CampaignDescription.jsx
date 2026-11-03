import { useLayoutEffect, useRef, useState } from 'react';
import SmartTextReader from '../SmartTextReader';

// Висота згорнутого опису (≈ 2 рядки).
const COLLAPSED_PX = 44;

// Опис займає два рядки; довший — розгортається за кнопкою.
export default function CampaignDescription({ text }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    if (ref.current) setOverflows(ref.current.scrollHeight > COLLAPSED_PX + 2);
  }, [text]);

  return (
    <div className="mt-1.5">
      <div
        ref={ref}
        className="overflow-hidden text-sm text-text-dim"
        style={open ? undefined : { maxHeight: COLLAPSED_PX }}
      >
        <SmartTextReader text={text} className="text-sm" />
      </div>
      {overflows && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="mt-0.5 text-xs text-accent hover:underline"
        >
          {open ? 'Згорнути' : 'Показати повністю'}
        </button>
      )}
    </div>
  );
}
