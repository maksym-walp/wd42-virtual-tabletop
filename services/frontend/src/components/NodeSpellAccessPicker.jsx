import { SPELL_COMPLEXITIES } from '../constants/spellbook';

// Що вузол відкриває для заклинань: складність — драбиною, тобто разом з
// усіма нижчими (див. services/skill-tree/src/models/spell-access.js).
// Традиції вузли більше не відкривають — гравець позначає їх сам у меню
// чарів персонажа; окремі заклинання вузли так само не видають.
// value: { unlocks_complexity: key | null }
export default function NodeSpellAccessPicker({ value, onChange }) {
  return (
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
  );
}
