import { useState, useEffect, useRef } from 'react';
import { X, GripVertical } from 'lucide-react';
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

  useEffect(() => {
    adminApi.listConfigs()
      .then((cs) => setConfigs(cs.map((c) => ({ ...c, value: withRowIds(c.value) }))))
      .catch(() => setError('Не вдалося завантажити конфіги'))
      .finally(() => setLoading(false));
  }, []);

  const updateLocal = (key, value) => {
    setConfigs((cs) => cs.map((c) => (c.key === key ? { ...c, value } : c)));
  };

  const handleSaved = (key, saved) => {
    setConfigs((cs) => cs.map((c) => (c.key === key ? { ...saved, value: withRowIds(saved.value) } : c)));
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <PageHeader title="Адмін панель" subtitle="Конфіги сайту" />

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
