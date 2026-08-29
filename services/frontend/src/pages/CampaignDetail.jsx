import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Trash2, Upload, Map, CalendarDays, Globe, Lock, Plus, LogOut, ArrowLeft } from 'lucide-react';
import campaignApi from '../api/campaigns';
import mapsApi from '../api/maps';
import chronologyApi from '../api/chronology';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import useDebounce from '../hooks/useDebounce';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import Lightbox from '../components/ui/Lightbox';
import Sheet from '../components/ui/Sheet';
import CombatTab from './CampaignCombat';

const TABS = [
  { key: 'home', label: 'Головна' },
  { key: 'combat', label: 'Бойова сцена' },
  { key: 'settings', label: 'Налаштування' },
];

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [campaign, setCampaign] = useState(null);
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('home');

  useEffect(() => {
    Promise.all([campaignApi.getOne(id), campaignApi.listCharacters(id)])
      .then(([c, chars]) => { setCampaign(c); setCharacters(chars); })
      .catch(() => setError('Не вдалось завантажити кампанію'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;
  if (error || !campaign) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="mb-4 text-danger">{error || 'Кампанію не знайдено'}</p>
        <Link to="/campaigns" className="text-sm text-accent">← До списку кампаній</Link>
      </div>
    );
  }

  const isGm = campaign.is_gm;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Кампанії
      </Link>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-accent">{campaign.name}</h1>
          {isGm && (
            <p className="mt-1 text-sm text-text-dim">
              Код запрошення: <span className="font-mono text-gold">{campaign.invite_code}</span>
            </p>
          )}
        </div>
        <Badge className={isGm ? 'bg-gold text-bg' : 'border border-border text-text-dim'}>
          {isGm ? 'Майстер' : 'Гравець'}
        </Badge>
      </div>

      <div className="mb-6 flex gap-2 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key}
            className={`rounded-t-lg border border-b-0 px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key ? 'border-gold/60 bg-gold/10 text-gold' : 'border-transparent text-text-dim'
            }`}
            onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <HomeTab campaign={campaign} characters={characters} isGm={isGm} navigate={navigate} onChange={setCampaign} />
      )}
      {tab === 'combat' && (
        <CombatTab campaignId={campaign.id} isGm={isGm} characters={characters} />
      )}
      {tab === 'settings' && (
        <SettingsTab
          campaign={campaign}
          isGm={isGm}
          onChange={setCampaign}
          characters={characters}
          setCharacters={setCharacters}
          navigate={navigate}
        />
      )}
    </div>
  );
}

// ================================================================
// Головна: опис + майстер, нотатки/сесії/приватні нотатки (карусель),
// мапи, галерея, персонажі кампанії.
// ================================================================

function HomeTab({ campaign, characters, isGm, navigate, onChange }) {
  return (
    <div className="flex flex-col gap-8">
      <CampaignAbout campaign={campaign} />
      <NotesCarousel campaign={campaign} isGm={isGm} onChange={onChange} />
      <CalendarBlock campaign={campaign} isGm={isGm} onChange={onChange} />
      <MapsBlock campaignId={campaign.id} isGm={isGm} />
      <CampaignGallery campaign={campaign} isGm={isGm} />
      <CharactersBlock characters={characters} navigate={navigate} />
    </div>
  );
}

function CampaignAbout({ campaign }) {
  return (
    <Card>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Майстер</p>
      <p className="mb-4 text-sm text-text">{campaign.gm_username}</p>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Опис кампанії</p>
      {campaign.description ? (
        <p className="whitespace-pre-wrap text-sm text-text">{campaign.description}</p>
      ) : (
        <p className="text-sm text-text-dim">Опису ще немає.</p>
      )}
    </Card>
  );
}

// Три картки — Спільні нотатки, Попередні сесії, Нотатки майстра — що
// гортаються горизонтальним скролом одна повз одну.
function NotesCarousel({ campaign, isGm, onChange }) {
  const [sharedNotes, setSharedNotes] = useState(campaign.shared_notes ?? '');
  const [gmNotes, setGmNotes] = useState(campaign.gm_notes ?? '');
  const [saving, setSaving] = useState(false);

  const saveShared = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateSharedNotes(campaign.id, value);
      onChange((prev) => ({ ...prev, shared_notes: updated.shared_notes }));
    } finally {
      setSaving(false);
    }
  });

  const saveGm = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateGmNotes(campaign.id, value);
      onChange((prev) => ({ ...prev, gm_notes: updated.gm_notes }));
    } finally {
      setSaving(false);
    }
  });

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="m-0 font-display text-base text-text">Нотатки</h3>
        {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <Card className="w-[85vw] max-w-sm shrink-0">
          <label className="mb-1 block text-xs text-text-dim">Спільні нотатки</label>
          <textarea
            className={`${inputClass} w-full resize-y`}
            rows={10}
            value={sharedNotes}
            onChange={(e) => { setSharedNotes(e.target.value); if (isGm) saveShared(e.target.value); }}
            placeholder="Нотатки, які бачать усі учасники кампанії..."
            disabled={!isGm}
          />
        </Card>

        <Card className="w-[85vw] max-w-sm shrink-0">
          <SessionsPanel campaignId={campaign.id} isGm={isGm} />
        </Card>

        {isGm && (
          <Card className="w-[85vw] max-w-sm shrink-0">
            <label className="mb-1 block text-xs text-text-dim">Нотатки майстра (лише для вас)</label>
            <textarea
              className={`${inputClass} w-full resize-y`}
              rows={10}
              value={gmNotes}
              onChange={(e) => { setGmNotes(e.target.value); saveGm(e.target.value); }}
              placeholder="Секретні нотатки, плани, сюжетні твісти..."
            />
          </Card>
        )}
      </div>
    </div>
  );
}

function SessionsPanel({ campaignId, isGm }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sheetSession, setSheetSession] = useState(null); // null=closed, {}=нова, {...}=перегляд/редагування

  useEffect(() => {
    let alive = true;
    campaignApi.listSessions(campaignId)
      .then((rows) => { if (alive) setSessions(rows); })
      .catch(() => { if (alive) setError('Не вдалось завантажити сесії'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId]);

  const refresh = () => campaignApi.listSessions(campaignId).then(setSessions);

  const handleDeleted = (sessionId) => {
    setSheetSession(null);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-xs text-text-dim">Попередні сесії</label>
        {isGm && (
          <button
            type="button"
            onClick={() => setSheetSession({})}
            aria-label="Додати сесію"
            className="p-1 text-text-dim hover:text-accent"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-text-dim">
          {isGm ? 'Додайте запис про минулу сесію.' : 'Майстер ще не додав записів про сесії.'}
        </p>
      ) : (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSheetSession(s)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left hover:border-accent/50"
              >
                <p className="truncate text-sm text-text">{s.title}</p>
                {s.session_date && <p className="text-xs text-text-dim">{s.session_date}</p>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <SessionSheet
        session={sheetSession}
        isGm={isGm}
        campaignId={campaignId}
        onClose={() => setSheetSession(null)}
        onSaved={() => { setSheetSession(null); refresh(); }}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function SessionSheet({ session, isGm, campaignId, onClose, onSaved, onDeleted }) {
  const isNew = !!session && !session.id;
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!session) return;
    setTitle(session.title ?? '');
    setContent(session.content ?? '');
    setDate(session.session_date ? String(session.session_date).slice(0, 10) : '');
    setError('');
  }, [session]);

  if (!session) return null;

  const handleSave = async () => {
    if (!title.trim()) { setError('Вкажіть назву сесії'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { title: title.trim(), content, session_date: date || null };
      if (isNew) await campaignApi.addSession(campaignId, payload);
      else await campaignApi.updateSession(campaignId, session.id, payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при збереженні сесії');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Видалити запис "${session.title}"?`)) return;
    try {
      await campaignApi.removeSession(campaignId, session.id);
      onDeleted(session.id);
    } catch {
      setError('Не вдалось видалити сесію');
    }
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Нова сесія' : (isGm ? 'Редагувати сесію' : session.title)}>
      {isGm ? (
        <div className="flex flex-col gap-4">
          <Field label="Назва">
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </Field>
          <Field label="Дата сесії (необовʼязково)">
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Опис / нотатки">
            <textarea className={`${inputClass} resize-y`} rows={6} value={content} onChange={(e) => setContent(e.target.value)} />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {!isNew && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                <Trash2 size={14} /> Видалити
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving} className="ml-auto">
              {saving ? 'Збереження...' : 'Зберегти'}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          {session.session_date && <p className="mb-2 text-xs text-text-dim">{session.session_date}</p>}
          <p className="whitespace-pre-wrap text-sm text-text">{session.content || 'Без опису.'}</p>
        </div>
      )}
    </Sheet>
  );
}

// Links a campaign to one calendar (the chronology service's own custom
// calendars — see chronologyApi). This is the only entry point into
// /chronology/:id?campaign_id=... — without it ChronologyView never receives a
// campaign_id and so never shows the current-date UI (today highlight,
// "Сьогодні", "Встановити як поточну дату кампанії") at all.
// calendar_id/current_year/current_month_id/current_day are always sent
// together (see CampaignController.updateCurrentDate) — linking/unlinking a
// calendar here deliberately carries the existing date fields through
// unchanged, since the date only means something relative to its calendar.
function CalendarBlock({ campaign, isGm, onChange }) {
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState([]);
  const [linkedName, setLinkedName] = useState('');
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
        setLinkedName(list.find((c) => c.id === campaign.calendar_id)?.name || '');
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
            <div className="flex gap-2">
              <select className={`${inputClass} flex-1`} value={pick} onChange={(e) => setPick(e.target.value)}>
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
        <Card className="cursor-pointer hover:border-accent/50" onClick={() => navigate(viewHref)}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-display text-base text-text">
              <CalendarDays size={16} className="text-text-dim" /> {linkedName || 'Календар кампанії'}
            </h3>
            {isGm && (
              <button onClick={(e) => { e.stopPropagation(); handleUnlink(); }} aria-label="Відвʼязати календар" className="shrink-0 text-text-dim hover:text-danger">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </Card>
      ) : (
        <EmptyState icon="🗓️" title="До кампанії не привʼязано календар">
          {isGm ? 'Оберіть календар вище, щоб вести поточну дату кампанії.' : 'Майстер ще не привʼязав календар.'}
        </EmptyState>
      )}
    </div>
  );
}

// Map "cards": links from a campaign to standalone maps (which live in the
// separate maps service). The GM links existing maps; players just follow them.
function MapsBlock({ campaignId, isGm }) {
  const navigate = useNavigate();
  const [cards, setCards] = useState([]);
  const [myMaps, setMyMaps] = useState([]);
  const [pick, setPick] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const tasks = [campaignApi.listMapCards(campaignId)];
    if (isGm) tasks.push(mapsApi.list());
    Promise.all(tasks)
      .then(([cardRows, maps]) => {
        if (!alive) return;
        setCards(cardRows);
        if (maps) setMyMaps(maps.filter((m) => m.is_owner));
      })
      .catch(() => { if (alive) setError('Не вдалось завантажити мапи кампанії'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaignId, isGm]);

  // Maps not yet linked, offered in the picker.
  const linkedIds = new Set(cards.map((c) => c.map_id));
  const available = myMaps.filter((m) => !linkedIds.has(m.id));

  const handleAdd = async () => {
    if (!pick) return;
    setError('');
    try {
      await campaignApi.addMapCard(campaignId, pick);
      const rows = await campaignApi.listMapCards(campaignId);
      setCards(rows);
      setPick('');
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати мапу');
    }
  };

  const handleRemove = async (cardId) => {
    const previous = cards;
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    try {
      await campaignApi.removeMapCard(campaignId, cardId);
    } catch {
      setCards(previous);
      setError('Не вдалось прибрати мапу');
    }
  };

  const renderCard = (card) => (
    <Card key={card.id} className="cursor-pointer hover:border-accent/50" onClick={() => navigate(`/maps/${card.map_id}?campaign_id=${campaignId}`)}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-base text-text">
          <Map size={16} className="text-text-dim" /> {card.map_name}
        </h3>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-text-dim" title={card.is_public ? 'Публічна' : 'Приватна'}>
            {card.is_public ? <Globe size={13} /> : <Lock size={13} />}
          </span>
          {isGm && (
            <button onClick={(e) => { e.stopPropagation(); handleRemove(card.id); }} aria-label="Прибрати мапу" className="text-text-dim hover:text-danger">
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <div>
      <h3 className="mb-2 font-display text-base text-text">Мапи</h3>
      {isGm && (
        <Card className="mb-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Додати посилання на мапу</p>
          {available.length === 0 ? (
            <p className="text-sm text-text-dim">
              Немає вільних мап. Створіть їх у розділі <Link to="/maps" className="text-accent">Мапи</Link>.
            </p>
          ) : (
            <div className="flex gap-2">
              <select className={`${inputClass} flex-1`} value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">Оберіть мапу…</option>
                {available.map((m) => <option key={m.id} value={m.id}>{m.name}{m.is_public ? '' : ' (приватна)'}</option>)}
              </select>
              <Button onClick={handleAdd} disabled={!pick}><Plus size={15} /> Додати</Button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : cards.length === 0 ? (
        <EmptyState icon="🗺" title="До кампанії не прив'язано жодної мапи">
          {isGm ? 'Додайте картку-посилання на створену мапу.' : 'Майстер ще не додав мап.'}
        </EmptyState>
      ) : cards.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {cards.map((card) => <div key={card.id} className="w-64 shrink-0">{renderCard(card)}</div>)}
        </div>
      ) : (
        renderCard(cards[0])
      )}
    </div>
  );
}

function CampaignGallery({ campaign, isGm }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    campaignApi.listGallery(campaign.id)
      .then((rows) => { if (alive) setImages(rows); })
      .catch(() => { if (alive) setError('Не вдалось завантажити галерею'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [campaign.id]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    setError('');
    setUploading(true);
    try {
      // Послідовно, а не Promise.all: так помилка на одному файлі не губить
      // уже завантажених, і порядок у стрічці лишається передбачуваним.
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          setError(`«${file.name}» завеликий — максимум 10 МБ`);
          continue;
        }
        const url = await mediaApi.upload(file, {
          entityType: 'campaign-gallery',
          entityId: campaign.id,
        });
        const image = await campaignApi.addGalleryImage(campaign.id, url);
        setImages((prev) => [image, ...prev]);
      }
    } catch (err) {
      setError(err.response?.data?.message ?? 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (imageId) => {
    const previous = images;
    setImages((prev) => prev.filter((i) => i.id !== imageId));
    try {
      await campaignApi.removeGalleryImage(campaign.id, imageId);
    } catch {
      setImages(previous);
      setError('Не вдалось видалити зображення');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 font-display text-base text-text">Галерея</h3>
        <div className="flex items-center gap-3">
          {uploading && <span className="text-xs text-text-dim">• Завантаження...</span>}
          {isGm && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload size={14} />
              Завантажити
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : images.length === 0 ? (
        <EmptyState icon="🖼" title="Галерея порожня">
          {isGm
            ? 'Завантажте зображення — мапи, портрети NPC, сцени.'
            : 'Майстер ще не додав зображень.'}
        </EmptyState>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <div key={image.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label="Переглянути зображення"
              >
                <img
                  src={image.image_url}
                  alt=""
                  loading="lazy"
                  className="h-28 w-28 rounded-lg border border-border object-cover"
                />
              </button>
              {isGm && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleRemove(image.id); }}
                  aria-label="Видалити зображення"
                  className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white hover:bg-black/80"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={images.map((i) => i.image_url)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        className="hidden"
        onChange={handleFiles}
      />
    </div>
  );
}

function CharactersBlock({ characters, navigate }) {
  return (
    <div>
      <h3 className="mb-2 font-display text-base text-text">Персонажі кампанії</h3>
      {characters.length === 0 ? (
        <EmptyState title="До кампанії ще не приєднано жодного персонажа" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {characters.map((ch) => {
            const clickable = !ch.is_private;
            return (
              <Card
                key={ch.character_id}
                className={clickable ? 'cursor-pointer hover:border-accent/50' : 'opacity-80'}
                onClick={clickable ? () => navigate(`/characters/${ch.character_id}`) : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-base text-text">{ch.character_name}</h3>
                  {ch.is_private && <Lock size={14} className="mt-1 shrink-0 text-text-dim" aria-label="Приватний персонаж" />}
                </div>
                <p className="text-sm text-text-dim">{ch.archetype} · {ch.race}</p>
                <p className="mt-2 text-xs text-text-dim">
                  Гравець: {ch.owner_username} {ch.is_mine && <span className="text-accent">(ви)</span>}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ================================================================
// Налаштування: для GM — керування персонажами/назвою/описом і
// видалення кампанії; для гравця — вихід із кампанії.
// ================================================================

function SettingsTab({ campaign, isGm, onChange, characters, setCharacters, navigate }) {
  if (!isGm) return <PlayerSettingsTab campaign={campaign} navigate={navigate} />;
  return (
    <div className="flex flex-col gap-6">
      <CampaignDetailsCard campaign={campaign} onChange={onChange} />
      <CampaignCharactersAdmin campaignId={campaign.id} characters={characters} setCharacters={setCharacters} />
      <DangerZone campaign={campaign} navigate={navigate} />
    </div>
  );
}

function PlayerSettingsTab({ campaign, navigate }) {
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');

  const handleLeave = async () => {
    if (!confirm(`Покинути кампанію "${campaign.name}"? Ваші персонажі відв'яжуться від неї.`)) return;
    setLeaving(true);
    try {
      await campaignApi.leave(campaign.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при виході з кампанії');
      setLeaving(false);
    }
  };

  return (
    <Card>
      <p className="mb-3 text-sm text-text-dim">
        Ви покинете кампанію «{campaign.name}» — ваші персонажі відв'яжуться від неї, але самі листи персонажів не видаляться.
      </p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <Button variant="danger" onClick={handleLeave} disabled={leaving}>
        <LogOut size={14} /> {leaving ? 'Вихід...' : 'Покинути кампанію'}
      </Button>
    </Card>
  );
}

function CampaignDetailsCard({ campaign, onChange }) {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const saveName = useDebounce(async (value) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    setError('');
    try {
      const updated = await campaignApi.rename(campaign.id, trimmed);
      onChange((prev) => ({ ...prev, name: updated.name }));
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при перейменуванні');
    } finally {
      setSaving(false);
    }
  });

  const saveDescription = useDebounce(async (value) => {
    setSaving(true);
    try {
      const updated = await campaignApi.updateDescription(campaign.id, value);
      onChange((prev) => ({ ...prev, description: updated.description }));
    } finally {
      setSaving(false);
    }
  });

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">Назва та опис кампанії</p>
        {saving && <span className="text-xs text-text-dim">• Збереження...</span>}
      </div>
      <div className="flex flex-col gap-4">
        <Field label="Назва">
          <input
            className={inputClass}
            value={name}
            onChange={(e) => { setName(e.target.value); saveName(e.target.value); }}
            maxLength={200}
          />
        </Field>
        <Field label="Опис">
          <textarea
            className={`${inputClass} resize-y`}
            rows={5}
            value={description}
            onChange={(e) => { setDescription(e.target.value); saveDescription(e.target.value); }}
            placeholder="Коротко про що кампанія, сеттінг, тон гри..."
          />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Card>
  );
}

function CampaignCharactersAdmin({ campaignId, characters, setCharacters }) {
  const [newCharacterId, setNewCharacterId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const refresh = () => campaignApi.listCharacters(campaignId).then(setCharacters);

  const handleRemove = async (characterId, characterName) => {
    if (!confirm(`Видалити персонажа "${characterName}" з кампанії? Сам лист персонажа не буде видалено.`)) return;
    try {
      await campaignApi.removeCharacter(campaignId, characterId);
      setCharacters((prev) => prev.filter((c) => c.character_id !== characterId));
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні персонажа з кампанії');
    }
  };

  const handleAdd = async () => {
    if (!newCharacterId.trim()) return;
    setAdding(true);
    setError('');
    try {
      await campaignApi.addCharacter(campaignId, newCharacterId.trim());
      setNewCharacterId('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при додаванні персонажа');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Персонажі кампанії</p>
      <div className="mb-4 flex gap-2">
        <input
          className={`${inputClass} flex-1`}
          value={newCharacterId}
          onChange={(e) => setNewCharacterId(e.target.value)}
          placeholder="ID персонажа, який надав гравець"
        />
        <Button onClick={handleAdd} disabled={adding} size="md">
          {adding ? 'Додавання...' : 'Додати'}
        </Button>
      </div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {characters.length === 0 ? (
        <p className="text-sm text-text-dim">До кампанії ще не приєднано жодного персонажа.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {characters.map((ch) => (
            <li key={ch.character_id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="flex items-center gap-1.5 text-sm text-text">
                  {ch.character_name}
                  {ch.is_private && <Lock size={12} className="text-text-dim" aria-label="Приватний персонаж" />}
                </p>
                <p className="text-xs text-text-dim">{ch.archetype} · {ch.race} · {ch.owner_username}</p>
              </div>
              <button
                onClick={() => handleRemove(ch.character_id, ch.character_name)}
                aria-label="Видалити персонажа з кампанії"
                className="shrink-0 p-1 text-text-dim hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DangerZone({ campaign, navigate }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDeleteCampaign = async () => {
    if (!confirm(`Видалити кампанію "${campaign.name}"? Персонажі гравців не видаляться, лише відв'яжуться від кампанії. Це незворотно.`)) return;
    setDeleting(true);
    try {
      await campaignApi.remove(campaign.id);
      navigate('/campaigns');
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при видаленні кампанії');
      setDeleting(false);
    }
  };

  return (
    <Card className="border-danger/40">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-danger">Небезпечна зона</p>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}
      <Button variant="danger" onClick={handleDeleteCampaign} disabled={deleting}>
        <Trash2 size={14} /> {deleting ? 'Видалення...' : 'Видалити кампанію'}
      </Button>
    </Card>
  );
}
