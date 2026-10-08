import { useCallback, useEffect, useRef, useState } from 'react';
import campaignApi from '../../api/campaigns';

// Записи однієї зони (Стіл/Ширма) і всі дії майстра над ними з оптимістичним
// оновленням. reload викликає й CampaignDetail на real-time подію — тоді
// гравці бачать зміни майстра без перезавантаження сторінки.
export default function useBoard(campaignId, zone) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const rows = await campaignApi.listBoard(campaignId, zone);
      // Відповідь на застарілий запит (дві події поспіль) не перезаписує свіжішу.
      if (id === requestId.current) { setItems(rows); setError(''); }
    } catch {
      if (id === requestId.current) setError('Не вдалось завантажити записи');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [campaignId, zone]);

  useEffect(() => { setLoading(true); reload(); }, [reload]);

  // Застосовує зміну одразу, а на помилку повертає дані з сервера.
  const optimistic = useCallback(async (apply, request, failMessage) => {
    setItems(apply);
    try {
      return await request();
    } catch (err) {
      setError(err.response?.data?.message || failMessage);
      reload();
      return null;
    }
  }, [reload]);

  const patch = (item, payload, failMessage) => optimistic(
    (prev) => prev.map((i) => (i.id === item.id ? { ...i, ...payload } : i)),
    () => campaignApi.updateBoardItem(campaignId, item.id, payload),
    failMessage,
  );

  const actions = {
    add: async (payload) => {
      const item = await campaignApi.addBoardItem(campaignId, { ...payload, zone });
      setItems((prev) => [item, ...prev]);
      return item;
    },

    toggleVisible: (item) => patch(item, { is_visible: !item.is_visible }, 'Не вдалось змінити видимість'),

    toggleFeatured: (item) => {
      const featured = !item.is_featured;
      return optimistic(
        (prev) => prev.map((i) => {
          if (i.id === item.id) return { ...i, is_featured: featured };
          return featured ? { ...i, is_featured: false } : i;
        }),
        () => campaignApi.updateBoardItem(campaignId, item.id, { is_featured: featured }),
        'Не вдалось змінити основний запис',
      );
    },

    moveToZone: (item, targetZone) => optimistic(
      (prev) => prev.filter((i) => i.id !== item.id),
      () => campaignApi.updateBoardItem(campaignId, item.id, { zone: targetZone }),
      'Не вдалось перенести запис',
    ),

    update: async (item, payload) => {
      const updated = await campaignApi.updateBoardItem(campaignId, item.id, payload);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
      return updated;
    },

    refreshFromSource: async (item) => {
      const updated = await campaignApi.refreshBoardItem(campaignId, item.id);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
      return updated;
    },

    remove: (item) => optimistic(
      (prev) => prev.filter((i) => i.id !== item.id),
      () => campaignApi.removeBoardItem(campaignId, item.id),
      'Не вдалось видалити запис',
    ),

    // Переставляє запис fromId на місце toId (або на крок delta).
    reorder: (fromId, toId) => {
      const next = [...items];
      const from = next.findIndex((i) => i.id === fromId);
      const to = next.findIndex((i) => i.id === toId);
      if (from === -1 || to === -1 || from === to) return null;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return optimistic(
        () => next,
        () => campaignApi.reorderBoard(campaignId, zone, next.map((i) => i.id)),
        'Не вдалось змінити порядок',
      );
    },

    // list — те, що бачить користувач (сітка без основного запису).
    move: (item, delta, list = items) => {
      const index = list.findIndex((i) => i.id === item.id);
      const target = list[index + delta];
      return target ? actions.reorder(item.id, target.id) : null;
    },
  };

  return { items, loading, error, setError, reload, actions };
}
