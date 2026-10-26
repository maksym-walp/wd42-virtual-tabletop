import { useEffect } from 'react';
import useBoard from './useBoard';
import BoardGrid from './BoardGrid';
import CalendarBlock from './CalendarBlock';
import SessionsPanel from './SessionsPanel';

// ================================================================
// Стіл: спільні записи ліворуч, календар і попередні сесії в боковій колонці.
// Майстер бачить і заховані записи, гравці — лише відкриті; version змінюється
// на real-time подію 'board', sessionsVersion — на 'sessions'.
// ================================================================

export default function TableTab({ campaign, isGm, onChange, version, sessionsVersion }) {
  const board = useBoard(campaign.id, 'table');
  const { reload } = board;

  useEffect(() => { if (version) reload(); }, [version, reload]);

  // Гравцеві без привʼязаного календаря календар у боковій колонці не потрібен.
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
      columns="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
    />
  );

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <aside className="flex min-w-0 flex-col gap-6 xl:order-2">
        {showCalendar && <CalendarBlock campaign={campaign} isGm={isGm} onChange={onChange} />}
        <SessionsPanel campaignId={campaign.id} isGm={isGm} version={sessionsVersion} />
      </aside>
      <div className="min-w-0 xl:order-1">{grid}</div>
    </div>
  );
}
