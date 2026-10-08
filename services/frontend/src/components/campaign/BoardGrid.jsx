import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import Lightbox from '../ui/Lightbox';
import BoardItemCard, { FeaturedItem, ManagerActions } from './BoardItemCard';
import BoardItemSheet from './BoardItemSheet';
import AddBoardItemSheet from './AddBoardItemSheet';
import { BOARD_KINDS } from './boardKinds';

// Сітка записів однієї зони (Стіл або Ширма) — спільна для обох вкладок.
// board — результат useBoard. На Столі основний запис показується великим
// блоком над сіткою.
export default function BoardGrid({
  board, zone, manager, campaignId, title, emptyTitle, emptyHint, columns,
}) {
  const navigate = useNavigate();
  const { items, loading, error, actions } = board;
  const [openId, setOpenId] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [adding, setAdding] = useState(false);
  const dragId = useRef(null);
  const [overId, setOverId] = useState(null);

  const featured = zone === 'table' ? items.find((i) => i.is_featured) : null;
  const gridItems = featured ? items.filter((i) => i.id !== featured.id) : items;
  const images = items.filter((i) => i.kind === 'image');
  // Живий запис зі стану, щоб відкрита картка бачила свіжі зміни.
  const openItem = items.find((i) => i.id === openId) ?? null;

  const open = (item) => {
    if (item.kind === 'image') {
      setLightbox(images.findIndex((i) => i.id === item.id));
    } else if (item.kind === 'map' && !manager) {
      navigate(BOARD_KINDS.map.href(item, campaignId));
    } else {
      setOpenId(item.id);
    }
  };

  const otherZone = zone === 'table' ? 'screen' : 'table';
  const handleRemove = (item) => {
    if (!confirm(`Видалити «${item.title}»?`)) return;
    actions.remove(item);
  };
  const renderActions = (item) => (
    <ManagerActions
      item={item}
      zone={zone}
      onToggleVisible={actions.toggleVisible}
      onToggleFeatured={actions.toggleFeatured}
      onMoveZone={(i) => actions.moveToZone(i, otherZone)}
      onRemove={handleRemove}
    />
  );

  // Нативний HTML5 drag-and-drop, як у AdminPanel; на тач-екранах порядок
  // змінюється кнопками ↑/↓ у картці запису.
  const dragProps = (item) => ({
    isOver: overId === item.id,
    onDragStart: (e) => {
      dragId.current = item.id;
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragEnd: () => { dragId.current = null; setOverId(null); },
    onDragOver: (e) => {
      if (!dragId.current) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (overId !== item.id) setOverId(item.id);
    },
    onDrop: (e) => {
      e.preventDefault();
      setOverId(null);
      const from = dragId.current;
      dragId.current = null;
      if (from && from !== item.id) actions.reorder(from, item.id);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 font-display text-lg text-text">{title}</h3>
        {manager && (
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> Додати
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {featured && (
        <FeaturedItem
          item={featured}
          manager={manager}
          campaignId={campaignId}
          onOpen={open}
          actions={renderActions(featured)}
        />
      )}

      {loading ? (
        <p className="text-sm text-text-dim">Завантаження...</p>
      ) : items.length === 0 ? (
        <EmptyState title={emptyTitle}>{emptyHint}</EmptyState>
      ) : gridItems.length > 0 && (
        <div className={`grid grid-cols-1 gap-3 ${columns}`}>
          {gridItems.map((item) => (
            <BoardItemCard
              key={item.id}
              item={item}
              zone={zone}
              manager={manager}
              onOpen={open}
              actions={renderActions(item)}
              drag={manager ? dragProps(item) : null}
            />
          ))}
        </div>
      )}

      {openItem && (
        <BoardItemSheet
          item={openItem}
          manager={manager}
          campaignId={campaignId}
          onClose={() => setOpenId(null)}
          onSave={actions.update}
          onRefresh={actions.refreshFromSource}
          onMove={(item, delta) => actions.move(item, delta, gridItems)}
        />
      )}

      {lightbox !== null && lightbox >= 0 && (
        <Lightbox images={images.map((i) => i.image_url)} index={lightbox} onClose={() => setLightbox(null)} />
      )}

      {manager && (
        <AddBoardItemSheet
          open={adding}
          zone={zone}
          campaignId={campaignId}
          existingItems={items}
          onAdd={actions.add}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
