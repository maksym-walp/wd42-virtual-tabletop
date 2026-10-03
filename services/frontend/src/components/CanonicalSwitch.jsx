// Компактний перемикач канонічності — для рядка дій на сторінці запису
// (поруч із "Редагувати"/"Видалити"). Рендериться викликачем лише для
// game_master/admin — сам роль не перевіряє.
export default function CanonicalSwitch({ checked, onChange, disabled = false, className = '' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      title={checked ? 'Зняти позначку «канонічне»' : 'Позначити канонічним'}
      className={`inline-flex items-center gap-2 text-sm font-semibold disabled:opacity-60 ${checked ? 'text-gold' : 'text-text-dim'} ${className}`}
    >
      <span
        className={`relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors ${
          checked ? 'border-gold bg-gold/30' : 'border-border bg-bg'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
            checked ? 'left-[1.125rem] bg-gold' : 'left-0.5 bg-text-dim'
          }`}
        />
      </span>
      Канонічне
    </button>
  );
}
