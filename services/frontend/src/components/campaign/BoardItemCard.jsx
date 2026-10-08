import {
  Eye, EyeOff, Star, Trash2, GripVertical, ArrowRightLeft, Lock,
} from 'lucide-react';
import CroppedImage from '../ui/CroppedImage';
import CardOverlayButton from '../ui/CardOverlayButton';
import SmartTextReader from '../SmartTextReader';
import Button from '../ui/Button';
import { htmlToPreviewText } from '../../utils/richText';
import { BOARD_KINDS, kindLabel } from './boardKinds';

function KindBadge({ item }) {
  const Icon = BOARD_KINDS[item.kind]?.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-bg/80 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-text-dim backdrop-blur-sm">
      {Icon && <Icon size={11} />}
      {kindLabel(item)}
    </span>
  );
}

// Кнопки майстра поверх картки. Порядок — від найчастішої дії.
export function ManagerActions({ item, zone, onToggleVisible, onToggleFeatured, onMoveZone, onRemove }) {
  const stop = (fn) => (e) => { e.stopPropagation(); fn(item); };
  return (
    <>
      {zone === 'table' && (
        <CardOverlayButton
          label={item.is_visible ? 'Сховати від гравців' : 'Показати гравцям'}
          onClick={stop(onToggleVisible)}
        >
          {item.is_visible ? <Eye size={15} className="text-sage" /> : <EyeOff size={15} />}
        </CardOverlayButton>
      )}
      {zone === 'table' && (
        <CardOverlayButton
          label={item.is_featured ? 'Зняти з основного' : 'Зробити основним'}
          onClick={stop(onToggleFeatured)}
        >
          <Star size={15} className={item.is_featured ? 'fill-gold text-gold' : ''} />
        </CardOverlayButton>
      )}
      <CardOverlayButton
        label={zone === 'table' ? 'Прибрати на Ширму' : 'Покласти на Стіл'}
        onClick={stop(onMoveZone)}
      >
        <ArrowRightLeft size={15} />
      </CardOverlayButton>
      <CardOverlayButton label="Видалити запис" danger onClick={stop(onRemove)}>
        <Trash2 size={15} />
      </CardOverlayButton>
    </>
  );
}

// Картка запису в сітці Столу/Ширми. Захований від гравців запис майстер
// бачить приглушеним, з пунктирною рамкою.
export default function BoardItemCard({
  item, manager, zone, onOpen, actions, drag,
}) {
  const excerpt = htmlToPreviewText(item.content, 180);
  const hidden = zone === 'table' && !item.is_visible;
  const privateMap = manager && item.kind === 'map' && item.map_is_public === false;

  return (
    <div
      className={`relative h-full transition-opacity ${drag?.isOver ? 'rounded-lg ring-2 ring-accent/60' : ''}`}
      onDragOver={drag?.onDragOver}
      onDrop={drag?.onDrop}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className={`group flex h-full w-full flex-col overflow-hidden rounded-lg border bg-surface text-left transition-colors hover:border-accent/50 ${
          hidden ? 'border-dashed border-border opacity-60' : 'border-border'
        }`}
      >
        {item.image_url ? (
          <div className={`relative w-full overflow-hidden bg-bg ${item.kind === 'image' ? 'aspect-[4/3]' : 'aspect-[16/9]'}`}>
            <CroppedImage src={item.image_url} crop={item.image_crop} alt={item.title} loading="lazy" />
          </div>
        ) : null}
        {/* Без обкладинки кнопки майстра лягають на текст — даємо їм рядок. */}
        <div className={`flex flex-1 flex-col gap-1 px-3.5 py-3 ${manager && !item.image_url ? 'pt-12' : ''}`}>
          <div className="flex items-center gap-1.5">
            <KindBadge item={item} />
            {hidden && (
              <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-text-dim">
                <EyeOff size={11} /> заховано
              </span>
            )}
          </div>
          <h3 className="line-clamp-2 font-display text-lg leading-tight text-accent">{item.title}</h3>
          {item.subtitle && <p className="text-xs italic text-text-dim">{item.subtitle}</p>}
          {excerpt && <p className="line-clamp-3 text-sm text-text-muted">{excerpt}</p>}
          {privateMap && (
            <p className="mt-auto flex items-center gap-1 pt-1 text-xs text-text-dim">
              <Lock size={11} /> Приватна мапа — гравці її не побачать
            </p>
          )}
        </div>
      </button>

      {manager && (
        <>
          {drag && (
            <span
              draggable
              onDragStart={drag.onDragStart}
              onDragEnd={drag.onDragEnd}
              className="absolute left-2 top-2 hidden cursor-grab rounded-md bg-bg/80 p-1.5 text-text-dim backdrop-blur-sm active:cursor-grabbing sm:block"
              aria-label="Перетягнути для зміни порядку"
              title="Перетягнути для зміни порядку"
            >
              <GripVertical size={15} />
            </span>
          )}
          <div className="absolute right-2 top-2 flex items-center gap-1">{actions}</div>
        </>
      )}
    </div>
  );
}

// Основний запис — великий блок над сіткою Столу.
export function FeaturedItem({ item, manager, onOpen, actions, campaignId }) {
  const isImage = item.kind === 'image';
  const mapHref = item.kind === 'map' ? BOARD_KINDS.map.href(item, campaignId) : null;
  const hidden = !item.is_visible;

  return (
    <section
      className={`relative overflow-hidden rounded-2xl border bg-surface ${
        hidden ? 'border-dashed border-border opacity-70' : 'border-gold/50'
      }`}
    >
      <div className={isImage ? '' : 'grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]'}>
        {item.image_url && (
          <button
            type="button"
            onClick={() => onOpen(item)}
            className={`block w-full overflow-hidden bg-bg ${isImage ? 'max-h-[70vh]' : 'aspect-[16/10] md:aspect-auto md:min-h-72'}`}
            aria-label={`Відкрити «${item.title}»`}
          >
            {isImage ? (
              <img src={item.image_url} alt={item.title} className="mx-auto max-h-[70vh] w-auto object-contain" />
            ) : (
              <CroppedImage src={item.image_url} crop={item.image_crop} alt={item.title} />
            )}
          </button>
        )}
        {!isImage && (
          <div className="flex flex-col gap-2 p-5 md:p-6">
            <div className={`flex flex-wrap items-center gap-2 ${manager ? 'pr-36' : ''}`}>
              <span className="inline-flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-wide text-gold">
                <Star size={12} className="fill-gold" /> Основне
              </span>
              <KindBadge item={item} />
              {hidden && <span className="text-xs text-text-dim">заховано від гравців</span>}
            </div>
            <h2 className="font-display text-2xl text-accent md:text-3xl">{item.title}</h2>
            {item.subtitle && <p className="text-sm italic text-text-dim">{item.subtitle}</p>}
            {item.content && (
              <div className="max-h-80 overflow-y-auto pr-1">
                <SmartTextReader text={item.content} className="text-sm text-text" />
              </div>
            )}
            {mapHref && (
              <div className="mt-auto pt-2">
                <Button to={mapHref} size="sm">Відкрити мапу</Button>
              </div>
            )}
          </div>
        )}
      </div>
      {manager && <div className="absolute right-3 top-3 flex items-center gap-1">{actions}</div>}
    </section>
  );
}
