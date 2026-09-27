import { useEffect, useRef, useState } from 'react';
import { Check, Link2 } from 'lucide-react';

// Копіювання в буфер. navigator.clipboard є лише в безпечному контексті
// (https/localhost) — інакше старий шлях через тимчасовий textarea.
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(el);
  if (!ok) throw new Error('copy failed');
}

// Кнопка «Поділитися» біля назви запису: копіює посилання на сторінку.
// url — необов'язковий (напр. публічна адреса колекції/персонажа); типово —
// поточна адреса без query/hash. У застосунку, встановленому як PWA, адресного
// рядка немає — це єдиний спосіб дістати посилання.
export default function ShareButton({ url, className = '' }) {
  const [state, setState] = useState('idle'); // idle | copied | error
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const link = url || `${window.location.origin}${window.location.pathname}`;
    try {
      await copyText(link);
      setState('copied');
    } catch {
      // Не вдалося скопіювати — показуємо посилання, щоб скопіювати вручну.
      window.prompt('Скопіюй посилання:', link);
      setState('idle');
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 1500);
  };

  const copied = state === 'copied';
  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? 'Посилання скопійовано' : 'Скопіювати посилання'}
      aria-label={copied ? 'Посилання скопійовано' : 'Скопіювати посилання'}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md p-1.5 text-sm leading-none transition-colors ${
        copied ? 'text-sage' : 'text-text-dim hover:bg-surface-hover hover:text-accent'
      } ${className}`}
    >
      {copied ? <Check size={16} /> : <Link2 size={16} />}
      {copied && <span className="text-xs font-semibold">Скопійовано</span>}
    </button>
  );
}
