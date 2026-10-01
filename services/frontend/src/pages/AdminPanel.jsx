import { useState, useEffect, useRef } from 'react';
import { X, GripVertical, Download, Upload } from 'lucide-react';
import adminApi from '../api/admin';
import { inputClass } from '../components/ui/Field';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';

// Наразі рівно два конфіги (список сихронізований із services/admin's
// ALLOWED_KEYS) — набір типів зброї й особливостей зброї, звідки їх читає
// equipment-сервіс (useWeaponOptions на боці зброї).
const CONFIG_LABELS = {
  weapon_types: 'Типи зброї',
  weapon_grips: 'Особливості зброї',
};

// key — сире значення у записах каталогу зброї (weapon_type/weapon_grip) і
// в query-параметрах фільтрів, тож лише латинські малі літери, цифри й "_".
const KEY_PATTERN = /^[a-z0-9_]+$/;

// Довший, ніж inputClass'ів w-full, потребує flex-basis, а не width: обидва
// поля рядка (назва + key) ділять inputClass, чиє власне "w-full" інакше
// б'ється з фіксованою шириною key-поля залежно від порядку класів у
// згенерованому Tailwind CSS. flex-basis не конфліктує з width узагалі —
// надійніше за width-утиліту з !important.
const keyInputClass = `${inputClass} shrink-0 basis-40 font-mono text-sm`;

function validateEntries(value) {
  const seen = new Set();
  for (const { key, label } of value) {
    if (!key?.trim()) return 'Кожен варіант має мати key';
    if (!KEY_PATTERN.test(key)) return `key "${key}": лише латинські малі літери, цифри й "_" (наприклад one_handed)`;
    if (!label?.trim()) return 'Кожен варіант має мати назву';
    if (seen.has(key)) return `Дублікат key: ${key}`;
    seen.add(key);
  }
  return null;
}

// Клієнтський ідентифікатор рядка — окремий від key, бо key тепер редагується
// (користувач може змінити key вже існуючого варіанту), а React-у для списку
// потрібен стабільний ключ, який не змінюється разом зі значенням, що
// редагується (інакше поле втрачає фокус посеред введення). Не йде на бекенд.
let nextRowId = 0;
const withRowIds = (value) => value.map((o) => ({ ...o, _rowId: nextRowId++ }));
const stripRowIds = (value) => value.map(({ key, label }) => ({ key, label }));

export default function AdminPanel() {
  const [configs, setConfigs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState(null);
  const [usersError, setUsersError] = useState('');

  useEffect(() => {
    adminApi.listConfigs()
      .then((cs) => setConfigs(cs.map((c) => ({ ...c, value: withRowIds(c.value) }))))
      .catch(() => setError('Не вдалося завантажити конфіги'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    adminApi.listUsers()
      .then(setUsers)
      .catch(() => setUsersError('Не вдалося завантажити користувачів'));
  }, []);

  const updateLocal = (key, value) => {
    setConfigs((cs) => cs.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const handleSaved = (key, saved) => {
    setConfigs((cs) => cs.map((c) => (c.key === key ? { ...saved, value: withRowIds(saved.value) } : c)));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title="Адмін панель" subtitle="Користувачі, конфіги та резервні копії сайту" />

      <UsersTable users={users} error={usersError} />

      <BackupCard />

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : (
        <div className="flex flex-col gap-5">
          {configs.map((config) => (
            <ConfigCard
              key={config.key}
              config={config}
              onChange={(value) => updateLocal(config.key, value)}
              onSaved={(saved) => handleSaved(config.key, saved)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const ROLE_LABELS = {
  admin: 'Адмін',
  game_master: 'Ведучий',
  user: 'Гравець',
};

function UsersTable({ users, error }) {
  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
          Зареєстровані користувачі{users ? ` (${users.length})` : ''}
        </span>
      </div>

      {error ? (
        <p className="p-4 text-sm text-danger">{error}</p>
      ) : !users ? (
        <p className="p-4 text-sm text-text-dim">Завантаження...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-text-dim">
                <th className="px-4 py-2 font-semibold">Користувач</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Роль</th>
                <th className="px-4 py-2 font-semibold">Статус</th>
                <th className="px-4 py-2 font-semibold">Реєстрація</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-4 py-2 font-medium text-text">{u.username}</td>
                  <td className="px-4 py-2 text-text-muted">{u.email}</td>
                  <td className="px-4 py-2 text-text-muted">{ROLE_LABELS[u.role] || u.role}</td>
                  <td className="px-4 py-2">
                    <span className={u.is_active ? 'text-sage' : 'text-danger'}>
                      {u.is_active ? 'активний' : 'вимкнений'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-text-dim">
                    {new Date(u.created_at).toLocaleDateString('uk-UA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Помилка запиту з responseType: 'blob' приходить як Blob із JSON усередині.
async function errorMessage(err, fallback) {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try { return JSON.parse(await data.text()).message || fallback; } catch { return fallback; }
  }
  return data?.message || fallback;
}

function BackupCard() {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileInput = useRef(null);

  const handleDownload = async () => {
    setDownloading(true);
    setError('');
    try {
      const { blob, filename } = await adminApi.downloadBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(await errorMessage(err, 'Не вдалося створити бекап'));
    } finally {
      setDownloading(false);
    }
  };

  const isFullArchive = files.some((f) => f.name.toLowerCase().endsWith('.zip'));

  const handleRestore = async () => {
    const warning = isFullArchive
      ? 'Відновити ВСЮ базу даних з архіву? Усі поточні записи на сайті буде замінено вмістом бекапу. Це незворотньо — рекомендуємо спершу завантажити свіжий бекап.'
      : `Замінити вміст ${files.length} таблиць(і) даними з обраних JSON-файлів? Решта бази не зміниться. Це незворотньо.`;
    if (!window.confirm(warning)) return;

    setRestoring(true);
    setError('');
    setResult(null);
    try {
      setResult(await adminApi.restoreBackup(files));
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(await errorMessage(err, 'Не вдалося відновити бекап'));
    } finally {
      setRestoring(false);
    }
  };

  const restoredRows = result?.restored.reduce((sum, t) => sum + t.rows, 0);

  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">Резервна копія</span>
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-muted">
            Zip-архів з усіма записами бази даних — по JSON-файлу на кожну таблицю.
            Зображення (медіафайли) до архіву не входять.
          </p>
          <div>
            <Button type="button" size="sm" disabled={downloading} onClick={handleDownload}>
              <Download size={14} />
              {downloading ? 'Створення...' : 'Завантажити бекап'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
          <p className="text-sm text-text-muted">
            Відновлення: цілий архів (.zip) замінює всю базу; окремі файли
            <span className="font-mono text-xs"> схема.таблиця.json </span>
            замінюють лише відповідні таблиці.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".zip,.json,application/zip,application/json"
            multiple
            onChange={(e) => { setFiles([...e.target.files]); setResult(null); setError(''); }}
            className="text-sm text-text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-text hover:file:bg-surface-hover"
          />
          <div>
            <Button type="button" size="sm" variant="danger" disabled={restoring || files.length === 0} onClick={handleRestore}>
              <Upload size={14} />
              {restoring ? 'Відновлення...' : 'Відновити з бекапу'}
            </Button>
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        {result && (
          <div className="rounded-lg border border-border/60 bg-bg p-3 text-sm">
            <p className="font-semibold text-sage">
              {result.mode === 'full' ? 'Базу повністю відновлено' : 'Таблиці відновлено'}:
              {' '}{result.restored.length} табл., {restoredRows} записів
            </p>
            {result.cleared.length > 0 && (
              <p className="mt-1 text-text-muted">Спорожнено (немає в бекапі): {result.cleared.join(', ')}</p>
            )}
            {result.restored.filter((t) => t.ignoredColumns.length).map((t) => (
              <p key={t.table} className="mt-1 text-text-muted">
                {t.table}: пропущено колонки, яких уже немає — {t.ignoredColumns.join(', ')}
              </p>
            ))}
            {result.skipped.map((s) => (
              <p key={s.file} className="mt-1 text-text-muted">Пропущено {s.file}: {s.reason}</p>
            ))}
            {result.warnings.map((w) => (
              <p key={w} className="mt-1 text-accent">{w}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigCard({ config, onChange, onSaved }) {
  const [newLabel, setNewLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [addError, setAddError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const dragIndex = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const addEntry = () => {
    const label = newLabel.trim();
    const key = newKey.trim();
    const candidate = [...config.value, { key, label, _rowId: -1 }];
    const err = validateEntries(candidate);
    if (err) { setAddError(err); return; }

    setAddError('');
    onChange(withRowIds(stripRowIds(candidate)));
    setNewLabel('');
    setNewKey('');
  };

  const updateOption = (rowId, patch) => {
    onChange(config.value.map((o) => (o._rowId === rowId ? { ...o, ...patch } : o)));
  };

  const removeEntry = (rowId) => {
    onChange(config.value.filter((o) => o._rowId !== rowId));
  };

  // Порядок елементів масиву — те, у якому їх бачить випадне меню на формі
  // зброї, тож перетягування лише переставляє config.value; зберігається
  // разом з рештою змін по кліку "Зберегти".
  const handleDragStart = (index) => (e) => {
    dragIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (index) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) setDragOverIndex(index);
  };

  const handleDrop = (index) => (e) => {
    e.preventDefault();
    setDragOverIndex(null);
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === index) return;
    const next = [...config.value];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    onChange(next);
  };

  const handleSave = async () => {
    const err = validateEntries(config.value);
    if (err) { setSaveError(err); return; }

    setSaving(true);
    setSaveError('');
    try {
      const saved = await adminApi.updateConfig(config.key, stripRowIds(config.value));
      onSaved(saved);
    } catch (err2) {
      setSaveError(err2.response?.data?.message || 'Помилка збереження');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="border-b border-border bg-bg px-4 py-2">
        <span className="text-xs font-bold uppercase tracking-wide text-text-dim">
          {CONFIG_LABELS[config.key] || config.key}
        </span>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {config.value.map((option, index) => (
          <div
            key={option._rowId}
            onDragOver={handleDragOver(index)}
            onDrop={handleDrop(index)}
            className={`flex items-center gap-2 rounded-lg ${dragOverIndex === index ? 'bg-surface-hover' : ''}`}
          >
            <span
              draggable
              onDragStart={handleDragStart(index)}
              onDragEnd={() => setDragOverIndex(null)}
              className="shrink-0 cursor-grab touch-none text-text-dim active:cursor-grabbing"
              aria-label="Перетягнути для зміни порядку"
            >
              <GripVertical size={16} />
            </span>
            <input
              type="text"
              className={`${inputClass} min-w-0 flex-1`}
              value={option.label}
              onChange={(e) => updateOption(option._rowId, { label: e.target.value })}
            />
            <input
              type="text"
              className={keyInputClass}
              value={option.key}
              onChange={(e) => updateOption(option._rowId, { key: e.target.value })}
            />
            <button
              type="button"
              onClick={() => removeEntry(option._rowId)}
              aria-label="Видалити"
              className="shrink-0 rounded-lg p-2 text-text-dim hover:text-danger"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            className={`${inputClass} min-w-0 flex-1`}
            placeholder="Назва..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
          />
          <input
            type="text"
            className={keyInputClass}
            placeholder="key (one_handed)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEntry(); } }}
          />
          <Button type="button" variant="ghost" size="sm" onClick={addEntry}>Додати</Button>
        </div>
        {addError && <p className="text-sm text-danger">{addError}</p>}

        {saveError && <p className="text-sm text-danger">{saveError}</p>}

        <div className="mt-2 flex justify-end">
          <Button type="button" size="sm" disabled={saving} onClick={handleSave}>
            {saving ? 'Збереження...' : 'Зберегти'}
          </Button>
        </div>
      </div>
    </div>
  );
}
