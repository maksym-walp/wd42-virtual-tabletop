import { useState } from 'react';
import { Dices, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDice } from '../context/DiceContext';
import Sheet from './ui/Sheet';
import Button from './ui/Button';
import Field, { inputClass } from './ui/Field';
import DiceResult from './DiceResult';
import {
  DIE_TYPES, MODE_BUTTONS, SPECIAL_OPTIONS,
  stripModifier, withModifier, addPlainDie, addWrappedDie, applyModeToFormula,
} from '../constants/dice';

const MODE_ACTIVE_STYLE = { dis: 'bg-danger text-bg', adv: 'bg-sage text-bg' };
const SPECIAL_KEYS = new Set(SPECIAL_OPTIONS.map((o) => o.key));

export default function DiceWidget() {
  const { user } = useAuth();
  const { isOpen, toggle, close, roll, rolling, error, lastRoll, recent } = useDice();
  const [mode, setMode] = useState('normal');
  const [modifier, setModifier] = useState(0);
  const [formulaInput, setFormulaInput] = useState('');
  const [specialOpen, setSpecialOpen] = useState(false);

  if (!user) return null;

  const handleClose = () => {
    setSpecialOpen(false);
    close();
  };

  // Applies a new roll-type mode to the formula; any non-"normal" mode
  // defaults its wrapper to d20 so the user doesn't have to pick a die too.
  const applyMode = (newMode) => {
    setFormulaInput((prev) => withModifier(applyModeToFormula(stripModifier(prev), mode, newMode), modifier));
    setMode(newMode);
  };

  const handleModeClick = (clicked) => applyMode(mode === clicked ? 'normal' : clicked);

  const handleSpecialSelect = (key) => {
    applyMode(key);
    setSpecialOpen(false);
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

      <Sheet open={isOpen} onClose={handleClose} title="Кидок кубиків">
        <div className="flex flex-col gap-4">
          {/* Row 1: mode + modifier */}
          <div className="flex items-start gap-2">
            <div className="relative flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex overflow-hidden rounded-lg border border-border">
                {MODE_BUTTONS.map(({ key, label }, i) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleModeClick(key)}
                    className={`min-w-0 flex-1 break-words px-1 py-2.5 text-[11px] font-semibold transition-colors sm:px-2 sm:text-xs ${i > 0 ? 'border-l border-border' : ''} ${
                      mode === key ? (MODE_ACTIVE_STYLE[key] || 'bg-accent text-bg') : 'bg-transparent text-text-dim hover:bg-surface-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSpecialOpen((o) => !o)}
                  aria-haspopup="true"
                  aria-expanded={specialOpen}
                  className={`flex min-w-0 flex-1 items-center justify-center gap-1 border-l border-border px-1 py-2.5 text-[11px] font-semibold transition-colors sm:px-2 sm:text-xs ${
                    SPECIAL_KEYS.has(mode) ? 'bg-accent text-bg' : 'bg-transparent text-text-dim hover:bg-surface-hover'
                  }`}
                >
                  <Sparkles size={14} />
                  {SPECIAL_KEYS.has(mode) && (
                    <span className="hidden truncate sm:inline">
                      {SPECIAL_OPTIONS.find((o) => o.key === mode)?.label}
                    </span>
                  )}
                </button>
              </div>

              {specialOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSpecialOpen(false)} />
                  <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                    {SPECIAL_OPTIONS.map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleSpecialSelect(key)}
                        className={`block w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${
                          mode === key ? 'bg-accent text-bg' : 'text-text hover:bg-surface-hover'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
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
