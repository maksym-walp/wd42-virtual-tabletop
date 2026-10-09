import { useEffect, useState } from 'react';
import { Library } from 'lucide-react';
import Sheet from '../ui/Sheet';
import { inputClass } from '../ui/Field';
import { SERVICE_ICONS } from './entityRegistry';
import { ENTITY_SERVICES, useEntitySearch } from './entitySearch';
import EntityResultRow from './EntityResultRow';

const ICONS = { ...SERVICE_ICONS, collections: Library };

// Вибір запису сайту для вставки посилання (кнопка «Запис» у тулбарі
// SmartTextarea). «Усі» шукає за назвою по всіх сервісах; конкретний сервіс
// показує його записи й без запиту.
export default function EntityPickerSheet({ open, onClose, onPick }) {
  const [query, setQuery] = useState('');
  const [service, setService] = useState('all');

  useEffect(() => {
    if (open) { setQuery(''); setService('all'); }
  }, [open]);

  const all = service === 'all';
  const { results, loading } = useEntitySearch({
    query,
    services: all ? ENTITY_SERVICES.map((s) => s.key) : [service],
    limit: all ? 4 : 20,
    minLen: all ? 1 : 0,
    enabled: open,
  });

  const pills = [{ key: 'all', label: 'Усі' }, ...ENTITY_SERVICES];

  return (
    <Sheet open={open} onClose={onClose} title="Посилання на запис">
      <div className="flex flex-col gap-3">
        <input
          autoFocus
          type="text"
          className={inputClass}
          placeholder="Назва заклинання, вміння, НІПа…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5">
          {pills.map((p) => {
            const Icon = ICONS[p.key];
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setService(p.key)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${service === p.key ? 'border-accent bg-accent/15 text-accent' : 'border-border text-text-muted hover:bg-surface-hover'}`}
              >
                {Icon && <Icon size={12} aria-hidden="true" />}
                {p.label}
              </button>
            );
          })}
        </div>
        <div role="listbox" className="max-h-[320px] overflow-y-auto rounded-md border border-border">
          {results.map((r) => (
            <EntityResultRow key={`${r.kind}:${r.id}`} result={r} onPick={(picked) => { onPick(picked); onClose(); }} />
          ))}
          {results.length === 0 && (
            <p className="px-3.5 py-3 text-sm text-text-dim">
              {loading ? 'Шукаю…' : all && !query.trim() ? 'Почни вводити назву або обери сервіс' : 'Нічого не знайдено'}
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}
