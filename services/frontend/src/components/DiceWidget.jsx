import { Dices } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDice } from '../context/DiceContext';
import Sheet from './ui/Sheet';
import DicePanel from './DicePanel';

export default function DiceWidget() {
  const { user } = useAuth();
  const { isOpen, toggle, close, inlinePanelActive } = useDice();

  if (!user) return null;

  return (
    <>
      {/* Mobile has a dedicated "Кубики" tab in BottomNav instead — the
          floating trigger would otherwise overlap the bottom nav bar.
          Поки на сторінці є вбудована панель (лист персонажа на десктопі),
          кнопка зайва — кидки й так видно в ній. */}
      {!inlinePanelActive && (
        <button
          type="button"
          onClick={toggle}
          aria-label="Кинути кубики"
          className="fixed left-4 bottom-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:flex"
        >
          <Dices size={26} />
        </button>
      )}

      <Sheet open={isOpen} onClose={close} title="Кидок кубиків">
        <DicePanel />
      </Sheet>
    </>
  );
}
