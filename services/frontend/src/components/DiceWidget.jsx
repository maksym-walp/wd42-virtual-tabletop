import { useState } from 'react';
import { Dices } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDice } from '../context/DiceContext';
import Sheet from './ui/Sheet';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';
import DiceResult from './DiceResult';
import {
  DIE_TYPES, MODE_BUTTONS, DOUBLE_OF, DOUBLE_CLICK_HINT, nextMode,
  stripModifier, withModifier, addPlainDie, addWrappedDie, applyModeToFormula,
} from '../constants/dice';

const MODE_ACTIVE_STYLE = { dis: 'bg-danger text-bg', adv: 'bg-sage text-bg' };

export default function DiceWidget() {
  const { user } = useAuth();
  const { isOpen, toggle, close, roll, rolling, error, lastRoll, recent } = useDice();
  const [mode, setMode] = useState('normal');
  const [modifier, setModifier] = useState(0);
  const [formulaInput, setFormulaInput] = useState('');

  if (!user) return null;

  const handleModeClick = (clicked) => {
    const newMode = nextMode(mode, clicked);
    setFormulaInput((prev) => withModifier(applyModeToFormula(stripModifier(prev), mode, newMode), modifier));
    setMode(newMode);
  };

  const handleDieClick = (sides) => {
    setFormulaInput((prev) => {
      const base = stripModifier(prev);
      const next = mode === 'normal' ? addPlainDie(base, sides) : addWrappedDie(base, mode, sides);
      return withModifier(next, modifier);
    });
  };

  const changeModifier = (delta) => {
    const next = modifier + delta;
    setModifier(next);
    setFormulaInput((prev) => withModifier(stripModifier(prev), next));
  };

  const handleClear = () => setFormulaInput('');

  const handleFormulaSubmit = (e) => {
    e.preventDefault();
    if (!formulaInput.trim()) return;
    roll(formulaInput.trim()).catch(() => {});
  };

  return (
    <>
      {/* Mobile has a dedicated "Кубики" tab in BottomNav instead — the
          floating trigger would otherwise overlap the bottom nav bar. */}
      <button
        type="button"
        onClick={toggle}
        aria-label="Кинути кубики"
        className="fixed left-4 bottom-6 z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-accent text-bg shadow-lg md:flex"
      >
        <Dices size={26} />
      </button>

      <Sheet open={isOpen} onClose={close} title="Кидок кубиків">
        <div className="flex flex-col gap-4">
          {/* Row 1: mode + modifier */}
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex overflow-hidden rounded-lg border border-border">
                {MODE_BUTTONS.map(({ key, label }, i) => {
                  const isDouble = DOUBLE_OF[key] && mode === DOUBLE_OF[key];
                  const active = mode === key || isDouble;
                  const hasDouble = Boolean(DOUBLE_OF[key]);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleModeClick(key)}
                      title={hasDouble ? DOUBLE_CLICK_HINT : undefined}
                      className={`min-w-0 flex-1 break-words px-1 py-2.5 text-[11px] font-semibold transition-colors sm:px-2 sm:text-xs ${i > 0 ? 'border-l border-border' : ''} ${
                        active ? (MODE_ACTIVE_STYLE[key] || 'bg-accent text-bg') : 'bg-transparent text-text-dim hover:bg-surface-hover'
                      }`}
                    >
                      {label}
                      {isDouble ? ' ×2' : ''}
                    </button>
                  );
                })}
              </div>
              {/* Desktop gets the hint as a native title tooltip on the adv/dis
                  buttons (no hover on touch); mobile shows it inline instead. */}
              <p className="px-0.5 text-[10px] leading-tight text-text-dim md:hidden">
                {DOUBLE_CLICK_HINT}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeModifier(-1)}
                className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text"
              >−</button>
              <span className="min-w-[28px] text-center text-sm font-semibold text-text">
                {modifier > 0 ? `+${modifier}` : modifier}
              </span>
              <button
                type="button"
                onClick={() => changeModifier(1)}
                className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface-hover text-text"
              >+</button>
            </div>
          </div>

          {/* Row 2: die types */}
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
            {DIE_TYPES.map((sides) => (
              <Button key={sides} variant="ghost" size="sm" onClick={() => handleDieClick(sides)}>
                d{sides}
              </Button>
            ))}
          </div>

          <form onSubmit={handleFormulaSubmit} className="flex flex-col gap-2">
            <Field label="Формула">
              <input
                type="text"
                className={inputClass}
                value={formulaInput}
                onChange={(e) => setFormulaInput(e.target.value)}
                placeholder="2d20+1d8+adv(1d10)-5"
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={rolling || !formulaInput.trim()}>
                {rolling ? 'Кидаємо...' : 'Кинути'}
              </Button>
              <Button type="button" variant="ghost" onClick={handleClear}>Очистити</Button>
            </div>
          </form>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}

          <DiceResult roll={lastRoll} />

          {recent.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recent.slice(1).map((r) => (
                <span
                  key={r.id}
                  className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-text-dim"
                >
                  {r.formula} = {r.total}
                </span>
              ))}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
