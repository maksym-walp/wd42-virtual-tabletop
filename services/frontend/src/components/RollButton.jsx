import { Dices } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDice } from '../context/DiceContext';

// Shared entry point for every "roll via the dice service" affordance in the
// app (spell/skill [[formula]] buttons, weapon damage, death saves, health
// dice, ...). By default it rolls through the shared dice widget so the
// result is visibly shown to the player in one consistent place. When the
// button sits right next to a field that will display the value itself
// (e.g. the d100 icon inside a money input), pass showWidget={false} so the
// roll happens silently and only onResult fires — no need to also pop the
// sheet open.
export default function RollButton({ formula, onResult, title, size = 14, className = '', disabled = false, children, showWidget = true, icon = true }) {
  const { user } = useAuth();
  const { roll, rollAndShow, rolling } = useDice();

  // Public/unauthenticated views (e.g. a shared character sheet) can't roll —
  // rolling requires an authed request and the widget isn't mounted.
  if (!user) return children ? <span className="font-semibold">{children}</span> : null;

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const result = await (showWidget ? rollAndShow(formula) : roll(formula).catch(() => {}));
    if (result) onResult?.(result);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || rolling}
      title={title ?? `Кинути ${formula}`}
      className={`inline-flex items-center justify-center gap-1 text-accent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {icon && <Dices size={size} />}
      {children}
    </button>
  );
}
