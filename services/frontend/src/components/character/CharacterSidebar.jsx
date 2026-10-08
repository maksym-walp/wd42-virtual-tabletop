import { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import { useDice } from '../../context/DiceContext';
import SmartTextarea from '../ui/SmartTextarea';
import SmartTextReader from '../SmartTextReader';
import DicePanel from '../DicePanel';

export function CharacterNotes({ c, is_owner, patchCharacter, rows = 10, fill = false }) {
  return (
    <section className={`flex flex-col rounded-lg border border-border bg-surface ${fill ? 'min-h-[9rem] flex-1' : 'min-h-0'}`}>
      <div className="border-b border-border bg-bg px-4 py-2">
        <h3 className="m-0 text-[0.78rem] font-bold uppercase tracking-wide text-gold">Нотатки гравця</h3>
      </div>
      {/* fill: редактор стискається разом із колонкою (коли під кубиками
          з'являється результат), а не вилазить поверх панелі кубиків. */}
      <div className={`min-h-0 px-3 py-3 ${fill ? `flex-1 ${is_owner ? 'overflow-hidden' : 'overflow-y-auto'}` : ''}`}>
        {is_owner ? (
          <SmartTextarea
            fill={fill}
            rows={fill ? 2 : rows}
            value={c.notes ?? ''}
            onChange={(e) => patchCharacter({ notes: e.target.value })}
            placeholder="Квести, контакти, важливі деталі..."
          />
        ) : c.notes ? (
          <SmartTextReader text={c.notes} className="text-sm text-text" />
        ) : (
          <p className="text-sm text-text-dim">Нотаток ще немає.</p>
        )}
      </div>
    </section>
  );
}

// Вбудована панель кубиків: поки вона змонтована, кидки з листа (навички,
// ініціатива, зброя...) показуються тут, а не в плаваючому вікні.
function InlineDice() {
  const { registerInlinePanel } = useDice();
  useEffect(() => registerInlinePanel(), [registerInlinePanel]);

  return (
    <section className="shrink-0 rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-1.5 border-b border-border bg-bg px-4 py-2">
        <Dices size={14} className="text-gold" />
        <h3 className="m-0 text-[0.78rem] font-bold uppercase tracking-wide text-gold">Кидок кубиків</h3>
      </div>
      <div className="p-3">
        <DicePanel compact />
      </div>
    </section>
  );
}

// Відступ липкої колонки від верху й низу видимої області.
const STICKY_GAP_PX = 16;

// Висота видимої області під навбаром: застосунок скролиться всередині
// #app-scroll, тож саме його висота — «екран» для липкої колонки.
function useViewportHeight(enabled) {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    if (!enabled) { setHeight(null); return undefined; }
    const el = document.getElementById('app-scroll');
    const measure = () => setHeight((el ? el.clientHeight : window.innerHeight) - STICKY_GAP_PX * 2);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [enabled]);
  return height;
}

// Права колонка листа на десктопі — видима на будь-якій вкладці. Займає всю
// висоту екрана: кубики притиснуті донизу, нотатки забирають решту місця.
export default function CharacterSidebar({ c, is_owner, patchCharacter, showDice }) {
  const height = useViewportHeight(showDice);
  return (
    <aside
      className={`flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start ${showDice ? 'xl:overflow-y-auto' : ''}`}
      style={showDice && height ? { height } : undefined}
    >
      <CharacterNotes c={c} is_owner={is_owner} patchCharacter={patchCharacter} rows={8} fill={showDice} />
      {showDice && <InlineDice />}
    </aside>
  );
}
