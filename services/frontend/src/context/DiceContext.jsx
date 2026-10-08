import { createContext, useCallback, useContext, useRef, useState } from 'react';
import diceApi from '../api/dice';

const DiceContext = createContext(null);
const MAX_RECENT = 10;

export function DiceProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [lastRoll, setLastRoll] = useState(null);
  const [recent, setRecent] = useState([]);
  // Скільки вбудованих панелей (DicePanel поза Sheet) зараз змонтовано —
  // поки є хоч одна, rollAndShow не відкриває плаваючий Sheet: результат
  // і так видно у вбудованій панелі.
  const inlinePanels = useRef(0);
  // Чернетка панелі кубиків (режим, модифікатор, формула) живе тут, а не в
  // DicePanel: Sheet розмонтовує вміст при закритті, а формула має
  // лишатися між відкриттями й бути спільною для плаваючої та вбудованої панелі.
  const [mode, setMode] = useState('normal');
  const [modifier, setModifier] = useState(0);
  const [formulaInput, setFormulaInput] = useState('');
  const [inlinePanelActive, setInlinePanelActive] = useState(false);

  const registerInlinePanel = useCallback(() => {
    inlinePanels.current += 1;
    setInlinePanelActive(true);
    setIsOpen(false);
    return () => {
      inlinePanels.current -= 1;
      setInlinePanelActive(inlinePanels.current > 0);
    };
  }, []);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((v) => !v);

  const roll = async (formula) => {
    setRolling(true);
    setError('');
    try {
      const result = await diceApi.roll(formula);
      setLastRoll(result);
      setRecent((r) => [result, ...r].slice(0, MAX_RECENT));
      return result;
    } catch (e) {
      setError(e.response?.data?.message || 'Не вдалося кинути кубики');
      throw e;
    } finally {
      setRolling(false);
    }
  };

  // Used by [[formula]] buttons embedded in spell/skill text: open the
  // widget so the result is visible, then roll.
  const rollAndShow = (formula) => {
    if (inlinePanels.current === 0) open();
    return roll(formula).catch(() => {});
  };

  const clearRecent = () => {
    setRecent([]);
    setLastRoll(null);
  };

  return (
    <DiceContext.Provider
      value={{
        isOpen, open, close, toggle, rolling, error, lastRoll, recent, roll, rollAndShow, clearRecent,
        inlinePanelActive, registerInlinePanel,
        mode, setMode, modifier, setModifier, formulaInput, setFormulaInput,
      }}
    >
      {children}
    </DiceContext.Provider>
  );
}

export const useDice = () => useContext(DiceContext);
