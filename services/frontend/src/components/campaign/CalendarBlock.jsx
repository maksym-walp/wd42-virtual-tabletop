import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Trash2, CalendarDays, Plus } from 'lucide-react';
import campaignApi from '../../api/campaigns';
import chronologyApi from '../../api/chronology';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { inputClass } from '../ui/Field';
import EmptyState from '../ui/EmptyState';
import CardOverlayButton from '../ui/CardOverlayButton';
import CalendarCard from '../chronology/CalendarCard';

// Links a campaign to one calendar (the chronology service's own custom
// calendars — see chronologyApi). This is the only entry point into
// /chronology/:id?campaign_id=... — without it ChronologyView never receives a
// campaign_id and so never shows the current-date UI (today highlight,
// "Сьогодні", "Встановити як поточну дату кампанії") at all.
// calendar_id/current_year/current_month_id/current_day are always sent
// together (see CampaignController.updateCurrentDate) — linking/unlinking a
// calendar here deliberately carries the existing date fields through
// unchanged, since the date only means something relative to its calendar.
export default function CalendarBlock({ campaign, isGm, onChange }) {
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState([]);
  const [linked, setLinked] = useState(null);
  const [pick, setPick] = useState('');
  // A player with no linked calendar has nothing to fetch and nothing to
  // show (see the early return below) — starting loading=false for them
  // skips a pointless "Завантаження..." flash before this section vanishes.
  const [loading, setLoading] = useState(isGm || Boolean(campaign.calendar_id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isGm && !campaign.calendar_id) return undefined;
    let alive = true;
    setLoading(true);
    // GM: full list, to both offer as picker options and resolve the linked
    // calendar's name. Player: just the one linked calendar (if any) — visible
    // to them the same way the calendar service already gates it (own/public/admin).
    const task = isGm
      ? chronologyApi.list()
      : chronologyApi.getOne(campaign.calendar_id).then((c) => [c]);
    task
      .then((list) => {
        if (!alive) return;
        setCalendars(isGm ? list : []);
        setLinked(list.find((c) => c.id === campaign.calendar_id) || null);
      })
      .catch(() => {
        if (!alive) return;
        // For a GM the list itself is the actionable picker — worth an error.
        // For a player this only means "can't preview the name" — the link
        // still works (or fails on its own terms once they open it), so
        // failing silently here beats an alarming error over a cosmetic gap.
        if (isGm) setError('Не вдалось завантажити календарі');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isGm, campaign.calendar_id]);

  const handleLink = async () => {
    if (!pick) return;
    setSaving(true);
    setError('');
    try {
      const updated = await campaignApi.updateCurrentDate(campaign.id, {
        calendar_id: pick,
        current_year: campaign.current_year,
        current_month_id: campaign.current_month_id,
        current_day: campaign.current_day,
      });
      onChange((prev) => ({ ...prev, ...updated }));
      setPick('');
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось привʼязати календар');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setError('');
    try {
      const updated = await campaignApi.updateCurrentDate(campaign.id, {
        calendar_id: null, current_year: null, current_month_id: null, current_day: null,
      });
      onChange((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось відвʼязати календар');
    }
  };

  // Nothing to show a player when the GM hasn't linked a calendar yet.
  if (!isGm && !campaign.calendar_id && !loading) return null;

  const viewHref = `/chronology/${campaign.calendar_id}?campaign_id=${campaign.id}`;

  return (
    <div>
      <h3 className="mb-2 font-display text-base text-text">Календар</h3>

      {isGm && !campaign.calendar_id && (
        <Card className="mb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Привʼязати календар</p>
          {calendars.length === 0 ? (
            <p className="text-sm text-text-dim">
              Немає доступних календарів. Створіть їх у розділі <Link to="/chronology" className="text-accent">Хронологія</Link>.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
              <select className={`${inputClass} min-w-0 flex-1`} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Оберіть календар…</option>
                {calendars.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button onClick={handleLink} disabled={!pick || saving}><Plus size={15} /> {saving ? 'Звʼязування…' : 'Привʼязати'}</Button>
            </div>
          )}
        </Card>
      )}

      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : campaign.calendar_id ? (
        <div className="sm:max-w-sm xl:max-w-none">
          {linked ? (
            <CalendarCard
              calendar={linked}
              to={viewHref}
              label="Поточна дата кампанії"
              date={campaign.current_year != null
                ? { year: campaign.current_year, monthId: campaign.current_month_id, day: campaign.current_day }
                : undefined}
              actions={isGm && (
                <CardOverlayButton label="Відвʼязати календар" danger onClick={handleUnlink}>
                  <Trash2 size={15} />
                </CardOverlayButton>
              )}
            />
          ) : (
            <Card className="cursor-pointer hover:border-accent/50" onClick={() => navigate(viewHref)}>
              <h3 className="flex items-center gap-2 font-display text-base text-text">
                <CalendarDays size={16} className="text-text-dim" /> Календар кампанії
              </h3>
            </Card>
          )}
        </div>
      ) : (
        <EmptyState icon="🗓️" title="До кампанії не привʼязано календар">
          {isGm ? 'Оберіть календар вище, щоб вести поточну дату кампанії.' : 'Майстер ще не привʼязав календар.'}
        </EmptyState>
      )}
    </div>
  );
}
