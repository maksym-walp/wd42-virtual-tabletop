import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useDice } from '../context/DiceContext';
import Sheet from './ui/Sheet';
import Button from './ui/Button';
import DiceResult from './DiceResult';
import { MODE_BUTTONS, SPECIAL_OPTIONS } from '../constants/dice';
import { applySituational, buildRollFormula, ROLL_MODE_LABELS } from '../utils/rollProfile';

// Єдине вікно кидка перевірки: гравець обирає, чи кидати разом з d20,
// яким режимом і з яким плоским модифікатором, і бачить, звідки взялася
// перевага чи перешкода. Живе в модулі кубиків, а не в листі персонажа:
// лист лише передає сюди готовий профіль (roll_profiles з character-sheet).
//
// Відкривається через useDice().requestRoll(config) — див. DiceContext.

const MODE_ACTIVE_STYLE = { dis: 'bg-danger text-bg', adv: 'bg-sage text-bg' };
const SPECIAL_KEYS = new Set(SPECIAL_OPTIONS.map((o) => o.key));

export default function RollDialog() {
  const { rollRequest, closeRollDialog, roll, rolling } = useDice();
  const profile = rollRequest?.profile;

  const [withD20, setWithD20] = useState(true);
  const [mode, setMode] = useState('normal');
  const [bonus, setBonus] = useState(0);
  const [chosen, setChosen] = useState([]);
  const [specialOpen, setSpecialOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Кожне відкриття починається з того, що порахував сервер: режим зі
  // станів і дерева, бонус звідти ж. Далі гравець може це перебити вручну.
  useEffect(() => {
    if (!rollRequest) return;
    setWithD20(profile?.d20 !== false);
    setMode(profile?.mode ?? 'normal');
    setBonus(profile?.bonus ?? 0);
    setChosen([]);
    setResult(null);
    setError('');
    setSpecialOpen(false);
  }, [rollRequest, profile]);

  if (!rollRequest) return null;

  const situational = profile?.situational ?? [];
  const effective = applySituational({ ...profile, mode, bonus }, chosen);
  const formula = buildRollFormula({ ...effective, withD20 });
  const disabled = profile?.disabled;

  const toggleSituational = (mod) => setChosen((prev) => (
    prev.some((m) => m.id === mod.id) ? prev.filter((m) => m.id !== mod.id) : [...prev, mod]
  ));

  const handleRoll = async () => {
    if (!formula) return;
    setError('');
    try {
      const rolled = await roll(formula);
      setResult(rolled);
      rollRequest.onResult?.(rolled);
      // Кидок із бойового трекера веде далі власний сценарій, тож
      // закриваємо вікно й не показуємо результат двічі.
      if (rollRequest.closeOnResult) closeRollDialog();
    } catch {
      setError('Не вдалося кинути кубики');
    }
  };

  // Ситуативні модифікатори могли змінити режим — показуємо підсумковий.
  const modeLabel = ROLL_MODE_LABELS[effective.mode] ?? effective.mode;
  const sources = [...(profile?.sources ?? []), ...(effective.extra_sources ?? [])];

  return (
    <Sheet open onClose={closeRollDialog} title={rollRequest.title}>
      <div className="flex flex-col gap-4">
        {disabled && (
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            {profile.disabled_reason || 'Цю перевірку зараз робити не можна'}
          </p>
        )}

        {/* Що кидаємо: повна перевірка чи лише кубик-модифікатор */}
        <div className="flex overflow-hidden rounded-lg border border-border">
          {[
            { key: true, label: 'd20 + кубик' },
            { key: false, label: 'лише кубик' },
          ].map(({ key, label }, i) => (
            <button
              key={label} type="button" onClick={() => setWithD20(key)}
              className={`flex-1 px-2 py-2.5 text-xs font-semibold transition-colors ${i > 0 ? 'border-l border-border' : ''} ${
                withD20 === key ? 'bg-accent text-bg' : 'bg-transparent text-text-dim hover:bg-surface-hover'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Тип кидка + плоский модифікатор — як у панелі кубиків */}
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex overflow-hidden rounded-lg border border-border">
              {MODE_BUTTONS.map(({ key, label }, i) => (
                <button
                  key={key} type="button" onClick={() => setMode(key)}
                  className={`min-w-0 flex-1 break-words px-1 py-2.5 text-[11px] font-semibold transition-colors sm:px-2 sm:text-xs ${i > 0 ? 'border-l border-border' : ''} ${
                    mode === key ? (MODE_ACTIVE_STYLE[key] || 'bg-accent text-bg') : 'bg-transparent text-text-dim hover:bg-surface-hover'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button" onClick={() => setSpecialOpen((o) => !o)}
                aria-expanded={specialOpen} title="Спеціальні режими кидка"
                className={`flex w-10 flex-none shrink-0 items-center justify-center border-l border-border py-2.5 transition-colors ${
                  SPECIAL_KEYS.has(mode) ? 'bg-accent text-bg' : 'bg-transparent text-text-dim hover:bg-surface-hover'
                }`}
              >
                <Sparkles size={14} />
              </button>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="min-w-[24px] text-center text-sm font-semibold text-text">
              {bonus > 0 ? `+${bonus}` : bonus}
            </span>
            <div className="flex w-8 flex-col divide-y divide-border overflow-hidden rounded border border-border">
              <button
                type="button" onClick={() => setBonus((b) => b + 1)}
                className="flex h-[19px] items-center justify-center bg-surface-hover text-xs leading-none text-text hover:bg-border"
              >+</button>
              <button
                type="button" onClick={() => setBonus((b) => b - 1)}
                className="flex h-[19px] items-center justify-center bg-surface-hover text-xs leading-none text-text hover:bg-border"
              >−</button>
            </div>
          </div>
        </div>

        {/* Спеціальні режими (1.1.5) розкриваються в потоці, а не накладкою:
            Sheet має власне прокручування, тож накладка обрізалася б його
            краєм — і частину списку не було б видно. */}
        {specialOpen && (
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border bg-bg p-1.5">
            {SPECIAL_OPTIONS.map(({ key, label }) => (
              <button
                key={key} type="button"
                onClick={() => { setMode(key); setSpecialOpen(false); }}
                className={`rounded px-2 py-2 text-xs font-semibold transition-colors ${
                  mode === key ? 'bg-accent text-bg' : 'text-text hover:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Ситуативні модифікатори вузлів: діють не завжди, тож вмикає гравець */}
        {situational.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Ситуативне</span>
            {situational.map((mod) => (
              <label key={mod.id} className="flex cursor-pointer items-start gap-2 text-sm text-text">
                <input
                  type="checkbox" className="mt-0.5"
                  checked={chosen.some((m) => m.id === mod.id)}
                  onChange={() => toggleSituational(mod)}
                />
                <span>
                  <span className="font-semibold">{mod.source}</span>
                  {mod.note && <span className="text-text-dim"> — {mod.note}</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* Чому саме такий режим — гравець має розуміти, що відбувається */}
        {sources.length > 0 && (
          <p className="text-xs text-text-dim">
            <span className="font-semibold">{modeLabel}</span>
            {effective.mode === 'normal' && sources.length > 1 && ' (фактори нівелювали одне одного)'}
            {': '}
            {sources.join('; ')}
          </p>
        )}

        <div className="flex items-center gap-2">
          <code className="flex-1 truncate rounded border border-border bg-bg px-2 py-1.5 text-sm text-text">
            {formula || '—'}
          </code>
          <Button onClick={handleRoll} disabled={!formula || rolling || disabled}>
            {rolling ? 'Кидаємо…' : 'Кинути'}
          </Button>
        </div>

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}
        {result && <DiceResult roll={result} />}
      </div>
    </Sheet>
  );
}
