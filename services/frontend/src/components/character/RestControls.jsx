import { useState } from 'react';
import { Coffee, Moon, Bed, Hourglass, ChevronDown } from 'lucide-react';
import characterApi from '../../api/characterSheet';
import Sheet from '../ui/Sheet';
import Button from '../ui/Button';

// Відпочинок персонажа: кнопки трьох форм, підтвердження, вибір стану (коли
// сервер відповідає choice_required) і модалка результату. Усе, що саме
// відновлюється, рахує character-sheet (POST /:id/rest); тут лише показ.
// Спільне для листа персонажа й Ширми майстра: одна кнопка зі спадним
// списком і підказкою, що дасть кожна форма.

export const REST_KINDS = [
  { key: 'short', label: 'Перепочинок', hint: '≈ 4 год; таймер діяльності не скидає', Icon: Coffee },
  { key: 'full', label: 'Повноцінний відпочинок', hint: '≈ 12 год; скидає таймер діяльності', Icon: Moon },
  { key: 'long', label: 'Довготривале відновлення', hint: '≈ тиждень; відновлює все', Icon: Bed },
];

const DEFAULT_LABELS = { fatigue: 'Втома', illness: 'Хвороба', trauma: 'Травма' };

export function formatCheck(check, labels = DEFAULT_LABELS) {
  const fatigue = labels.fatigue ?? 'Втома';
  if (check.skipped) return `${check.threshold} год: без перевірки (непритомний)`;
  const roll = check.die ? `${check.die} = ${check.roll}` : 'без кубика = 0';
  const outcome = check.success ? 'успіх' : `провал, ${fatigue} ${check.fatigue_before} → ${check.fatigue_after}`;
  return `${check.threshold} год: ${roll} проти ${check.difficulty} — ${outcome}`;
}

const formatDate = (iso) => (iso ? new Date(iso).toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' }) : '');

function RestSummary({ result, labels }) {
  const rows = [];
  rows.push(['Тривалість', `≈ ${result.duration_hours} год`]);
  if (result.hours_added) rows.push(['Таймер діяльності', `+${result.hours_added} год`]);
  if (result.timer_reset) rows.push(['Таймер діяльності', 'скинуто']);
  rows.push(['Здоровʼя', `${result.hp.before} → ${result.hp.after} (макс ${result.hp.max})`]);
  rows.push(['Магічна енергія', `${result.magic.before} → ${result.magic.after} (макс ${result.magic.max})`]);
  for (const r of result.conditions_removed ?? []) {
    rows.push(['Знято', `${labels[r.type] ?? r.type} ${r.from} → ${r.to}`]);
  }
  if (result.heroic_restored) rows.push(['Героїчні дії', `+${result.heroic_restored}`]);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        {rows.map(([k, v], i) => (
          <div key={i} className="contents">
            <dt className="text-text-dim">{k}</dt>
            <dd className="font-semibold text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {result.rolls?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gold">Кидки</p>
          <ul className="flex flex-col gap-0.5">
            {result.rolls.map((r, i) => (
              <li key={i}>
                {r.label}: <span className="font-mono">{r.formula}</span> → [{r.rolls.map((d) => d.join('/')).join(', ')}] = <b>{r.total}</b>
              </li>
            ))}
          </ul>
        </div>
      )}
      {result.fatigue_checks?.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gold">Перевірки Витривалості</p>
          <ul className="flex flex-col gap-0.5">
            {result.fatigue_checks.map((c, i) => <li key={i}>{formatCheck(c, labels)}</li>)}
          </ul>
        </div>
      )}
      {result.notes?.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-xs text-text-dim">
          {result.notes.map((n, i) => <li key={i}>• {n}</li>)}
        </ul>
      )}
    </div>
  );
}

export function RestResultModal({ result, characterName, labels = DEFAULT_LABELS, onClose }) {
  if (!result) return null;
  return (
    <Sheet open onClose={onClose} title={`${result.label}${characterName ? ` · ${characterName}` : ''}`}>
      {result.by?.username && (
        <p className="mb-3 text-xs text-text-dim">Натиснув: {result.by.username} · {formatDate(result.at)}</p>
      )}
      <RestSummary result={result} labels={labels} />
      <Button className="mt-4 w-full" onClick={onClose}>Зрозуміло</Button>
    </Sheet>
  );
}

// Блок «Останній відпочинок» — бачать і власник, і ГМ.
export function LastRestBlock({ lastRest, labels = DEFAULT_LABELS }) {
  const [open, setOpen] = useState(false);
  if (!lastRest) return <p className="text-xs text-text-dim">Відпочинків ще не було.</p>;
  return (
    <div className="text-xs text-text-dim">
      <button type="button" className="text-left hover:text-text" onClick={() => setOpen(true)}>
        <span className="font-semibold text-text">{lastRest.label}</span> · {formatDate(lastRest.at)}
        {lastRest.by?.username && <> · {lastRest.by.username}</>}
        <span className="block">
          ХП {lastRest.hp.before} → {lastRest.hp.after}, енергія {lastRest.magic.before} → {lastRest.magic.after}
          {lastRest.conditions_removed?.length > 0 && `, знято: ${lastRest.conditions_removed.map((r) => `${labels[r.type] ?? r.type} ${r.from}→${r.to}`).join(', ')}`}
        </span>
      </button>
      {open && <RestResultModal result={lastRest} labels={labels} onClose={() => setOpen(false)} />}
    </div>
  );
}

// Блок «Таймер діяльності» (лише читання): змінює його ГМ на Ширмі.
export function ActivityTimer({ timer }) {
  if (!timer) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="inline-flex items-center gap-1 text-text-dim"><Hourglass size={13} /> Таймер діяльності</span>
      <span className="font-semibold text-text">{timer.hours} год</span>
      <span className="text-xs text-text-dim">наступна перевірка Витривалості — {timer.next_check_at} год</span>
    </div>
  );
}

// Одна кнопка відпочинку зі спадним списком трьох форм. Що дасть кожна
// форма зараз, показує підказка при наведенні (або фокусі) — її рахує
// character-sheet (GET /:id/rest/preview), без кидків. Вибір пункту відкриває
// підтвердження (і вибір стану, коли сервер відповідає choice_required).
// onRested(data) — { result, character, effects, timer, potions }.
export default function RestControls({ characterId, characterName, labels = DEFAULT_LABELS, onRested }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [pending, setPending] = useState(null); // kind на підтвердженні
  const [options, setOptions] = useState(null); // choice_required
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const loadPreview = () => {
    setPreview(null);
    setPreviewError(false);
    characterApi.restPreview(characterId).then(setPreview).catch(() => setPreviewError(true));
  };

  const openMenu = () => {
    setMenuOpen((v) => !v);
    setHovered(null);
    loadPreview();
  };

  const close = () => { setPending(null); setOptions(null); setError(''); };

  const choose = (kind) => {
    setMenuOpen(false);
    setPending(kind);
  };

  const run = async (kind, choice) => {
    setBusy(true);
    setError('');
    try {
      const data = await characterApi.rest(characterId, kind, choice ? { condition: choice } : undefined);
      close();
      setResult(data.result);
      await onRested?.(data);
    } catch (err) {
      const body = err.response?.data;
      if (body?.code === 'choice_required') setOptions(body.options);
      else setError(body?.message || 'Не вдалося відпочити');
    } finally {
      setBusy(false);
    }
  };

  const pendingKind = REST_KINDS.find((k) => k.key === pending);
  const hoveredPreview = hovered && preview?.[hovered];

  return (
    <>
      <div className="relative">
        <button type="button" title="Відпочинок" aria-label="Відпочинок" aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={openMenu}
          className="flex h-8 items-center justify-center gap-1 rounded border border-border px-2 text-xs text-text-dim hover:bg-surface-hover hover:text-accent">
          <Moon size={15} /><span className="hidden sm:inline">Відпочинок</span><ChevronDown size={13} />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface p-1 shadow-lg">
              {REST_KINDS.map(({ key, label, hint, Icon }) => (
                <button key={key} type="button" role="menuitem"
                  onMouseEnter={() => setHovered(key)} onFocus={() => setHovered(key)}
                  onClick={() => choose(key)}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm ${hovered === key ? 'bg-surface-hover' : ''}`}>
                  <Icon size={15} className="mt-0.5 shrink-0 text-accent" />
                  <span className="min-w-0">
                    <span className="block font-semibold text-text">{label}</span>
                    <span className="block text-xs text-text-dim">{hint}</span>
                  </span>
                </button>
              ))}
              <div className="mt-1 border-t border-border px-2.5 py-2 text-xs">
                {!hovered ? (
                  <p className="m-0 text-text-dim">Наведіть на форму відпочинку, щоб побачити, що вона дасть.</p>
                ) : previewError ? (
                  <p className="m-0 text-danger">Не вдалося отримати підказку.</p>
                ) : !hoveredPreview ? (
                  <p className="m-0 text-text-dim">Рахуємо…</p>
                ) : (
                  <PreviewLines preview={hoveredPreview} />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {pendingKind && (
        <Sheet open onClose={close} title={`${pendingKind.label}${characterName ? ` · ${characterName}` : ''}`}>
          {preview?.[pendingKind.key] ? (
            <div className="mb-4 text-sm"><PreviewLines preview={preview[pendingKind.key]} /></div>
          ) : (
            <p className="mb-4 text-sm text-text-dim">{pendingKind.hint}.</p>
          )}
          {options ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-text">Який стан зняти на 1 рівень?</p>
              {options.map((o) => (
                <Button key={o} variant="ghost" disabled={busy} onClick={() => run(pendingKind.key, o)}>
                  {labels[o] ?? o}
                </Button>
              ))}
            </div>
          ) : (
            <Button className="w-full" disabled={busy} onClick={() => run(pendingKind.key)}>
              {busy ? 'Відпочиваємо…' : 'Відпочити'}
            </Button>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </Sheet>
      )}

      {result && (
        <RestResultModal result={result} characterName={characterName} labels={labels} onClose={() => setResult(null)} />
      )}
    </>
  );
}

function PreviewLines({ preview }) {
  return (
    <div>
      <p className="m-0 mb-1 font-semibold text-text">≈ {preview.duration_hours} год</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-text-muted">
        {preview.lines.map((line, i) => <li key={i}>• {line}</li>)}
      </ul>
    </div>
  );
}
