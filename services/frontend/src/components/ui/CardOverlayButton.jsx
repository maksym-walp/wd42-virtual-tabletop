// Кнопка-іконка поверх обкладинки картки (налаштування, прибрати...).
export default function CardOverlayButton({ onClick, label, danger = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`rounded-md bg-bg/80 p-1.5 text-text-dim backdrop-blur-sm hover:bg-surface-hover ${
        danger ? 'hover:text-danger' : 'hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
