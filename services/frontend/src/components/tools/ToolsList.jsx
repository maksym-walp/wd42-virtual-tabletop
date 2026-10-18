import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import PageHeader from '../ui/PageHeader';
import { inputClass } from '../ui/Field';
import ExportImportActions from '../ExportImportActions';
import { runImport } from '../../utils/toolsImportTemplates';

const SCOPES = [
  { key: '', label: 'Усі' },
  { key: 'mine', label: 'Мої' },
  { key: 'public', label: 'Публічні' },
];

// Спільний каркас списку інструмента-документа (сузір'я, колоди): заголовок,
// пошук, фільтр «Усі / Мої / Публічні», імпорт та сітка карток.
//   api         — constellationsApi / decksApi
//   renderCard  — (item) => картка
//   newTo       — маршрут створення
export default function ToolsList({
  title, subtitle, api, newTo, newLabel, emptyIcon, emptyText, noun, template, renderCard,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('');
  const [search, setSearch] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const params = {};
    if (scope) params.scope = scope;
    if (search.trim()) params.search = search.trim();
    // Невелика затримка, щоб не слати запит на кожну літеру пошуку.
    const timer = setTimeout(() => {
      api.list(params)
        .then((list) => { setItems(list); setError(''); })
        .catch(() => setError('Не вдалось завантажити список'))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [api, scope, search, reload]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 pb-24 sm:px-6 md:pb-8">
      <Link to="/tools" className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-dim">
        <ArrowLeft size={15} /> Інструменти
      </Link>

      <PageHeader
        title={title}
        subtitle={subtitle}
        action={(
          <div className="flex items-center gap-2">
            <ExportImportActions
              hideExport
              onTemplate={template}
              onImport={(data) => runImport(api, data, { noun, onDone: () => setReload((n) => n + 1) })}
            />
            <Button to={newTo}>+ {newLabel}</Button>
          </div>
        )}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className={`${inputClass} max-w-xs`}
          placeholder="Пошук за назвою..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          {SCOPES.map(({ key, label }) => (
            <button
              key={key || 'all'}
              type="button"
              onClick={() => setScope(key)}
              className={`rounded border px-3 py-1.5 text-sm font-semibold transition-colors ${
                scope === key ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border text-text-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-danger">{error}</p>}

      {loading ? (
        <p className="py-12 text-center text-text-dim">Завантаження...</p>
      ) : items.length === 0 ? (
        <EmptyState icon={emptyIcon} title="Нічого не знайдено" action={<Button to={newTo}>{newLabel}</Button>}>
          {emptyText}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(renderCard)}
        </div>
      )}
    </div>
  );
}
