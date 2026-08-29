import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import chronologyApi from '../api/chronology';
import Field, { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import ImageUploadField from '../components/ui/ImageUploadField';

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

const EMPTY_SETTINGS = {
  name: '', description: '', current_era_name: '', previous_era_name: '',
  first_day_offset: 0, is_private: false, default_year: '', default_month_id: '',
};

// Дрібний домашній замінник Formik/react-hook-form (жодного з них немає в
// package.json, а решта складних форм у репо теж керує масивами вручну через
// useState — див. SkillTree.jsx/ArrayListField) — новий рядок отримує
// клієнтський тимчасовий id (`new-...`), що при збереженні відрізняє POST
// (новий) від PUT (уже існує на бекенді).
function useEditableList(toRow) {
  const [items, setItems] = useState([]);
  const [deletedIds, setDeletedIds] = useState([]);

  const add = (data) => setItems((list) => [...list, { id: `new-${crypto.randomUUID()}`, ...toRow(data) }]);
  const update = (id, patch) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) => {
    setItems((list) => list.filter((it) => it.id !== id));
    if (!id.startsWith('new-')) setDeletedIds((ids) => [...ids, id]);
  };
  const move = (id, direction) => setItems((list) => {
    const index = list.findIndex((it) => it.id === id);
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return { items, setItems, deletedIds, setDeletedIds, add, update, remove, move };
}

export default function ChronologyBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'game_master';

  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  const months = useEditableList((d) => ({ name: '', length: '30', ...d }));
  const weekdays = useEditableList((d) => ({ name: '', short_name: '', ...d }));
  const seasons = useEditableList((d) => ({ name: '', start_month_id: '', start_day: '1', color: '#4caf50', bg_image_url: '', ...d }));
  const moons = useEditableList((d) => ({ name: '', cycle_length: '29.5', shift: '0', color: '#c0c0c0', ...d }));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const loadAll = async () => {
    const [calendar, monthsList, weekdaysList, seasonsList, moonsList] = await Promise.all([
      chronologyApi.getOne(id),
      chronologyApi.listMonths(id),
      chronologyApi.listWeekdays(id),
      chronologyApi.listSeasons(id),
      chronologyApi.listMoons(id),
    ]);
    setSettings({
      name: calendar.name || '',
      description: calendar.description || '',
      current_era_name: calendar.current_era_name || '',
      previous_era_name: calendar.previous_era_name || '',
      first_day_offset: calendar.first_day_offset ?? 0,
      is_private: calendar.is_private,
      default_year: calendar.default_year ?? '',
      default_month_id: calendar.default_month_id || '',
    });
    months.setItems(monthsList.map((m) => ({ id: m.id, name: m.name, length: String(m.length) })));
    weekdays.setItems(weekdaysList.map((w) => ({ id: w.id, name: w.name, short_name: w.short_name || '' })));
    seasons.setItems(seasonsList.map((s) => ({
      id: s.id, name: s.name, start_month_id: s.start_month_id,
      start_day: String(s.start_day), color: s.color, bg_image_url: s.bg_image_url || '',
    })));
    moons.setItems(moonsList.map((mo) => ({
      id: mo.id, name: mo.name, cycle_length: String(mo.cycle_length), shift: String(mo.shift), color: mo.color,
    })));
    months.setDeletedIds([]);
    weekdays.setDeletedIds([]);
    seasons.setDeletedIds([]);
    moons.setDeletedIds([]);
  };

  useEffect(() => {
    setLoading(true);
    loadAll()
      .catch(() => navigate('/chronology'))
      .finally(() => setLoading(false));
  }, [id]);

  const validate = () => {
    if (!settings.name.trim()) return 'Вкажіть назву календаря';
    for (const m of months.items) {
      if (!m.name.trim()) return 'У кожного місяця має бути назва';
      if (!(Number(m.length) > 0)) return `Довжина місяця "${m.name}" має бути додатним числом`;
    }
    for (const wd of weekdays.items) {
      if (!wd.name.trim()) return 'У кожного дня тижня має бути назва';
    }
    for (const s of seasons.items) {
      if (!s.name.trim()) return 'У кожного сезону має бути назва';
      if (!s.start_month_id) return `Оберіть місяць початку для сезону "${s.name}"`;
      if (!(Number(s.start_day) > 0)) return `День початку сезону "${s.name}" має бути додатним числом`;
      if (!HEX_COLOR_RE.test(s.color)) return `Колір сезону "${s.name}" має бути у форматі #rrggbb`;
    }
    for (const mo of moons.items) {
      if (!mo.name.trim()) return `У кожного супутника має бути назва`;
      if (!(Number(mo.cycle_length) > 0)) return `Цикл супутника "${mo.name}" має бути додатним числом`;
      if (!HEX_COLOR_RE.test(mo.color)) return `Колір супутника "${mo.name}" має бути у форматі #rrggbb`;
    }
    return null;
  };

  // Бекенд не має bulk-ендпоінта — кожна сутність зберігається окремим
  // запитом послідовно. Місяці йдуть ДО сезонів: сезон посилається на
  // start_month_id, а новостворений місяць отримує справжній id лише після
  // свого POST — monthIdMap підміняє тимчасовий id на нього перед сезонами.
  // Якщо якийсь запит посеред послідовності впаде, частина сутностей уже
  // могла зберегтись на сервері — тому navigate catch-гілка все одно
  // перезавантажує стан із сервера (best effort), щоб тимчасові id вже
  // створених рядків не спричинили дублів при повторній спробі.
  const handleSave = async () => {
    const validationError = validate();
    if (validationError) { setError(validationError); setSuccess(false); return; }

    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      for (const [i, wd] of weekdays.items.entries()) {
        const payload = { name: wd.name.trim(), short_name: wd.short_name.trim() || null, order_num: i };
        if (wd.id.startsWith('new-')) await chronologyApi.createWeekday(id, payload);
        else await chronologyApi.updateWeekday(id, wd.id, payload);
      }
      for (const wdId of weekdays.deletedIds) await chronologyApi.removeWeekday(id, wdId);

      for (const mo of moons.items) {
        const payload = {
          name: mo.name.trim(), cycle_length: Number(mo.cycle_length),
          shift: Number(mo.shift) || 0, color: mo.color,
        };
        if (mo.id.startsWith('new-')) await chronologyApi.createMoon(id, payload);
        else await chronologyApi.updateMoon(id, mo.id, payload);
      }
      for (const moonId of moons.deletedIds) await chronologyApi.removeMoon(id, moonId);

      const monthIdMap = {};
      for (const [i, m] of months.items.entries()) {
        const payload = { name: m.name.trim(), length: Number(m.length), order_num: i };
        if (m.id.startsWith('new-')) {
          const created = await chronologyApi.createMonth(id, payload);
          monthIdMap[m.id] = created.id;
        } else {
          await chronologyApi.updateMonth(id, m.id, payload);
          monthIdMap[m.id] = m.id;
        }
      }
      for (const monthId of months.deletedIds) await chronologyApi.removeMonth(id, monthId);

      for (const s of seasons.items) {
        const payload = {
          name: s.name.trim(),
          start_month_id: monthIdMap[s.start_month_id] || s.start_month_id,
          start_day: Number(s.start_day),
          color: s.color,
          bg_image_url: s.bg_image_url || null,
        };
        if (s.id.startsWith('new-')) await chronologyApi.createSeason(id, payload);
        else await chronologyApi.updateSeason(id, s.id, payload);
      }
      for (const seasonId of seasons.deletedIds) await chronologyApi.removeSeason(id, seasonId);

      // Saved last, not first: default_month_id can point at a month created
      // in this very save, and only monthIdMap (built above) knows its real
      // id by now. A default pointing at a month removed in this same save
      // (or stale from before) is silently dropped rather than rejected.
      const defaultMonthStillExists = months.items.some((m) => m.id === settings.default_month_id);
      await chronologyApi.update(id, {
        name: settings.name.trim(),
        description: settings.description || null,
        current_era_name: settings.current_era_name || null,
        previous_era_name: settings.previous_era_name || null,
        first_day_offset: Number(settings.first_day_offset) || 0,
        is_private: settings.is_private,
        default_year: settings.default_year === '' ? null : Number(settings.default_year),
        default_month_id: defaultMonthStillExists
          ? (monthIdMap[settings.default_month_id] || settings.default_month_id)
          : null,
      });

      await loadAll();
      setSuccess(true);
    } catch (err) {
      await loadAll().catch(() => {});
      setError(err.response?.data?.message || 'Не вдалося зберегти календар');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="px-4 py-16 text-center text-text-dim">Завантаження...</div>;

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState icon="🔒" title="Доступно лише майстру гри">
          Побудова структури календаря — привілей admin/game_master.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-32 sm:px-6 md:pb-8">
      <Link to="/chronology" className="mb-3 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Календарі
      </Link>

      <h1 className="mb-6 font-display text-2xl text-accent">Побудова календаря</h1>

      <div className="flex flex-col gap-4">
        <FormSection title="Загальні налаштування">
          <Field label="Назва" className="mb-4">
            <input
              className={inputClass}
              value={settings.name}
              onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
              maxLength={200}
            />
          </Field>
          <Field label="Опис" className="mb-4">
            <textarea
              rows={3}
              className={`${inputClass} resize-y`}
              value={settings.description}
              onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))}
            />
          </Field>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Назва поточної ери">
              <input
                className={inputClass}
                value={settings.current_era_name}
                onChange={(e) => setSettings((s) => ({ ...s, current_era_name: e.target.value }))}
                placeholder="Наприклад, Третя Епоха"
                maxLength={200}
              />
            </Field>
            <Field label="Назва попередньої ери" hint="Для років до початку літочислення">
              <input
                className={inputClass}
                value={settings.previous_era_name}
                onChange={(e) => setSettings((s) => ({ ...s, previous_era_name: e.target.value }))}
                placeholder="Наприклад, До Падіння"
                maxLength={200}
              />
            </Field>
          </div>
          <Field label="Зсув першого дня року 1" hint="На який день тижня випадає 1-й день 1-го року" className="mb-4">
            {weekdays.items.length > 0 ? (
              <select
                className={inputClass}
                value={settings.first_day_offset}
                onChange={(e) => setSettings((s) => ({ ...s, first_day_offset: e.target.value }))}
              >
                {weekdays.items.map((wd, i) => (
                  <option key={wd.id} value={i}>{wd.name || `День ${i + 1}`}</option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                className={inputClass}
                value={settings.first_day_offset}
                onChange={(e) => setSettings((s) => ({ ...s, first_day_offset: e.target.value }))}
              />
            )}
          </Field>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Рік за замовчуванням" hint="Який рік відкривати на початку перегляду">
              <input
                type="number"
                className={inputClass}
                value={settings.default_year}
                onChange={(e) => setSettings((s) => ({ ...s, default_year: e.target.value }))}
                placeholder="Наприклад, 100"
              />
            </Field>
            <Field label="Місяць за замовчуванням">
              <select
                className={inputClass}
                value={settings.default_month_id}
                onChange={(e) => setSettings((s) => ({ ...s, default_month_id: e.target.value }))}
                disabled={months.items.length === 0}
              >
                <option value="">Не задано</option>
                {months.items.map((m) => <option key={m.id} value={m.id}>{m.name || 'Без назви'}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-text">
            <input
              type="checkbox"
              checked={settings.is_private}
              onChange={(e) => setSettings((s) => ({ ...s, is_private: e.target.checked }))}
              className="h-5 w-5 accent-accent"
            />
            Приватний — видимий лише мені та адміністраторам
          </label>
        </FormSection>

        <FormSection title="Місяці">
          <div className="flex flex-col gap-3">
            {months.items.length === 0 && <p className="text-sm text-text-dim">Ще немає жодного місяця.</p>}
            {months.items.map((m, i) => (
              <EditableRow
                key={m.id}
                canMoveUp={i > 0}
                canMoveDown={i < months.items.length - 1}
                onMoveUp={() => months.move(m.id, -1)}
                onMoveDown={() => months.move(m.id, 1)}
                onRemove={() => months.remove(m.id)}
              >
                <Field label="Назва" className="flex-[2]">
                  <input className={inputClass} value={m.name} onChange={(e) => months.update(m.id, { name: e.target.value })} maxLength={200} />
                </Field>
                <Field label="Довжина (днів)" className="w-full sm:w-40">
                  <input type="number" min={1} className={inputClass} value={m.length} onChange={(e) => months.update(m.id, { length: e.target.value })} />
                </Field>
              </EditableRow>
            ))}
            <AddRowButton label="Додати місяць" onClick={() => months.add()} />
          </div>
        </FormSection>

        <FormSection title="Дні тижня">
          <div className="flex flex-col gap-3">
            {weekdays.items.length === 0 && <p className="text-sm text-text-dim">Ще немає жодного дня тижня.</p>}
            {weekdays.items.map((wd, i) => (
              <EditableRow
                key={wd.id}
                canMoveUp={i > 0}
                canMoveDown={i < weekdays.items.length - 1}
                onMoveUp={() => weekdays.move(wd.id, -1)}
                onMoveDown={() => weekdays.move(wd.id, 1)}
                onRemove={() => weekdays.remove(wd.id)}
              >
                <Field label="Назва" className="flex-[2]">
                  <input className={inputClass} value={wd.name} onChange={(e) => weekdays.update(wd.id, { name: e.target.value })} maxLength={200} />
                </Field>
                <Field label="Скорочення" hint="До 3 символів, напр. «Пн»" className="w-full sm:w-32">
                  <input className={inputClass} value={wd.short_name} onChange={(e) => weekdays.update(wd.id, { short_name: e.target.value })} maxLength={3} />
                </Field>
              </EditableRow>
            ))}
            <AddRowButton label="Додати день тижня" onClick={() => weekdays.add()} />
          </div>
        </FormSection>

        <FormSection title="Сезони">
          <div className="flex flex-col gap-3">
            {seasons.items.length === 0 && <p className="text-sm text-text-dim">Ще немає жодного сезону.</p>}
            {months.items.length === 0 && (
              <p className="text-sm text-text-dim">Спочатку додайте хоча б один місяць — сезон прив'язується до місяця початку.</p>
            )}
            {seasons.items.map((s, i) => (
              <EditableRow
                key={s.id}
                canMoveUp={i > 0}
                canMoveDown={i < seasons.items.length - 1}
                onMoveUp={() => seasons.move(s.id, -1)}
                onMoveDown={() => seasons.move(s.id, 1)}
                onRemove={() => seasons.remove(s.id)}
              >
                <Field label="Назва" className="flex-[2]">
                  <input className={inputClass} value={s.name} onChange={(e) => seasons.update(s.id, { name: e.target.value })} maxLength={200} />
                </Field>
                <Field label="Місяць початку" className="w-full sm:w-44">
                  <select
                    className={inputClass}
                    value={s.start_month_id}
                    onChange={(e) => seasons.update(s.id, { start_month_id: e.target.value })}
                  >
                    <option value="">Оберіть...</option>
                    {months.items.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || 'Без назви'}</option>
                    ))}
                  </select>
                </Field>
                <Field label="День початку" className="w-full sm:w-28">
                  <input type="number" min={1} className={inputClass} value={s.start_day} onChange={(e) => seasons.update(s.id, { start_day: e.target.value })} />
                </Field>
                <Field label="Колір" className="w-full sm:w-40">
                  <ColorField value={s.color} onChange={(color) => seasons.update(s.id, { color })} />
                </Field>
                <div className="w-full sm:w-64">
                  <ImageUploadField
                    label="Фон сезону"
                    value={s.bg_image_url}
                    onChange={(url) => seasons.update(s.id, { bg_image_url: url })}
                    entityType="calendar-season"
                  />
                </div>
              </EditableRow>
            ))}
            <AddRowButton label="Додати сезон" onClick={() => seasons.add()} />
          </div>
        </FormSection>

        {/* Без реордера: на відміну від місяців/днів тижня, calendar_moons
            не має order_num у схемі — порядок циклів супутників ніде не
            впливає на розрахунок дати, бекенд сортує їх за назвою. */}
        <FormSection title="Супутники">
          <div className="flex flex-col gap-3">
            {moons.items.length === 0 && <p className="text-sm text-text-dim">Ще немає жодного супутника.</p>}
            {moons.items.map((mo) => (
              <EditableRow key={mo.id} onRemove={() => moons.remove(mo.id)}>
                <Field label="Назва" className="flex-[2]">
                  <input className={inputClass} value={mo.name} onChange={(e) => moons.update(mo.id, { name: e.target.value })} maxLength={200} />
                </Field>
                <Field label="Цикл (днів)" className="w-full sm:w-32">
                  <input type="number" min={0} step="0.01" className={inputClass} value={mo.cycle_length} onChange={(e) => moons.update(mo.id, { cycle_length: e.target.value })} />
                </Field>
                <Field label="Зсув" hint="День початку циклу" className="w-full sm:w-28">
                  <input type="number" className={inputClass} value={mo.shift} onChange={(e) => moons.update(mo.id, { shift: e.target.value })} />
                </Field>
                <Field label="Колір" className="w-full sm:w-40">
                  <ColorField value={mo.color} onChange={(color) => moons.update(mo.id, { color })} />
                </Field>
              </EditableRow>
            ))}
            <AddRowButton label="Додати супутник" onClick={() => moons.add()} />
          </div>
        </FormSection>

        {error && <p className="text-sm text-danger">{error}</p>}
        {success && !error && <p className="text-sm text-sage">Збережено</p>}

        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex justify-end gap-3 border-t border-border bg-surface px-4 py-3 md:static md:border-0 md:bg-transparent md:px-0 md:py-0">
          <Button type="button" variant="ghost" to="/chronology">Скасувати</Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FormSection({ title, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function EditableRow({ onMoveUp, onMoveDown, onRemove, canMoveUp = false, canMoveDown = false, children }) {
  const reorderable = onMoveUp !== undefined || onMoveDown !== undefined;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-bg p-3">
      <div className="flex flex-1 flex-col flex-wrap gap-3 sm:flex-row sm:items-end">
        {children}
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {reorderable && (
          <>
            <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label="Вгору"
              className="rounded p-1 text-text-dim hover:bg-surface-hover disabled:opacity-30">
              <ChevronUp size={16} />
            </button>
            <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label="Вниз"
              className="rounded p-1 text-text-dim hover:bg-surface-hover disabled:opacity-30">
              <ChevronDown size={16} />
            </button>
          </>
        )}
        <button type="button" onClick={onRemove} aria-label="Видалити"
          className="rounded p-1 text-danger hover:bg-surface-hover">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function AddRowButton({ onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 self-start rounded-lg border border-dashed border-border px-3.5 py-2 text-xs font-semibold text-text-dim hover:bg-surface-hover"
    >
      <Plus size={14} /> {label}
    </button>
  );
}

// Нативний color-picker + текстове поле для ручного вводу hex — жодного
// color-picker компонента/бібліотеки в репо ще немає (перевірено по
// package.json), а нативний <input type="color"> покриває вимогу без нової
// залежності.
function ColorField({ value, onChange }) {
  const safeValue = HEX_COLOR_RE.test(value || '') ? value : '#888888';
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safeValue}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-bg p-1"
        aria-label="Колір"
      />
      <input
        type="text"
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#rrggbb"
        maxLength={7}
      />
    </div>
  );
}
