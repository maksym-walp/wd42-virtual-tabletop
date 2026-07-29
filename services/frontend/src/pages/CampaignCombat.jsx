import { useEffect, useState, useRef, useCallback } from 'react';
import { Eye, EyeOff, Trash2, Plus, Upload } from 'lucide-react';
import campaignApi from '../api/campaigns';
import characterApi from '../api/characterSheet';
import mediaApi, { MAX_UPLOAD_BYTES, ACCEPTED_IMAGE_TYPES } from '../api/media';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Field, { inputClass } from '../components/ui/Field';
import EmptyState from '../components/ui/EmptyState';
import IntInput from '../components/ui/IntInput';
import Sheet from '../components/ui/Sheet';

const POLL_INTERVAL_MS = 3500;
const EMPTY_NPC_FORM = { name: '', passive_defense: 0, active_defense: 0, health: 0, initiative: 0, notes: '', description: '' };

// Гравці для NPC, де is_hidden === false, все одно не бачать точних чисел —
// рядок лишається (ім'я/опис для атмосфери), але цифри й нотатки затерті на
// фронті. NPC з is_hidden === true бекенд і так уже урізає до card-даних;
// тут ми просто не рендеримо такий рядок гравцю взагалі.
function filterForPlayers(combatants) {
  return combatants
    .filter((c) => c.character_id || !c.is_hidden)
    .map((c) => {
      if (c.character_id) return c;
      const { passive_defense, active_defense, health, initiative, notes, ...rest } = c;
      return rest;
    });
}

export default function CombatTab({ campaignId, isGm, characters }) {
  const [scene, setScene] = useState(null);
  const [combatants, setCombatants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => (
    campaignApi.getCombat(campaignId)
      .then((data) => { setScene(data.scene); setCombatants(data.combatants); })
      .catch(() => setError('Не вдалось завантажити бойову сцену'))
  ), [campaignId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  // Без WS/SSE-інфраструктури хід і раунд майстра доходять до гравців
  // періодичним опитуванням, поки вкладка відкрита й активна.
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(); };
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  if (loading) return <p className="text-sm text-text-dim">Завантаження...</p>;

  if (!scene) {
    return isGm ? (
      <NoSceneYetGm campaignId={campaignId} onCreated={load} />
    ) : (
      <EmptyState icon="⚔" title="Бій ще не почався">
        Майстер ще не створив бойову сцену.
      </EmptyState>
    );
  }

  const visible = isGm ? combatants : filterForPlayers(combatants);
  const notActed = visible.filter((c) => !c.has_acted_this_round);
  const acted = visible.filter((c) => c.has_acted_this_round);

  const handleNextTurn = async () => {
    setBusy(true);
    setError('');
    try {
      await campaignApi.nextTurn(campaignId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при переході до наступного ходу');
    } finally {
      setBusy(false);
    }
  };

  const handleNextRound = async () => {
    setBusy(true);
    setError('');
    try {
      await campaignApi.nextRound(campaignId);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при переході до наступного раунду');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 font-display text-lg text-text">Раунд {scene.round_number}</p>
          {isGm && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={handleNextTurn} disabled={busy || notActed.length === 0}>
                Наступний хід &gt;
              </Button>
              <Button size="sm" onClick={handleNextRound} disabled={busy}>
                Наступний раунд &gt;&gt;
              </Button>
            </div>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      {isGm && (
        <AddCombatantBar
          campaignId={campaignId}
          sceneId={scene.id}
          characters={characters}
          combatants={combatants}
          onAdded={load}
        />
      )}

      <CombatantsTable notActed={notActed} acted={acted} isGm={isGm} campaignId={campaignId} onChanged={load} />

      <SceneImage campaignId={campaignId} scene={scene} isGm={isGm} onChanged={load} />
    </div>
  );
}

function NoSceneYetGm({ campaignId, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await campaignApi.createCombatScene(campaignId, {});
      await onCreated();
    } catch (err) {
      setError(err.response?.data?.message || 'Помилка при створенні сцени');
      setCreating(false);
    }
  };

  return (
    <EmptyState
      icon="⚔"
      title="Бойової сцени ще немає"
      action={<Button onClick={handleCreate} disabled={creating}>{creating ? 'Створення...' : 'Почати бій'}</Button>}
    >
      {error || 'Створіть сцену, щоб додавати комбатантів і вести облік раундів.'}
    </EmptyState>
  );
}

// ================================================================
// Таблиця комбатантів: завжди відсортована за спаданням ініціативи
// (бекенд віддає вже в такому порядку), розбита на "ще не діяли" /
// роздільник / "вже походили цього раунду".
// ================================================================

function CombatantsTable({ notActed, acted, isGm, campaignId, onChanged }) {
  if (notActed.length === 0 && acted.length === 0) {
    return (
      <EmptyState title="У бою ще немає комбатантів">
        {isGm ? 'Додайте гравців або NPC вище.' : 'Майстер ще не додав комбатантів.'}
      </EmptyState>
    );
  }

  const colCount = isGm ? 8 : 7;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-hover text-left text-xs uppercase tracking-wide text-text-dim">
            <th className="px-3 py-2 font-semibold">Ім'я</th>
            <th className="px-3 py-2 font-semibold">Пас. захист</th>
            <th className="px-3 py-2 font-semibold">Акт. захист</th>
            <th className="px-3 py-2 font-semibold">Здоров'я</th>
            <th className="px-3 py-2 font-semibold">Ініціатива</th>
            <th className="px-3 py-2 font-semibold">Примітки</th>
            <th className="px-3 py-2 font-semibold">Опис</th>
            {isGm && <th className="px-3 py-2 font-semibold">Дії</th>}
          </tr>
        </thead>
        <tbody>
          {notActed.map((c) => (
            <CombatantRow key={c.id} combatant={c} isGm={isGm} campaignId={campaignId} onChanged={onChanged} />
          ))}
          {acted.length > 0 && (
            <tr>
              <td colSpan={colCount} className="border-y border-dashed border-border bg-surface-hover/50 px-3 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-text-dim">
                --- Наступний раунд ---
              </td>
            </tr>
          )}
          {acted.map((c) => (
            <CombatantRow key={c.id} combatant={c} isGm={isGm} campaignId={campaignId} onChanged={onChanged} dimmed />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CombatantRow({ combatant, isGm, campaignId, onChanged, dimmed }) {
  const rowRef = useRef(null);
  const [local, setLocal] = useState(combatant);

  // Опитування оновлює `combatant` кожні ~3.5с; якщо майстер саме зараз
  // редагує поле в цьому рядку — не затираємо введене свіжими даними з сервера.
  useEffect(() => {
    if (rowRef.current && rowRef.current.contains(document.activeElement)) return;
    setLocal(combatant);
  }, [combatant]);

  const isPlayerLinked = !!combatant.character_id;
  const isNpc = !isPlayerLinked;
  const rowClass = `border-b border-border last:border-0 ${dimmed ? 'opacity-60' : ''}`;
  const cellClass = 'px-3 py-2 align-top';

  if (!isGm) {
    return (
      <tr className={rowClass}>
        <td className={cellClass}>{combatant.name}</td>
        <td className={cellClass}>{combatant.passive_defense ?? '—'}</td>
        <td className={cellClass}>{combatant.active_defense ?? '—'}</td>
        <td className={cellClass}>{combatant.health ?? '—'}</td>
        <td className={cellClass}>{combatant.initiative ?? '—'}</td>
        <td className={cellClass}>{combatant.notes || '—'}</td>
        <td className={cellClass}>{combatant.description || '—'}</td>
      </tr>
    );
  }

  const commit = async (key) => {
    if (local[key] === combatant[key]) return;
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, { [key]: local[key] });
      onChanged();
    } catch {
      setLocal(combatant);
    }
  };

  const toggleHidden = async () => {
    try {
      await campaignApi.updateCombatant(campaignId, combatant.id, { is_hidden: !combatant.is_hidden });
      onChanged();
    } catch {
      // наступне опитування підтягне справжній стан
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Прибрати "${combatant.name}" з бою?`)) return;
    try {
      await campaignApi.removeCombatant(campaignId, combatant.id);
      onChanged();
    } catch {
      // залишаємо рядок — GM побачить, що видалення не пройшло, і спробує ще раз
    }
  };

  return (
    <tr ref={rowRef} className={rowClass}>
      <td className={cellClass}>
        {isPlayerLinked ? (
          <span className="text-text">{combatant.name}</span>
        ) : (
          <input
            className={`${inputClass} min-h-8 min-w-[110px] py-1`}
            value={local.name}
            onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))}
            onBlur={() => commit('name')}
          />
        )}
      </td>
      <td className={cellClass}>
        {isPlayerLinked ? (
          <span className="text-text">{combatant.passive_defense ?? '—'}</span>
        ) : (
          <IntInput
            className={`${inputClass} min-h-8 w-16 py-1`}
            value={local.passive_defense}
            onChange={(v) => setLocal((p) => ({ ...p, passive_defense: v }))}
            onBlur={() => commit('passive_defense')}
          />
        )}
      </td>
      <td className={cellClass}>
        <IntInput
          className={`${inputClass} min-h-8 w-16 py-1`}
          value={local.active_defense}
          onChange={(v) => setLocal((p) => ({ ...p, active_defense: v }))}
          onBlur={() => commit('active_defense')}
        />
      </td>
      <td className={cellClass}>
        {isPlayerLinked ? (
          <span className="text-text">{combatant.health ?? '—'}</span>
        ) : (
          <IntInput
            className={`${inputClass} min-h-8 w-16 py-1`}
            value={local.health}
            onChange={(v) => setLocal((p) => ({ ...p, health: v }))}
            onBlur={() => commit('health')}
          />
        )}
      </td>
      <td className={cellClass}>
        <IntInput
          className={`${inputClass} min-h-8 w-16 py-1`}
          value={local.initiative}
          onChange={(v) => setLocal((p) => ({ ...p, initiative: v }))}
          onBlur={() => commit('initiative')}
        />
      </td>
      <td className={cellClass}>
        <input
          className={`${inputClass} min-h-8 min-w-[130px] py-1`}
          value={local.notes ?? ''}
          onChange={(e) => setLocal((p) => ({ ...p, notes: e.target.value }))}
          onBlur={() => commit('notes')}
        />
      </td>
      <td className={cellClass}>
        <input
          className={`${inputClass} min-h-8 min-w-[130px] py-1`}
          value={local.description ?? ''}
          onChange={(e) => setLocal((p) => ({ ...p, description: e.target.value }))}
          onBlur={() => commit('description')}
        />
      </td>
      <td className={`${cellClass} whitespace-nowrap`}>
        <div className="flex items-center gap-1">
          {isNpc && (
            <button
              type="button"
              onClick={toggleHidden}
              aria-label={combatant.is_hidden ? 'Показати гравцям' : 'Приховати від гравців'}
              className="p-1 text-text-dim hover:text-accent"
            >
              {combatant.is_hidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          )}
          <button type="button" onClick={handleRemove} aria-label="Прибрати з бою" className="p-1 text-text-dim hover:text-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ================================================================
// Додавання комбатантів: гравець із кампанії (ім'я/пасивний захист/
// здоров'я підтягуються з листа персонажа й лишаються readonly у таблиці)
// або кастомний NPC (усі поля вручну).
// ================================================================

function AddCombatantBar({ campaignId, sceneId, characters, combatants, onAdded }) {
  const [mode, setMode] = useState(null); // null | 'player' | 'npc'

  const attachedCharacterIds = new Set(combatants.map((c) => c.character_id).filter(Boolean));
  const availableCharacters = characters.filter((c) => !attachedCharacterIds.has(c.character_id));

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" onClick={() => setMode('player')}>
        <Plus size={14} /> Додати гравця
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setMode('npc')}>
        <Plus size={14} /> Додати NPC
      </Button>

      <AddPlayerSheet
        open={mode === 'player'}
        campaignId={campaignId}
        sceneId={sceneId}
        characters={availableCharacters}
        onClose={() => setMode(null)}
        onAdded={() => { setMode(null); onAdded(); }}
      />
      <AddNpcSheet
        open={mode === 'npc'}
        campaignId={campaignId}
        sceneId={sceneId}
        onClose={() => setMode(null)}
        onAdded={() => { setMode(null); onAdded(); }}
      />
    </div>
  );
}

function AddPlayerSheet({ open, campaignId, sceneId, characters, onClose, onAdded }) {
  const [characterId, setCharacterId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setCharacterId(''); setError(''); }
  }, [open]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!characterId) return;
    setSaving(true);
    setError('');
    try {
      const { character, equipment } = await characterApi.getSheet(characterId);
      // Той самий "пасивний захист" (броня + ручний бонус), що на сторінці
      // персонажа — тут лише читаємо, нічого не рахуємо для власника заново.
      const armorDefense = (equipment ?? []).reduce((sum, e) => (
        e.item?.type === 'armor' ? sum + (e.item.defense_value || 0) : sum
      ), 0);

      await campaignApi.addCombatant(campaignId, sceneId, {
        character_id: characterId,
        name: character.name,
        passive_defense: armorDefense + (character.defense_bonus ?? 0),
        health: character.current_hp,
      });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати персонажа в бій');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Додати гравця з кампанії">
      <div className="flex flex-col gap-4">
        {characters.length === 0 ? (
          <p className="text-sm text-text-dim">Усі персонажі кампанії вже в бою.</p>
        ) : (
          <Field label="Персонаж">
            <select className={inputClass} value={characterId} onChange={(e) => setCharacterId(e.target.value)}>
              <option value="">Оберіть персонажа…</option>
              {characters.map((c) => (
                <option key={c.character_id} value={c.character_id}>
                  {c.character_name} ({c.owner_username})
                </option>
              ))}
            </select>
          </Field>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={handleAdd} disabled={!characterId || saving}>
          {saving ? 'Додавання...' : 'Додати в бій'}
        </Button>
      </div>
    </Sheet>
  );
}

function AddNpcSheet({ open, campaignId, sceneId, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY_NPC_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm(EMPTY_NPC_FORM); setError(''); }
  }, [open]);

  if (!open) return null;

  const setText = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setInt = (key) => (v) => setForm((prev) => ({ ...prev, [key]: v }));

  const handleAdd = async () => {
    if (!form.name.trim()) { setError('Вкажіть імʼя'); return; }
    setSaving(true);
    setError('');
    try {
      await campaignApi.addCombatant(campaignId, sceneId, { ...form, name: form.name.trim() });
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось додати NPC');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Новий NPC">
      <div className="flex flex-col gap-4">
        <Field label="Імʼя">
          <input className={inputClass} value={form.name} onChange={setText('name')} maxLength={200} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Пасивний захист">
            <IntInput className={inputClass} value={form.passive_defense} onChange={setInt('passive_defense')} />
          </Field>
          <Field label="Активний захист">
            <IntInput className={inputClass} value={form.active_defense} onChange={setInt('active_defense')} />
          </Field>
          <Field label="Здоров'я">
            <IntInput className={inputClass} value={form.health} onChange={setInt('health')} />
          </Field>
          <Field label="Ініціатива">
            <IntInput className={inputClass} value={form.initiative} onChange={setInt('initiative')} />
          </Field>
        </div>
        <Field label="Примітки">
          <input className={inputClass} value={form.notes} onChange={setText('notes')} />
        </Field>
        <Field label="Опис">
          <textarea className={`${inputClass} resize-y`} rows={3} value={form.description} onChange={setText('description')} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={handleAdd} disabled={saving}>{saving ? 'Додавання...' : 'Додати в бій'}</Button>
      </div>
    </Sheet>
  );
}

// ================================================================
// Фон бойової сцени: завантаження через media-service, показ під таблицею.
// ================================================================

function SceneImage({ campaignId, scene, isGm, onChanged }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef(null);

  if (!isGm && !scene.image_url) return null;

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) { setError('Файл завеликий — максимум 10 МБ'); return; }

    setError('');
    setUploading(true);
    try {
      const url = await mediaApi.upload(file, { entityType: 'combat-scene', entityId: scene.id });
      await campaignApi.updateCombatScene(campaignId, scene.id, { image_url: url });
      await onChanged();
    } catch (err) {
      setError(err.response?.data?.message || 'Не вдалось завантажити зображення');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="m-0 font-display text-base text-text">Карта сцени</h3>
        {isGm && (
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} /> {uploading ? 'Завантаження...' : 'Завантажити'}
          </Button>
        )}
      </div>

      {error && <p className="mb-2 text-xs text-danger">{error}</p>}

      {scene.image_url ? (
        <img src={scene.image_url} alt="" className="max-h-[420px] w-full rounded-lg border border-border object-contain" />
      ) : (
        <p className="text-sm text-text-dim">Зображення сцени ще не завантажено.</p>
      )}

      {isGm && (
        <input ref={fileRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFile} />
      )}
    </Card>
  );
}
