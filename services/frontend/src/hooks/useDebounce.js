import { useCallback, useRef } from 'react';

export default function useDebounce(fn, delay = 600) {
  const timer = useRef(null);
  return useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}
