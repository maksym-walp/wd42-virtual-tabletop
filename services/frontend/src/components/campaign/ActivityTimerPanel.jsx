import { useState } from 'react';
import { Hourglass, X } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import Card from '../ui/Card';
import Button from '../ui/Button';
import RestControls, { LastRestBlock, formatCheck } from '../character/RestControls';

// Таймер діяльності персонажів кампанії (Ширма, лише ГМ). Години додає
// майстер; перевірки Витривалості й Втому рахує character-sheet, campaigns
// лише передає запит і розсилає 'characters'. Після додавання — сповіщення:
// хто отримав рівні Втоми і що випало.

const TIMER_STEPS = [1, 4, 8, 12];

export default function ActivityTimerPanel({ campaignId, characters, sheets, labels, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { ok, text }
  const [notifications, setNotifications] = useState([]);

  const advance = async (hours) => {
    setBusy(true);
    setStatus(null);
    try {
      const { results, notifications: got } = await campaignApi.advanceTimer(campaignId, hours);
      const applied = results.filter((r) => !r.skipped).length;
      setStatus({ ok: true, text: `+${hours} год · персонажів: ${applied}${got.length ? '' : ' · Втома без змін'}` });
      setNotifications(got);
      onChanged?.();
    } catch (err) {
      setStatus({ ok: false, text: err.response?.data?.message || 'Не вдалося додати години' });
    } finally {
      setBusy(false);
    }
  };

  // Відпочинок, натиснутий майстром: синхронізація ХП з боєм заодно
  // надсилає гравцеві real-time подію 'characters'.
  const handleRested = (characterId) => ({ character }) => {
    campaignApi.syncCombatantHp(characterId, { health: character.current_hp, temp_hp: character.temp_hp })
      .catch(() => campaignApi.notifyCharacter(characterId).catch(() => {}));
    onChanged?.();
  };

  const fatigue = labels.fatigue ?? 'Втома';

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3 className="m-0 inline-flex items-center gap-1.5 font-display text-lg text-text">
          <Hourglass size={16} /> Таймер діяльності
        </h3>
        <div className="flex flex-wrap items-center gap-2" title="Додати години таймера всім персонажам">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Час</span>
          {TIMER_STEPS.map((hours) => (
            <Button key={hours} variant="ghost" size="sm" disabled={busy} onClick={() => advance(hours)}>
              +{hours} год
            </Button>
          ))}
        </div>
      </div>
      {status && (
        <span role="status" className={`text-xs ${status.ok ? 'text-sage' : 'text-danger'}`}>{status.text}</span>
      )}

      {notifications.length > 0 && (
        <div className="relative rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm">
          <button type="button" aria-label="Закрити сповіщення" onClick={() => setNotifications([])}
            className="absolute right-2 top-2 rounded p-1 text-text-dim hover:text-text">
            <X size={14} />
          </button>
          <p className="mb-1 font-semibold text-danger">Отримали рівні «{fatigue}»</p>
          <ul className="flex flex-col gap-1.5">
            {notifications.map((n) => (
              <li key={n.character_id}>
                <b className="text-text">{n.name}</b>: {fatigue} {n.fatigue_before} → {n.fatigue_after}
                <ul className="pl-3 text-xs text-text-dim">
                  {n.checks.map((check, i) => <li key={i}>{formatCheck(check, labels)}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-border">
        {characters.map((entry) => {
          const sheet = sheets[entry.character_id];
          const timer = sheet?.timer;
          const conditions = (sheet?.character.conditions ?? []).filter((c) => c.level > 0);
          return (
            <li key={entry.character_id} className="flex flex-col gap-1.5 py-2.5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="m-0 truncate font-semibold text-text">{entry.character_name}</p>
                  {timer ? (
                    <p className="m-0 text-xs text-text-dim">
                      <b className="text-text">{timer.hours} год</b> · наступна перевірка — {timer.next_check_at} год
                    </p>
                  ) : (
                    <p className="m-0 text-xs text-text-dim">Завантаження…</p>
                  )}
                </div>
                {sheet && (
                  <RestControls characterId={entry.character_id} characterName={entry.character_name}
                    labels={labels} onRested={handleRested(entry.character_id)} />
                )}
              </div>
              {conditions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {conditions.map((c) => (
                    <span key={c.type} className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-[0.7rem] font-semibold text-danger">
                      {labels[c.type] ?? c.type} {c.level}
                    </span>
                  ))}
                </div>
              )}
              {sheet && <LastRestBlock lastRest={sheet.character.last_rest} labels={labels} />}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
