import { Link } from 'react-router-dom';
import { Globe, Lock, Map as MapIcon } from 'lucide-react';

// Картка мапи для каталогу /maps і блоку мап кампанії. Обкладинка — прев'ю,
// яке власник завантажує окремо від шарів (шари — повнорозмірні зображення,
// завеликі для сітки карток); без нього — плейсхолдер.
// actions — кнопки поверх обкладинки; лежать поза <Link>, щоб не вкладати
// інтерактивні елементи в посилання. Решта props (onMouseEnter для
// hover-прев'ю каталогу) йде на обгортку.
export default function MapCard({ name, isPublic, isOwner, previewUrl, to, actions, ...rest }) {
  return (
    <div className="relative h-full" {...rest}>
      <Link
        to={to}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-accent/50"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-bg">
          {previewUrl ? (
            <img
              src={previewUrl} alt={name} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-text-dim"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-border) 35%, transparent) 1px, transparent 0)',
                backgroundSize: '14px 14px',
              }}
            >
              <MapIcon size={32} strokeWidth={1.25} />
            </div>
          )}
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-bg/80 px-2 py-0.5 text-[0.65rem] font-semibold text-text-muted backdrop-blur-sm">
            {isPublic ? <Globe size={11} /> : <Lock size={11} />}
            {isPublic ? 'Публічна' : 'Приватна'}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-0.5 border-t border-border px-3.5 py-2.5">
          <h3 className="truncate font-display text-lg leading-tight text-accent">{name}</h3>
          {isOwner && <p className="text-xs text-text-dim">ваша мапа</p>}
        </div>
      </Link>
      {actions && <div className="absolute right-2 top-2 flex items-center gap-1">{actions}</div>}
    </div>
  );
}
