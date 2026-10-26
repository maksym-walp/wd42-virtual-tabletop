import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ShareButton from '../ShareButton';
import SmartTextReader from '../SmartTextReader';

// Висота згорнутого опису (≈ 2 рядки).
const COLLAPSED_PX = 44;

// Опис займає два рядки; довший — розгортається за кнопкою.
function CampaignDescription({ text }) {
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
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-0.5 text-xs text-accent hover:underline">
          {open ? 'Згорнути' : 'Показати повністю'}
        </button>
      )}
    </div>
  );
}

// Компактна шапка кампанії: назва, нікнейм майстра й короткий опис.
// Код запрошення живе в Налаштуваннях.
export default function CampaignHeader({ campaign }) {
  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <Link to="/campaigns" aria-label="До списку кампаній" title="Кампанії"
          className="text-text-dim hover:text-accent">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-display text-2xl leading-tight text-accent">{campaign.name}</h1>
        <ShareButton />
        <span className="text-sm text-text-dim sm:ml-auto">
          Майстер: <span className="text-text">{campaign.gm_username}</span>
        </span>
      </div>
      {campaign.description && <CampaignDescription text={campaign.description} />}
    </header>
  );
}
