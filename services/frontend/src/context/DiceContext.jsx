import { createContext, useContext, useState } from 'react';
import diceApi from '../api/dice';

const DiceContext = createContext(null);
const MAX_RECENT = 10;

export function DiceProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState('');
  const [lastRoll, setLastRoll] = useState(null);
  const [recent, setRecent] = useState([]);

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
    open();
    return roll(formula).catch(() => {});
  };

  return (
    <DiceContext.Provider
      value={{ isOpen, open, close, toggle, rolling, error, lastRoll, recent, roll, rollAndShow }}
    >
      {children}
    </DiceContext.Provider>
  );
}

export const useDice = () => useContext(DiceContext);
