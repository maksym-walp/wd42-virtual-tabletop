import { useEffect } from 'react';
import useBoard from './useBoard';
import BoardGrid from './BoardGrid';
import CalendarBlock from './CalendarBlock';

// ================================================================
// Стіл: календар і спільні записи. Майстер бачить і заховані записи,
// гравці — лише відкриті; version змінюється на real-time подію 'board'.
// ================================================================

export default function TableTab({ campaign, isGm, onChange, version }) {
  const board = useBoard(campaign.id, 'table');
  const { reload } = board;

  useEffect(() => { if (version) reload(); }, [version, reload]);

  // Гравцеві без привʼязаного календаря нічого показувати в боковій колонці.
  const showCalendar = isGm || Boolean(campaign.calendar_id);
  const grid = (
    <BoardGrid
      board={board}
      zone="table"
      manager={isGm}
      campaignId={campaign.id}
      title="Записи на столі"
      emptyTitle="Стіл порожній"
      emptyHint={isGm
        ? 'Додайте нотатки, мапи, зображення чи картки — або перенесіть їх зі Ширми.'
        : 'Майстер ще нічого не виклав на стіл.'}
      columns={showCalendar ? 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}
    />
  );

  if (!showCalendar) return grid;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 xl:order-2">
        <div className="xl:sticky xl:top-4">
          <CalendarBlock campaign={campaign} isGm={isGm} onChange={onChange} />
        </div>
      </div>
      <div className="min-w-0 xl:order-1">{grid}</div>
    </div>
  );
}
