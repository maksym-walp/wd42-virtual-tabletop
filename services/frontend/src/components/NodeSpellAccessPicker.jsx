import { SPELL_COMPLEXITIES } from '../constants/spellbook';

// Що вузол відкриває для заклинань: традиції (будь-яка кількість) і
// складність — драбиною, тобто разом з усіма нижчими (див.
// services/skill-tree/src/models/spell-access.js). Окремі заклинання вузли
// не видають.
// value: { unlocks_traditions: [uuid], unlocks_complexity: key | null }
export default function NodeSpellAccessPicker({ traditions = [], value, onChange }) {
  const selected = value.unlocks_traditions || [];
  const toggle = (id) => onChange({
    ...value,
    unlocks_traditions: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="mb-1 block text-xs text-text-dim">Відкриває традиції</span>
        {traditions.length === 0 && <p className="text-xs italic text-text-dim">Традицій ще немає</p>}
        <div className="flex flex-wrap gap-1.5">
          {traditions.map((t) => (
            <button
              key={t.id} type="button" onClick={() => toggle(t.id)}
              className={`rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
                selected.includes(t.id) ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-dim'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 block text-xs text-text-dim">Відкриває складність заклинань — разом з усіма нижчими</span>
        <div className="flex flex-wrap gap-1.5">
          {[[null, 'Жодної'], ...Object.entries(SPELL_COMPLEXITIES).map(([k, v]) => [k, v.label])].map(([key, label]) => (
            <button
              key={key ?? 'none'} type="button"
              onClick={() => onChange({ ...value, unlocks_complexity: key })}
              className={`rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
                (value.unlocks_complexity ?? null) === key ? 'border-gold bg-gold/10 text-gold' : 'border-border text-text-dim'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
